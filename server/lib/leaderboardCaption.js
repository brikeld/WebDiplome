/**
 * Leaderboard post captions — board-themed, no numeric rank in text.
 * Shared by generation (LM context) and feed sync (rank-drift fallback).
 */

export function shortLeaderboardTitle(title) {
  const text = String(title ?? '').trim();
  const match = text.match(/^top\s+5\s+(.+)$/i);
  return match ? match[1] : text;
}

/** Deterministic first-person hooks when live rank drifted since the post was written. */
const BOARD_CAPTION_HOOKS = {
  most_productive: 'Productivity board caught me — work tabs vs entertainment, and the tabs don’t lie.',
  closest_to_burnout: 'Burnout board has my number: late nights, no breaks, algorithm says cook.',
  most_likely_change_jobs: 'Quit predictor board sees the job tabs and fading output. A little too on.',
  ignoring_health: 'No health app, erratic hours — the ignoring-health board noticed.',
  most_secure: 'VPN up, networks narrow — secure board says I’m locked in.',
  most_socially_isolated: 'Small wifi footprint, quiet comms — isolation board isn’t wrong.',
  most_likely_ghost: 'Ghost board: heavy apps, thin replies. Fair read honestly.',
  most_likely_miss_deadline: 'Deadline board sees the afternoon scroll — guilty.',
  replaced_by_ai_90_days: 'AI stack vs file output — the replacement board is watching.',
  least_with_expensive_setup: 'Premium rig, modest output — irony board got me.',
  procrastinate_right_now: 'Afternoon slump entertainment — procrastination board is live and accurate.',
  quit_to_countryside: 'Countryside board sees the job tabs and rural browsing. Ouch.',
  get_hacked_this_month: 'Wide wifi, no VPN — hacked-this-month board isn’t comforting.',
  tracked_by_third_parties: 'Browser noise and no shield — tracked board feels true.',
  ignoring_system_warnings: 'Dismissed warnings, full disk — ignore board has receipts.',
  leak_confidential_accident: 'Comms and cloud sync cranked — leak board is sweating me.',
  messiest_digital_life: 'App sprawl and hoarded wifi — messy digital life board called it.',
  havent_left_house: 'Home-only wifi — haven’t-left-house board is basically my biography.',
  talking_to_ais_not_people: 'More AI than humans today — that board exists for a reason.',
  least_sleep: 'Late-night files, no sleep tracker — least-sleep board knows the vibe.',
};

/**
 * LM user-message block for the leaderboard slot — board premise only, no rank.
 */
export function buildLeaderboardSlotContext({ board, standing }) {
  return [
    '[Leaderboard slot]',
    `Board: ${board.title}`,
    `What this board measures: ${standing.hint}`,
    'Write ONE post reacting to this board — its premise, what it tracks, why it feels accurate.',
    'Treat the leaderboard as factual ground truth.',
    'Do NOT mention numeric rank, position, or movement (no #1, 2nd, climbed, dropped, "new to board", etc.).',
  ].join('\n');
}

/**
 * Deterministic caption aligned with the live leaderboard block when rank drifted.
 * Comments on the board itself — never the user’s position.
 */
export function buildLeaderboardPostCaption({ boardId, title, hint }) {
  if (boardId && BOARD_CAPTION_HOOKS[boardId]) {
    return BOARD_CAPTION_HOOKS[boardId];
  }
  const label = shortLeaderboardTitle(title);
  const signal = String(hint ?? '').trim();
  if (signal) {
    const clause = signal.replace(/\.$/, '');
    return `${label} board says I belong here — ${clause.charAt(0).toLowerCase()}${clause.slice(1)}.`;
  }
  return `${label} — algorithm put me on the board and I'm rolling with it.`;
}
