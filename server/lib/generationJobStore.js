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
      const next = throwIfError(
        await supabase
          .from('generation_jobs')
          .select('*')
          .eq('status', 'queued')
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle(),
        'read next generation job',
      );
      if (!next) return null;

      return throwIfError(
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

    async hasActiveJob(profileId) {
      const row = throwIfError(
        await supabase
          .from('generation_jobs')
          .select('id')
          .eq('profile_id', profileId)
          .in('status', ['queued', 'claimed'])
          .limit(1)
          .maybeSingle(),
        'check active generation job',
      );
      return Boolean(row);
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
