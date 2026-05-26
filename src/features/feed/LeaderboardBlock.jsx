import { useId } from 'react';
import { useLiveScoring } from '@/features/liveScoring/useLiveScoring.js';
import './leaderboardBlock.css';

function DeltaChip({ userRank, previousUserRank }) {
  if (previousUserRank == null) {
    return <span className="leaderboard-delta leaderboard-delta--new">NEW</span>;
  }
  if (previousUserRank === userRank) return null;
  const isUp = userRank < previousUserRank;
  return (
    <span
      className={`leaderboard-delta ${isUp ? 'leaderboard-delta--up' : 'leaderboard-delta--down'}`}
    >
      {isUp ? '▲' : '▼'} from #{previousUserRank}
    </span>
  );
}

function Row({ entry, hidden }) {
  const cls = [
    'leaderboard-row',
    entry.isUser ? 'leaderboard-row--self' : '',
    hidden ? 'leaderboard-row--hidden' : '',
  ].filter(Boolean).join(' ');
  // Assumes 5-entry board: rank 1 → 100%, rank 5 → 20%.
  const widthPct = ((6 - entry.rank) / 5) * 100;
  const name = hidden ? 'position hidden' : entry.name;
  return (
    <li className={cls}>
      <div className="leaderboard-row__header">
        <span className="leaderboard-row__rank">{String(entry.rank).padStart(2, '0')}</span>
        <span className="leaderboard-row__avatar" aria-hidden>
          {!hidden && entry.avatarSrc
            ? <img className="leaderboard-row__avatar-img" src={entry.avatarSrc} alt="" />
            : !hidden
              ? <span className="leaderboard-row__avatar-initials">{entry.avatarInitials}</span>
              : null}
        </span>
        <span className="leaderboard-row__name">{name}</span>
        {!hidden && entry.handle
          ? <span className="leaderboard-row__handle">{entry.handle}</span>
          : null}
      </div>
      <div className="leaderboard-row__bar-track">
        <div className="leaderboard-row__bar-fill" style={{ width: `${widthPct}%` }} />
      </div>
    </li>
  );
}

export default function LeaderboardBlock({ leaderboard, accentColor }) {
  const { isLeaderboardSelfHidden } = useLiveScoring();
  const reactId = useId();
  if (!leaderboard || !Array.isArray(leaderboard.entries)) return null;
  const {
    title,
    entries,
    userRank,
    previousUserRank,
    boardId,
    cloneHidden = [false, false, false, false],
  } = leaderboard;
  const selfHidden = isLeaderboardSelfHidden(boardId);
  const titleId = `leaderboard-title-${boardId}-${reactId}`;

  // Map each entry to its "is this row hidden?" flag.
  // The user row is hidden when isLeaderboardSelfHidden(boardId) is true.
  // Clone rows index cloneHidden[] by their position among the 4 clones (in rank order).
  let cloneIdx = -1;
  const hiddenForEntry = entries.map((e) => {
    if (e.isUser) return selfHidden;
    cloneIdx += 1;
    return Boolean(cloneHidden[cloneIdx]);
  });

  return (
    <div
      className="leaderboard-block"
      style={{ '--post-accent': accentColor }}
    >
      <header className="leaderboard-block__head">
        <h3 id={titleId} className="leaderboard-block__title">{title}</h3>
        <DeltaChip userRank={userRank} previousUserRank={previousUserRank} />
      </header>
      <ul
        className="leaderboard-block__rows"
        aria-labelledby={titleId}
      >
        {entries.map((e, i) => (
          <Row key={e.rank} entry={e} hidden={hiddenForEntry[i]} />
        ))}
      </ul>
    </div>
  );
}
