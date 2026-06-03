/** Hosted deletion epoch (in-memory; cleared on API redeploy). */

let state = {
  lastDeletionAt: 0,
  deletedProfileIds: [],
};

export function recordHostedAccountDeletion(slugs) {
  const at = Date.now();
  const incoming = (Array.isArray(slugs) ? slugs : [slugs])
    .map((s) => String(s ?? '').trim())
    .filter(Boolean);
  const merged = [...new Set([...incoming, ...state.deletedProfileIds])].slice(0, 64);
  state = {
    lastDeletionAt: at,
    deletedProfileIds: merged,
  };
  return state;
}

export function forgetHostedAccountDeletion(slugs) {
  const remove = new Set(
    (Array.isArray(slugs) ? slugs : [slugs])
      .map((s) => String(s ?? '').trim())
      .filter(Boolean),
  );
  if (remove.size === 0) return state;
  state = {
    ...state,
    deletedProfileIds: state.deletedProfileIds.filter((slug) => !remove.has(String(slug))),
  };
  return state;
}

export function getHostedAccountState() {
  return {
    lastDeletionAt: state.lastDeletionAt,
    deletedProfileIds: [...state.deletedProfileIds],
  };
}

export function resetHostedAccountState() {
  state = { lastDeletionAt: 0, deletedProfileIds: [] };
}
