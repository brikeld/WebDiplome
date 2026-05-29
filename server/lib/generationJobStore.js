function throwIfError(result, label) {
  if (result?.error) throw new Error(`${label}: ${result.error.message}`);
  return result?.data;
}

export function createGenerationJobStore(supabase) {
  if (!supabase) throw new Error('Supabase service client required');

  return {
    async createJob({ userId, profileId, requestPayload }) {
      return throwIfError(
        await supabase
          .from('generation_jobs')
          .insert({
            user_id: userId,
            profile_id: profileId,
            status: 'queued',
            request_payload: requestPayload ?? {},
          })
          .select('*')
          .single(),
        'create generation job',
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

    async completeJob({ jobId, posts }) {
      return throwIfError(
        await supabase
          .from('generation_jobs')
          .update({
            status: 'complete',
            result_posts: posts,
            completed_at: new Date().toISOString(),
            error: null,
          })
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
  };
}
