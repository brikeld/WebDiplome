import { useId } from 'react';
import { useLiveScoring } from '@/features/liveScoring/useLiveScoring.js';
import { mapLeaderboardEntryHiddenFlags } from '@/lib/leaderboardEntryVisibility.js';
import ProfileAvatarLink from '@/features/profile/ProfileAvatarLink.jsx';
import ProfileNameLink from '@/features/profile/ProfileNameLink.jsx';
import { leaderboardEntryProfileSlug } from '@/lib/leaderboardProfileSlug.js';
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

function formatLeaderboardTitle(title) {
  const text = String(title ?? '').trim();
  const match = text.match(/^top\s+5\s+(.+)$/i);
  if (match) return `TOP 5 - ${match[1].toUpperCase()}`;
  return text.toUpperCase();
}

function Row({ entry, hidden, revealing, authorSlug, onOpenProfile, directorySlugs }) {
  const cls = [
    'leaderboard-row',
    entry.isUser ? 'leaderboard-row--self' : '',
    hidden ? 'leaderboard-row--hidden' : '',
    revealing ? 'leaderboard-row--revealing' : '',
  ].filter(Boolean).join(' ');
  // Assumes 5-entry board: rank 1 → 100%, rank 5 → 20%.
  const widthPct = ((6 - entry.rank) / 5) * 100;
  const name = entry.name;
  const entrySlug = leaderboardEntryProfileSlug(entry, authorSlug, directorySlugs);
  const openEntryProfile =
    onOpenProfile && entrySlug ? () => onOpenProfile('profile', entrySlug) : undefined;
  return (
    <li className={cls} data-source={entry.source || 'real'} aria-current={entry.isUser ? 'true' : undefined}>
      <div className="leaderboard-row__header">
        <span className="leaderboard-row__rank">{String(entry.rank).padStart(2, '0')}</span>
        <ProfileAvatarLink
          className="leaderboard-row__avatar"
          imgClassName="leaderboard-row__avatar-img"
          initialsClassName="leaderboard-row__avatar-initials"
          onOpenProfile={openEntryProfile}
          ariaLabel={entry.isUser ? 'View your profile' : `View ${name}'s profile`}
          avatarSrc={entry.source === 'bot' ? null : (entry.avatarSrc || null)}
          avatarInitials={entry.source === 'bot' ? entry.avatarInitials : null}
        />
        <ProfileNameLink
          className="leaderboard-row__name"
          onOpenProfile={hidden ? undefined : openEntryProfile}
          ariaLabel={entry.isUser ? 'View your profile' : `View ${name}'s profile`}
        >
          {name}
        </ProfileNameLink>
        {entry.handle
          ? <span className="leaderboard-row__handle">{entry.handle}</span>
          : null}
      </div>
      <div className="leaderboard-row__bar-track">
        <div className="leaderboard-row__bar-fill" style={{ width: `${widthPct}%` }} />
      </div>
    </li>
  );
}

export default function LeaderboardBlock({
  leaderboard,
  accentColor,
  authorSlug,
  onOpenProfile,
  leaderboardDirectorySlugs = [],
}) {
  const { isLeaderboardSelfHidden, isLeaderboardSelfRevealing } = useLiveScoring();
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
  const selfRevealing = isLeaderboardSelfRevealing(boardId);
  const titleId = `leaderboard-title-${boardId}-${reactId}`;

  const hiddenForEntry = mapLeaderboardEntryHiddenFlags(entries, {
    selfHidden,
    cloneHidden,
  });
  const directorySlugs = new Set(
    (Array.isArray(leaderboardDirectorySlugs) ? leaderboardDirectorySlugs : [])
      .map((s) => String(s ?? '').trim())
      .filter(Boolean),
  );

  return (
    <div
      className="leaderboard-block"
      style={{ '--post-accent': accentColor }}
    >
      <header className="leaderboard-block__head">
        <h3 id={titleId} className="leaderboard-block__title">{formatLeaderboardTitle(title)}</h3>
        <DeltaChip userRank={userRank} previousUserRank={previousUserRank} />
      </header>
      <ul
        className="leaderboard-block__rows"
        aria-labelledby={titleId}
      >
        {entries.map((e, i) => (
          <Row
            key={e.rank}
            entry={e}
            hidden={hiddenForEntry[i]}
            revealing={e.isUser && selfRevealing}
            onOpenProfile={onOpenProfile}
            authorSlug={authorSlug}
            directorySlugs={directorySlugs}
          />
        ))}
      </ul>
    </div>
  );
}
