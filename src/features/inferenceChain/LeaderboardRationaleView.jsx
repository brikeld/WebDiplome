import { useLiveScoring } from '@/features/liveScoring/useLiveScoring.js';

/**
 * Per-entry rationale view shown inside the inference panel when the post is a
 * leaderboard. Mirrors the LeaderboardBlock's hidden-state logic so the two
 * views stay in sync.
 */
export default function LeaderboardRationaleView({ leaderboard }) {
  const { isLeaderboardSelfHidden } = useLiveScoring();
  if (!leaderboard || !Array.isArray(leaderboard.entries)) return null;
  const {
    entries,
    boardId,
    cloneHidden = [false, false, false, false],
    rationales,
  } = leaderboard;
  const selfHidden = isLeaderboardSelfHidden(boardId);

  let cloneIdx = -1;
  const rows = entries.map((entry) => {
    let hidden;
    if (entry.isUser) {
      hidden = selfHidden;
    } else {
      cloneIdx += 1;
      hidden = Boolean(cloneHidden[cloneIdx]);
    }
    const rationale = Array.isArray(rationales)
      ? rationales.find((r) => r.rank === entry.rank)
      : null;
    return { entry, hidden, rationale };
  });

  return (
    <ol className="leaderboard-rationales" aria-label="Per-entry rationales">
      {rows.map(({ entry, hidden, rationale }) => (
        <li
          key={entry.rank}
          className={`leaderboard-rationale-row${hidden ? ' is-hidden' : ''}${entry.isUser ? ' is-self' : ''}`}
        >
          <div className="leaderboard-rationale-row__head">
            <span className="leaderboard-rationale-row__rank">
              {String(entry.rank).padStart(2, '0')}
            </span>
            <span className="leaderboard-rationale-row__avatar" aria-hidden>
              {!hidden && entry.avatarSrc
                ? <img src={entry.avatarSrc} alt="" />
                : !hidden
                  ? <span className="leaderboard-rationale-row__initials">{entry.avatarInitials}</span>
                  : null}
            </span>
            <span className="leaderboard-rationale-row__name">
              {hidden ? 'position hidden' : entry.name}
            </span>
          </div>
          {hidden ? (
            <p className="leaderboard-rationale-row__hidden">
              no signal shared
            </p>
          ) : (
            <>
              {rationale?.phrase ? (
                <p className="leaderboard-rationale-row__phrase">{rationale.phrase}</p>
              ) : null}
              {rationale?.signal ? (
                <span className="leaderboard-rationale-row__signal">{rationale.signal}</span>
              ) : null}
            </>
          )}
        </li>
      ))}
    </ol>
  );
}
