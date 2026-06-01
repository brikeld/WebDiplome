import { useMemo, useState } from 'react';
import './profileOverview.css';
import { buildProfileOverviewData } from '@/lib/profileOverviewData.js';
import { normalizePostHideKey } from '@/lib/postHideKey.js';
import { useLiveScoring } from '@/features/liveScoring/useLiveScoring.js';
import PoCard from './components/PoCard.jsx';
import ScoreDrift from './components/ScoreDrift.jsx';
import ActivityPatterns from './components/ActivityPatterns.jsx';
import TechStack from './components/TechStack.jsx';
import NetworkTrace from './components/NetworkTrace.jsx';
import SecurityStatus from './components/SecurityStatus.jsx';
import LocationInference from './components/LocationInference.jsx';
import DigitalEnvironment from './components/DigitalEnvironment.jsx';
import HarvestFreshness from './components/HarvestFreshness.jsx';
import PostFootprint from './components/PostFootprint.jsx';
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

  const [open, setOpen] = useState({ activity: true, tech: true, drift: true });

  if (!profileData) {
    return <p className="po-empty">No profile loaded.</p>;
  }

  const dom = profileData.dominantPersona;
  const toggle = (key) => setOpen((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className="po-stack" style={{ '--persona-accent': profileData.personaAccent }}>
      <PoCard
        eyebrow="Live vs harvest"
        title="Score drift"
        persona="security"
        mode="expand"
        expanded={!!open.drift}
        onToggle={() => toggle('drift')}
      >
        <ScoreDrift scoreDrift={profileData.scoreDrift} expanded={!!open.drift} />
      </PoCard>

      <PoCard
        eyebrow="When"
        title="Activity patterns"
        persona="productivity"
        mode="expand"
        expanded={!!open.activity}
        onToggle={() => toggle('activity')}
      >
        <ActivityPatterns
          activity={profileData.activity}
          lastActivity={profileData.profile.last_activity}
          dominantPersona={dom}
          expanded={!!open.activity}
        />
      </PoCard>

      <PoCard
        eyebrow="Feed"
        title="Post footprint"
        persona="popularity"
        mode="static"
        className="po-card--footprint"
      >
        <PostFootprint postFootprint={postFootprint} />
      </PoCard>

      <PoCard
        eyebrow="Desktop"
        title="Digital environment"
        persona="productivity"
        mode="static"
        className="po-card--env"
      >
        <DigitalEnvironment
          environment={profileData.environment}
          storage={profileData.storage}
        />
      </PoCard>

      <div className="po-grid">
        <PoCard
          eyebrow="What you run"
          title="Tech stack"
          persona="productivity"
          mode="expand"
          expanded={!!open.tech}
          onToggle={() => toggle('tech')}
        >
          <TechStack techStack={profileData.tech_stack} dominantPersona={dom} expanded={!!open.tech} />
        </PoCard>

        <PoCard
          eyebrow="Sync"
          title="Harvest freshness"
          persona="security"
          mode="expand"
          expanded={!!open.harvest}
          onToggle={() => toggle('harvest')}
        >
          <HarvestFreshness harvest={profileData.harvest} expanded={!!open.harvest} />
        </PoCard>

        <PoCard
          eyebrow="Connectivity"
          title="Network trace"
          persona="security"
          mode="expand"
          expanded={!!open.network}
          onToggle={() => toggle('network')}
        >
          <NetworkTrace network={profileData.network} dominantPersona="security" expanded={!!open.network} />
        </PoCard>

        <PoCard
          eyebrow="Protection"
          title="Security status"
          persona="security"
          mode="static"
        >
          <SecurityStatus security={profileData.security} variant="detail" />
        </PoCard>

        <PoCard
          eyebrow="Where"
          title="Location inference"
          persona="security"
          mode="expand"
          expanded={!!open.location}
          onToggle={() => toggle('location')}
        >
          <LocationInference
            identity={profileData.identity}
            behavioral={profileData.behavioral}
            dominantPersona="security"
            expanded={!!open.location}
          />
        </PoCard>
      </div>
    </div>
  );
}
