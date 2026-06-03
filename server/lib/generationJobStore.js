function throwIfError(result, label) {
  if (result?.error) throw new Error(`${label}: ${result.error.message}`);
  return result?.data;
}

function mapJobRow(row) {
  if (!row) return null;
  const payload = row.request_payload && typeof row.request_payload === 'object'
    ? row.request_payload
    : {};
  const jobType = payload.jobType || 'posts';
  const result = row.result_posts;
  return {
    id: row.id,
    status: row.status,
    jobType,
    error: row.error ?? null,
    result,
    posts: jobType === 'posts' && Array.isArray(result) ? result : null,
    createdAt: row.created_at,
    completedAt: row.completed_at,
  };
}

function jobTypeFromRow(row) {
  const payload = row?.request_payload && typeof row.request_payload === 'object'
    ? row.request_payload
    : {};
  return payload.jobType || 'posts';
}

const INTERACTIVE_JOB_TYPES = new Set(['comments', 'blurbs', 'bio']);

function jobPriority(row) {
  return INTERACTIVE_JOB_TYPES.has(jobTypeFromRow(row)) ? 0 : 1;
}

export function createGenerationJobStore(supabase) {
  if (!supabase) throw new Error('Supabase service client required');

  return {
    async createJob({ userId, profileId, requestPayload }) {
      return throwIfError(
        await supabase
          .from('generation_jobs')
          .insert({
            user_id: userId ?? null,
            profile_id: profileId ?? null,
            status: 'queued',
            request_payload: requestPayload ?? {},
          })
          .select('*')
          .single(),
        'create generation job',
      );
    },

    async getJobById(jobId) {
      return throwIfError(
        await supabase
          .from('generation_jobs')
          .select('*')
          .eq('id', jobId)
          .maybeSingle(),
        'get generation job',
      );
    },

    async claimNext(workerName) {
      const staleBefore = new Date(Date.now() - 45 * 60 * 1000).toISOString();
      throwIfError(
        await supabase
          .from('generation_jobs')
          .update({
            status: 'queued',
            claimed_by: null,
            claimed_at: null,
            error: null,
          })
          .eq('status', 'claimed')
          .lt('claimed_at', staleBefore),
        'requeue stale generation jobs',
      );

      const queued = throwIfError(
        await supabase
          .from('generation_jobs')
          .select('*')
          .eq('status', 'queued')
          .order('created_at', { ascending: true })
          .limit(25),
        'read queued generation jobs',
      );
      const list = Array.isArray(queued) ? queued.filter(Boolean) : [];
      if (list.length === 0) return null;

      list.sort((a, b) => {
        const p = jobPriority(a) - jobPriority(b);
        if (p !== 0) return p;
        return String(a.created_at).localeCompare(String(b.created_at));
      });

      for (const next of list) {
        const claimed = throwIfError(
          await supabase
            .from('generation_jobs')
            .update({
              status: 'claimed',
              claimed_by: workerName,
              claimed_at: new Date().toISOString(),
            })
            .eq('id', next.id)
            .eq('status', 'queued')
            .select('*')
            .maybeSingle(),
          'claim generation job',
        );
        if (claimed) return claimed;
      }
      return null;
    },

    async completeJob({ jobId, posts, result }) {
      const update = {
        status: 'complete',
        completed_at: new Date().toISOString(),
        error: null,
      };
      if (result !== undefined) update.result_posts = result;
      else if (posts !== undefined) update.result_posts = posts;

      return throwIfError(
        await supabase
          .from('generation_jobs')
          .update(update)
          .eq('id', jobId)
          .select('*')
          .single(),
        'complete generation job',
      );
    },

    async failJob({ jobId, error }) {
      return throwIfError(
        await supabase
          .from('generation_jobs')
          .update({
            status: 'failed',
            error: String(error || 'Generation failed'),
            completed_at: new Date().toISOString(),
          })
          .eq('id', jobId)
          .select('*')
          .single(),
        'fail generation job',
      );
    },

    async hasActiveJob(profileId, jobType = null) {
      const rows = throwIfError(
        await supabase
          .from('generation_jobs')
          .select('id, request_payload')
          .eq('profile_id', profileId)
          .in('status', ['queued', 'claimed'])
          .order('created_at', { ascending: false })
          .limit(12),
        'check active generation job',
      );
      const list = Array.isArray(rows) ? rows.filter(Boolean) : [];
      if (!jobType) return list.length > 0;
      return list.some((row) => jobTypeFromRow(row) === jobType);
    },

    /** Return an in-flight job matching type (+ optional payload fields). */
    async findActiveJob({ profileId, jobType, payloadMatch = {} }) {
      if (!profileId) return null;
      const rows = throwIfError(
        await supabase
          .from('generation_jobs')
          .select('*')
          .eq('profile_id', profileId)
          .in('status', ['queued', 'claimed'])
          .order('created_at', { ascending: false })
          .limit(12),
        'find active generation job',
      );
      const list = Array.isArray(rows) ? rows.filter(Boolean) : [];
      return list.find((row) => {
        if (jobTypeFromRow(row) !== jobType) return false;
        const payload = row.request_payload && typeof row.request_payload === 'object'
          ? row.request_payload
          : {};
        for (const [key, value] of Object.entries(payloadMatch)) {
          const left = payload[key] ?? null;
          const right = value ?? null;
          if (String(left ?? '') !== String(right ?? '')) return false;
        }
        return true;
      }) ?? null;
    },

    async findLatestJobPayload(profileId, jobType = 'posts') {
      const rows = throwIfError(
        await supabase
          .from('generation_jobs')
          .select('request_payload, status, created_at')
          .eq('profile_id', profileId)
          .order('created_at', { ascending: false })
          .limit(8),
        'find latest generation job',
      );
      return (rows ?? []).find((row) => {
        const payload = row?.request_payload && typeof row.request_payload === 'object'
          ? row.request_payload
          : {};
        return (payload.jobType || 'posts') === jobType;
      }) ?? null;
    },

    mapJobRow,
  };
}
