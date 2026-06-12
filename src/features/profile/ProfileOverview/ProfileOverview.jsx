import { useMemo } from 'react';
import './profileOverview.css';
import { buildProfileOverviewData } from '@/lib/profileOverviewData.js';
import { normalizePostHideKey } from '@/lib/postHideKey.js';
import { useLiveScoring } from '@/features/liveScoring/useLiveScoring.js';
import PoCard from './components/PoCard.jsx';
import ScoreDrift from './components/ScoreDrift.jsx';
import RecentActivity from './components/RecentActivity.jsx';
import TechStack from './components/TechStack.jsx';
import NetworkTrace from './components/NetworkTrace.jsx';
import SecurityStatus from './components/SecurityStatus.jsx';
import LocationInference from './components/LocationInference.jsx';
import DigitalEnvironment from './components/DigitalEnvironment.jsx';
import HarvestFreshness from './components/HarvestFreshness.jsx';
import PostFootprint from './components/PostFootprint.jsx';

function hasValues(obj) {
  return Object.values(obj ?? {}).some(
    (v) => v != null && v !== '' && (!Array.isArray(v) || v.length > 0),
  );
}

export default function ProfileOverview({ profile }) {
  const { adjustedScores, dominantPersona, isHidden, isLeaderboardSelfHidden } = useLiveScoring();

  const profileData = useMemo(
    () => buildProfileOverviewData(profile, { adjustedScores, dominantPersona }),
    [profile, adjustedScores, dominantPersona],
  );

  const postFootprint = useMemo(() => {
    const base = profileData?.postFootprint ?? {};
    const posts = profile?.personaPosts ?? profile?.persona_posts ?? [];
    let hiddenPosts = 0;
    let totalRankings = 0;
    let hiddenRankings = 0;
    const seenBoards = new Set();

    posts.forEach((post, index) => {
      const hideKey = normalizePostHideKey(post?.createdAt ?? post?.created_at);
      if (hideKey && isHidden(hideKey)) hiddenPosts += 1;

      const board = post?.leaderboard;
      if (!board || typeof board !== 'object') return;

      const rank = Number(board.userRank ?? board.user_rank);
      const hasUserRank = Number.isFinite(rank);
      const hasUserEntry =
        Array.isArray(board.entries) && board.entries.some((entry) => entry?.isUser);
      if (!hasUserRank && !hasUserEntry) return;

      const boardId = String(board.boardId ?? board.board_id ?? `leaderboard-${index}`);
      if (seenBoards.has(boardId)) return;
      seenBoards.add(boardId);
      totalRankings += 1;
      if (isLeaderboardSelfHidden(boardId)) hiddenRankings += 1;
    });

    return {
      ...base,
      hiddenPosts,
      totalRankings,
      hiddenRankings,
      visibleRankings: totalRankings - hiddenRankings,
    };
  }, [profileData?.postFootprint, profile, isHidden, isLeaderboardSelfHidden]);

  if (!profileData) {
    return <p className="po-empty">No profile loaded.</p>;
  }

  const { environment, storage, battery, memory, security, activity, techStack, network, location, harvest } =
    profileData;
  const showEnvironment = hasValues(environment) || storage || battery || memory;
  const showActivity = hasValues(activity);
  const showTech = hasValues(techStack);
  const showNetwork = hasValues(network);
  const showLocation = hasValues(location);
  const showHarvest = hasValues(harvest);

  return (
    <div className="po-stack" style={{ '--persona-accent': profileData.personaAccent }}>
      <PoCard eyebrow="Live vs harvest" title="Score drift" persona="security">
        <ScoreDrift scoreDrift={profileData.scoreDrift} />
      </PoCard>

      {showEnvironment ? (
        <PoCard
          eyebrow="Desktop"
          title="Digital environment"
          persona="productivity"
          meta={environment.machineModel ?? undefined}
        >
          <DigitalEnvironment
            environment={environment}
            storage={storage}
            battery={battery}
            memory={memory}
          />
        </PoCard>
      ) : null}

      <PoCard
        eyebrow="Feed"
        title="Post footprint"
        persona="popularity"
        meta={postFootprint.total ? `${postFootprint.total} posts` : undefined}
      >
        <PostFootprint postFootprint={postFootprint} />
      </PoCard>

      <div className="po-columns">
        {showActivity ? (
          <PoCard eyebrow="When" title="Recent activity" persona="productivity">
            <RecentActivity activity={activity} lastActivity={profileData.profile.last_activity} />
          </PoCard>
        ) : null}

        {showTech ? (
          <PoCard
            eyebrow="What you run"
            title="Tech stack"
            persona="productivity"
            meta={techStack.installedCount != null ? `${techStack.installedCount} apps` : undefined}
          >
            <TechStack techStack={techStack} />
          </PoCard>
        ) : null}

        {showNetwork ? (
          <PoCard
            eyebrow="Connectivity"
            title="Network trace"
            persona="security"
            meta={network.wifiCount != null ? `${network.wifiCount} networks` : undefined}
          >
            <NetworkTrace network={network} />
          </PoCard>
        ) : null}

        {security ? (
          <PoCard eyebrow="Protection" title="Security status" persona="security">
            <SecurityStatus security={security} />
          </PoCard>
        ) : null}

        {showLocation ? (
          <PoCard eyebrow="Where" title="Location inference" persona="security">
            <LocationInference location={location} />
          </PoCard>
        ) : null}

        {showHarvest ? (
          <PoCard eyebrow="Sync" title="Harvest freshness" persona="security">
            <HarvestFreshness harvest={harvest} />
          </PoCard>
        ) : null}
      </div>
    </div>
  );
}
