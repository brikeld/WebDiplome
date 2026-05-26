import { useId } from 'react';
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

function Row({ entry }) {
  const cls = `leaderboard-row${entry.isUser ? ' leaderboard-row--self' : ''}`;
  // Assumes 5-entry board: rank 1 → 100%, rank 5 → 20%. Out-of-range ranks would underflow or overflow.
  const widthPct = ((6 - entry.rank) / 5) * 100;
  return (
    <li className={cls}>
      <div className="leaderboard-row__header">
        <span className="leaderboard-row__rank">{String(entry.rank).padStart(2, '0')}</span>
        <span className="leaderboard-row__avatar" aria-hidden>
          {entry.avatarSrc
            ? <img className="leaderboard-row__avatar-img" src={entry.avatarSrc} alt="" />
            : <span className="leaderboard-row__avatar-initials">{entry.avatarInitials}</span>}
        </span>
        <span className="leaderboard-row__name">{entry.name}</span>
        <span className="leaderboard-row__handle">{entry.handle}</span>
      </div>
      <div className="leaderboard-row__bar-track">
        <div className="leaderboard-row__bar-fill" style={{ width: `${widthPct}%` }} />
      </div>
    </li>
  );
}

export default function LeaderboardBlock({ leaderboard, accentColor }) {
  if (!leaderboard || !Array.isArray(leaderboard.entries)) return null;
  const { title, entries, userRank, previousUserRank, boardId } = leaderboard;
  const reactId = useId();
  const titleId = `leaderboard-title-${boardId}-${reactId}`;

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
        {entries.map((e) => <Row key={e.rank} entry={e} />)}
      </ul>
    </div>
  );
}
