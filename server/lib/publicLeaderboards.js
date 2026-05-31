/**
 * @deprecated Prefer buildMultiUserLeaderboards — kept as alias for hosted routes.
 */
import { buildMultiUserLeaderboards } from './multiUserLeaderboards.js';

export function buildPublicLeaderboards(realProfiles, minimumRows = 5, opts = {}) {
  return buildMultiUserLeaderboards(realProfiles, { minimumRows, ...opts });
}

export { buildMultiUserLeaderboards, remixStoredLeaderboard, MIN_LEADERBOARD_ROWS } from './multiUserLeaderboards.js';
