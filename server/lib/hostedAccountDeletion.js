/** Hosted deletion epoch (in-memory; cleared on API redeploy). */

let state = {
  lastDeletionAt: 0,
  deletedProfileIds: [],
};

export function recordHostedAccountDeletion(slug) {
  const at = Date.now();
  const id = slug ? String(slug) : null;
  state = {
    lastDeletionAt: at,
    deletedProfileIds: id ? [id, ...state.deletedProfileIds.filter((s) => s !== id)].slice(0, 32) : state.deletedProfileIds,
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
