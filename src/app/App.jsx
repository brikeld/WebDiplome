import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { flushSync } from 'react-dom';
import Sidebar from '@/layout/Sidebar.jsx';
import ScrollArea from '@/layout/ScrollArea.jsx';
import ProfileView from '@/features/profile/ProfileView.jsx';
import HomeTab from '@/features/home/HomeTab.jsx';
import DashboardTimerRow from '@/features/home/DashboardTimerRow.jsx';
import LandingPage from '@/landing-page/LandingPage.jsx';
import { LANDING_PROFILE_ENTRY_MS } from '@/landing-page/landingProfileEntry.js';
import LeaderboardsTab from '@/features/profile/tabs/LeaderboardsTab.jsx';
import {
  getPersonaScoresNormalized,
  resolveDominantPersonaKey,
} from '@/lib/profileUtils.js';
import {
  DASHBOARD_UPDATE_INTERVAL_MS,
  formatDashboardCountdown,
  getDashboardControlLayout,
} from '@/features/harvest/dashboardUpdateFlow.js';
import '@/features/harvest/harvest.css';
import DashboardPersonaRings from '@/features/home/DashboardPersonaRings.jsx';
import TellMeMorePill from '@/features/inferenceChain/TellMeMorePill.jsx';
import '@/features/inferenceChain/inferenceChain.css';
import { applyAccountDeletionFromServer } from '@/lib/liveScoringStorage.js';
import { LiveScoringProvider } from '@/features/liveScoring/LiveScoringContext.jsx';
import { PersonaBlurbsProvider } from '@/features/personaBlurbs/PersonaBlurbsContext.jsx';
import ScoreAnimator from '@/features/liveScoring/ScoreAnimator.jsx';
import { useLiveScoring } from '@/features/liveScoring/useLiveScoring.js';
import { normalizePostHideKey } from '@/lib/postHideKey.js';
import {
  canHideContentForScores,
  PERSONA_SCORE_RESTRICT_THRESHOLD,
  personaToUiKey,
  resolveHideContentPersona,
} from '@/lib/personaScoreCompliance.js';
import {
  createCompliantLowScorePost,
  createCompliantPersonaChangePost,
  findLowScorePostForPersona,
  stripLowScorePostsForPersona,
} from '@/lib/compliantSystemPosts.js';
import { markLowScoreFired } from '@/lib/compliantLowScoreStorage.js';
import {
  isCompliantPersonaChangePost,
  mergePersonaPostsFromApi,
  mergePostsPrepend,
} from '@/lib/mergePersonaPosts.js';
import { prependPersonaPosts } from '@/lib/postsApi.js';
import { resolveApiOrigin, resolveGenerateApiOrigin } from '@/lib/apiOrigin.js';
import {
  persistProfileSlug,
  readStoredProfileSlug,
  resolveOwnedLandingProfile,
  clearStoredProfileSlug,
} from '@/lib/profileSlugStorage.js';
import { selectProfileBySlug } from '@/lib/profileDirectory.js';

function selectedProfileSlug() {
  return readStoredProfileSlug();
}

const API_ORIGIN = resolveApiOrigin();
const GENERATE_API_ORIGIN = resolveGenerateApiOrigin();

const PERSONA_KEYS = ['productivity', 'security', 'popularity'];
const PERSONA_ALIASES = {
  productivity: 'productivity',
  security: 'security',
  popularity: 'popularity',
  social: 'popularity',
  productivite: 'productivity',
  securite: 'security',
  popularite: 'popularity',
};
const PERSONA_COLORS = {
  productivity: '#D8D8D8',
  security: '#759AEF',
  popularity: '#CCF847',
};
// Pastel companion colors for tell-me-more expanded panel backgrounds.
const PERSONA_PASTEL_COLORS = {
  productivity: '#EEEEEE',
  productivite: '#EEEEEE',
  security: '#BCCDF5',
  securite: '#BCCDF5',
  popularity: '#EBF8B7',
  popularite: '#EBF8B7',
  social: '#EBF8B7',
};
const PERSONA_LABELS = {
  productivity: 'Productivity',
  security: 'Security',
  popularity: 'Social',
};

function displayNameFromProfileLite(profile) {
  const first = String(profile?.firstname ?? '').trim();
  const last = String(profile?.lastname ?? '').trim();
  if (first && last) return `${first} ${last}`;
  return first || last || 'User';
}

const PERSONA_LABEL_BY_POST = {
  productivite: 'Productivity',
  securite: 'Security',
  popularite: 'Social',
  productivity: 'Productivity',
  security: 'Security',
  popularity: 'Social',
  social: 'Social',
};

function formatLastAnalysis(profile) {
  if (!profile) return null;
  const raw =
    profile?.lastAnalysis ??
    profile?.last_analysis ??
    profile?.lastAnalysisAt ??
    profile?.last_analysis_at ??
    profile?.analysisAt ??
    profile?.analysis_at ??
    profile?.updatedAt ??
    profile?.updated_at ??
    null;

  if (!raw) return null;

  const toDate = (v) => {
    if (!v) return null;
    if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
    if (typeof v === 'number') {
      const d = new Date(v);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    if (typeof v === 'string') {
      const d = new Date(v);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    return null;
  };

  const d = toDate(raw);
  if (!d) {
    // If backend already provides "3h ago"-style strings, keep them.
    return typeof raw === 'string' ? raw : String(raw);
  }

  const diffMs = Date.now() - d.getTime();
  if (diffMs <= 0) return 'just now';

  const totalSeconds = Math.floor(diffMs / 1000);
  const totalMinutes = Math.floor(diffMs / 60_000);
  const minutes = totalMinutes % 60;
  const totalHours = Math.floor(totalMinutes / 60);
  const hours = totalHours % 24;
  const days = Math.floor(totalHours / 24);
  const seconds = totalSeconds % 60;

  // Compact, always includes seconds.
  if (days >= 1) return `${days}d ${hours}h ${minutes}m ${seconds}s ago`;
  if (totalHours >= 1) return `${totalHours}h ${minutes}m ${seconds}s ago`;
  if (totalMinutes >= 1) return `${totalMinutes}m ${seconds}s ago`;
  return `${Math.max(1, totalSeconds)}s ago`;
}

/** Settled "rest" window each newly-revealed post stays in view before the next one arrives. */
const POST_REVEAL_GAP_MS = 2200;
/** Must match the entering shell animation duration in `src/styles/base.css`. */
const POST_FEED_ENTER_ANIM_MS = 700;
const INTER_REVEAL_PAUSE_MS = Math.max(POST_REVEAL_GAP_MS, POST_FEED_ENTER_ANIM_MS + 200);
const HARVEST_POLL_MS = 450;
const HARVEST_WAIT_MS = 12 * 60 * 1000;
/** How long persona delta lines stay visible (generation runs in parallel). */
const PERSONA_DELTA_DISPLAY_MS = 7000;
/** Ring score deltas (= / + / −) stay after generation finishes. */
const PERSONA_RING_DELTA_CLEAR_MS = 15_000;
const POST_GEN_IDLE = { loading: false, phase: 'idle', error: null };

function computePersonaDeltas(before, after) {
  if (!before || !after) return null;
  const keys = ['productivity', 'security', 'social'];
  const out = {};
  for (const k of keys) {
    const b = Number(before[k]);
    const a = Number(after[k]);
    if (!Number.isFinite(b) || !Number.isFinite(a)) {
      out[k] = 0;
      continue;
    }
    out[k] = Math.round(a - b);
  }
  return out;
}

/** Keep posts when API returns stale data; never drop persisted COMPLIANT system posts. */
function mergeProfileFromApi(prev, incoming) {
  if (!incoming) return prev ?? null;
  if (!prev) return incoming;
  return {
    ...incoming,
    personaPosts: mergePersonaPostsFromApi(prev.personaPosts, incoming.personaPosts),
  };
}

function AppInner({
  mainView,
  setMainView,
  activeTab,
  setActiveTab,
  profile,
  setProfile,
  allProfiles,
  personaOverride,
  setPersonaOverride,
  postGen,
  harvestPhase,
  harvestProgress,
  harvestError,
  personaDeltas,
  profileScoreReplayNonce,
  handleGeneratePersonaPosts,
}) {
  const {
    adjustedScores,
    dominantPersona: liveDominantPersona,
    scoresLoaded,
    hidePost,
    revealPost,
    hideLeaderboardSelf,
    revealLeaderboardSelf,
    isLeaderboardSelfHidden,
    isHidden,
  } = useLiveScoring();
  const [confirmingHide, setConfirmingHide] = useState(false);
  const [confirmingUnhide, setConfirmingUnhide] = useState(false);
  const [highlightedPost, setHighlightedPost] = useState(null);
  const [selectionPulseFlip, setSelectionPulseFlip] = useState(false);
  const [tellExpanded, setTellExpanded] = useState(false);
  const [tellClosing, setTellClosing] = useState(false);
  const tellCloseTimerRef = useRef(null);
  const [hideBlocked, setHideBlocked] = useState(false);
  const [viewedProfile, setViewedProfile] = useState(null);
  const previousLivePersonaRef = useRef(null);
  const previousPersonaScoresRef = useRef(null);
  const updateTimerStartRef = useRef(Date.now());
  const [updateRemainingMs, setUpdateRemainingMs] = useState(DASHBOARD_UPDATE_INTERVAL_MS);

  const profileId = useMemo(() => {
    if (!profile) return null;
    const first = String(profile.firstname ?? '').trim().toLowerCase();
    const last = String(profile.lastname ?? '').trim().toLowerCase();
    return first && last ? `${first}-${last}` : null;
  }, [profile?.firstname, profile?.lastname]);

  const prependCompliantPost = useCallback(
    (post) => {
      if (!profileId || !post) return;
      setProfile((prev) =>
        prev
          ? { ...prev, personaPosts: mergePostsPrepend([post], prev.personaPosts ?? []) }
          : prev,
      );
      prependPersonaPosts(profileId, [post]).catch((err) => {
        console.warn('[compliant] failed to persist system post:', err?.message || err);
      });
    },
    [profileId, setProfile],
  );

  const prependCompliantLowScorePost = useCallback(
    (uiPersonaKey, post) => {
      if (!profileId || !post || !uiPersonaKey) return;
      setProfile((prev) => {
        if (!prev) return prev;
        const stripped = stripLowScorePostsForPersona(prev.personaPosts ?? [], uiPersonaKey);
        return { ...prev, personaPosts: mergePostsPrepend([post], stripped) };
      });
      prependPersonaPosts(profileId, [post]).catch((err) => {
        console.warn('[compliant] failed to persist low-score post:', err?.message || err);
      });
    },
    [profileId, setProfile],
  );

  const personaKey = personaOverride ?? liveDominantPersona;
  const personaColor = PERSONA_COLORS[personaKey] ?? PERSONA_COLORS.productivity;
  const personaToggleLabel =
    personaKey === 'productivity' ? 'P' : personaKey === 'security' ? 'S' : '☺';

  // "for you" feed = every profile's posts. Swap in the live merged `profile`
  // (carries streaming reveals + client system posts) for the current user's row.
  const feedProfiles = useMemo(() => {
    const list = Array.isArray(allProfiles) ? allProfiles.filter(Boolean) : [];
    if (!profile) return list;
    const ownId = profile.slug ?? profile.id ?? null;
    let replaced = false;
    const merged = list.map((p) => {
      if (ownId != null && (p?.slug === ownId || p?.id === ownId)) {
        replaced = true;
        return profile;
      }
      return p;
    });
    if (!replaced) merged.unshift(profile);
    return merged;
  }, [allProfiles, profile]);
  const updateTimerLabel = formatDashboardCountdown(updateRemainingMs);

  useEffect(() => {
    const tick = () => {
      const elapsed = (Date.now() - updateTimerStartRef.current) % DASHBOARD_UPDATE_INTERVAL_MS;
      setUpdateRemainingMs(DASHBOARD_UPDATE_INTERVAL_MS - elapsed);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!profile || !liveDominantPersona || !scoresLoaded) return;

    const previous = previousLivePersonaRef.current;
    if (previous === null) {
      previousLivePersonaRef.current = liveDominantPersona;
      return;
    }

    if (previous === liveDominantPersona) return;

    previousLivePersonaRef.current = liveDominantPersona;

    const posts = Array.isArray(profile.personaPosts) ? profile.personaPosts : [];
    const latestChange = posts.find(isCompliantPersonaChangePost);
    if (latestChange?.compliantPersonaChange?.toPersona === liveDominantPersona) return;

    const post = createCompliantPersonaChangePost({
      profile,
      fromPersona: previous,
      toPersona: liveDominantPersona,
      userDisplayName: displayNameFromProfileLite(profile),
    });
    prependCompliantPost(post);
  }, [liveDominantPersona, profile, scoresLoaded, prependCompliantPost]);

  useEffect(() => {
    previousLivePersonaRef.current = null;
    previousPersonaScoresRef.current = null;
  }, [profileId]);

  useEffect(() => {
    if (!profileId || !profile) return;
    const posts = Array.isArray(profile.personaPosts) ? profile.personaPosts : [];
    for (const p of posts) {
      const ui = p?.compliantLowScore?.uiPersonaKey;
      if (ui) markLowScoreFired(profileId, ui);
    }
  }, [profileId, profile?.personaPosts]);

  useEffect(() => {
    if (!profile || !profileId || !scoresLoaded) return;

    const prev = previousPersonaScoresRef.current;
    const userDisplayName = displayNameFromProfileLite(profile);
    const scoreKeys = [
      { ui: 'productivity', key: 'productivity' },
      { ui: 'security', key: 'security' },
      { ui: 'popularity', key: 'social' },
    ];
    const existingPosts = Array.isArray(profile.personaPosts) ? profile.personaPosts : [];

    const ensureLowScorePost = (ui, key, prevScores) => {
      const score = Math.max(0, Math.min(100, Number(adjustedScores[key]) || 0));
      const rounded = Math.round(score);
      if (rounded >= PERSONA_SCORE_RESTRICT_THRESHOLD) return;

      const existing = findLowScorePostForPersona(existingPosts, ui);
      const existingRounded = existing
        ? Math.round(Number(existing.compliantLowScore?.score) || 0)
        : null;
      const isBaseline = prevScores === null;
      const wasAbove =
        prevScores !== null &&
        (Number(prevScores[key]) || 0) >= PERSONA_SCORE_RESTRICT_THRESHOLD;
      const scoreChanged = existingRounded !== null && existingRounded !== rounded;
      const needsPost = !existing || scoreChanged || isBaseline || wasAbove;

      if (!needsPost) {
        markLowScoreFired(profileId, ui);
        return;
      }

      prependCompliantLowScorePost(
        ui,
        createCompliantLowScorePost({
          profile,
          uiPersonaKey: ui,
          score: rounded,
          userDisplayName,
        }),
      );
      markLowScoreFired(profileId, ui);
    };

    if (prev === null) {
      for (const { ui, key } of scoreKeys) {
        ensureLowScorePost(ui, key, null);
      }
      previousPersonaScoresRef.current = {
        productivity: adjustedScores.productivity,
        security: adjustedScores.security,
        social: adjustedScores.social,
      };
      return;
    }

    for (const { ui, key } of scoreKeys) {
      ensureLowScorePost(ui, key, prev);
    }

    previousPersonaScoresRef.current = {
      productivity: adjustedScores.productivity,
      security: adjustedScores.security,
      social: adjustedScores.social,
    };
  }, [adjustedScores, profile, profileId, scoresLoaded, prependCompliantLowScorePost]);

  const cyclePersona = () => {
    const order = ['productivity', 'popularity', 'security'];
    const idx = Math.max(0, order.indexOf(personaKey));
    setPersonaOverride(order[(idx + 1) % order.length]);
  };

  // Two-phase close: keep panel mounted while exit animation plays, then unmount.
  // 220ms matches `tell-more-pill--closing` keyframe duration in inferenceChain.css.
  const closeTell = useCallback(() => {
    if (tellCloseTimerRef.current) clearTimeout(tellCloseTimerRef.current);
    setTellExpanded((wasExpanded) => {
      if (!wasExpanded) return false;
      setTellClosing(true);
      tellCloseTimerRef.current = setTimeout(() => {
        setTellExpanded(false);
        setTellClosing(false);
      }, 220);
      return true; // stay expanded for the duration of the exit animation
    });
  }, []);

  useEffect(() => () => {
    if (tellCloseTimerRef.current) clearTimeout(tellCloseTimerRef.current);
  }, []);

  const handleHighlightPost = useCallback((post) => {
    const isDeselect = highlightedPost?.id === post.id;
    setHighlightedPost(isDeselect ? null : post);
    if (!isDeselect) {
      setSelectionPulseFlip((prev) => !prev);
    }
    setConfirmingHide(false);
    setConfirmingUnhide(false);
    setHideBlocked(false);
    closeTell(); // play close animation when selection changes
  }, [highlightedPost?.id, closeTell]);

  const highlightedPostIsHidden = highlightedPost
    ? (highlightedPost.leaderboard
        ? isLeaderboardSelfHidden(highlightedPost.leaderboard.boardId)
        : isHidden(normalizePostHideKey(highlightedPost.createdAt)))
    : false;

  const highlightedPostPersonaLabel = highlightedPost
    ? (PERSONA_LABEL_BY_POST[highlightedPost.persona] ?? 'Social')
    : null;

  // Returns the bounding rect of the currently highlighted post card in the feed.
  // Used as the animation source so the scoring particle arcs from the post (left
  // column) to the persona ring (right column) — same dramatic path as comments.
  const getHighlightedPostRect = () =>
    document.querySelector('.post-card--highlighted')?.getBoundingClientRect() ?? null;

  const getPostCardRect = useCallback((postId) => {
    if (!postId) return null;
    const el = document.querySelector(`[data-post-id="${CSS.escape(String(postId))}"]`);
    return el?.getBoundingClientRect() ?? null;
  }, []);

  const getHighlightedLeaderboardSelfRect = () =>
    document
      .querySelector('.post-card--highlighted .leaderboard-row--self')
      ?.getBoundingClientRect() ??
    getHighlightedPostRect();

  const handleConfirmHide = () => {
    if (highlightedPost) {
      if (highlightedPost.leaderboard) {
        hideLeaderboardSelf(highlightedPost, getHighlightedLeaderboardSelfRect());
      } else {
        hidePost(highlightedPost, getHighlightedPostRect());
      }
    }
    setConfirmingHide(false);
    setHighlightedPost(null);
  };

  const handleConfirmUnhide = () => {
    if (highlightedPost) {
      if (highlightedPost.leaderboard) {
        revealLeaderboardSelf(highlightedPost, getPostCardRect(highlightedPost.id));
      } else {
        revealPost(highlightedPost, getPostCardRect(highlightedPost.id));
      }
    }
    setConfirmingUnhide(false);
    setHighlightedPost(null);
  };

  const handleCancelHide = () => {
    setConfirmingHide(false);
    setConfirmingUnhide(false);
    setHideBlocked(false);
  };

  const handlePostHideClick = useCallback(
    (post) => {
      if (!profile || !post) return;

      const postIsHidden = post.leaderboard
        ? isLeaderboardSelfHidden(post.leaderboard.boardId)
        : isHidden(normalizePostHideKey(post.createdAt));

      setHighlightedPost(post);
      closeTell();

      if (postIsHidden) {
        setConfirmingHide(false);
        setHideBlocked(false);
        setConfirmingUnhide(true);
        return;
      }

      setConfirmingUnhide(false);

      if (post.leaderboard && post.leaderboard.userRank == null) return;

      const hidePersona = resolveHideContentPersona(post);
      if (!canHideContentForScores(hidePersona, adjustedScores)) {
        setConfirmingHide(false);
        setHideBlocked(true);
        return;
      }

      setHideBlocked(false);
      setConfirmingHide(true);
    },
    [
      profile,
      adjustedScores,
      closeTell,
      isHidden,
      isLeaderboardSelfHidden,
    ],
  );

  const handlePostTellMeMoreClick = useCallback(
    (post) => {
      if (!post) return;
      setHighlightedPost(post);
      setHideBlocked(false);
      setConfirmingHide(false);
      setConfirmingUnhide(false);
      if (tellCloseTimerRef.current) clearTimeout(tellCloseTimerRef.current);
      setTellClosing(false);
      setTellExpanded(true);
    },
    [],
  );

  const ownProfileSlug = profile?.slug ?? profile?.id ?? null;
  const displayProfile = viewedProfile ?? profile;
  const displayPersonaKey = viewedProfile
    ? resolveDominantPersonaKey(viewedProfile)
    : personaKey;
  const displayPersonaColor = PERSONA_COLORS[displayPersonaKey] ?? PERSONA_COLORS.productivity;

  const resetProfileChrome = useCallback(() => {
    setHighlightedPost(null);
    setConfirmingHide(false);
    setConfirmingUnhide(false);
    setHideBlocked(false);
    if (tellCloseTimerRef.current) clearTimeout(tellCloseTimerRef.current);
    setTellClosing(false);
    setTellExpanded(false);
  }, []);

  const handleOpenProfile = useCallback(
    async (tab = 'profile', authorSlug = null) => {
      const targetSlug = authorSlug || ownProfileSlug;
      if (!targetSlug) {
        setMainView('landing');
        return;
      }

      if (ownProfileSlug && targetSlug === ownProfileSlug) {
        setViewedProfile(null);
        setMainView('profile');
        setActiveTab(tab);
        resetProfileChrome();
        return;
      }

      let target = (Array.isArray(allProfiles) ? allProfiles : []).find(
        (p) => p?.slug === targetSlug || p?.id === targetSlug,
      );
      if (!target) {
        try {
          const res = await fetch(
            `${API_ORIGIN}/api/profiles/${encodeURIComponent(targetSlug)}`,
          );
          if (res.ok) target = await res.json();
        } catch (e) {
          console.warn('[profile] fetch by slug failed', e?.message || e);
        }
      }
      if (!target) {
        setMainView('landing');
        return;
      }

      setViewedProfile(target);
      setMainView('profile');
      setActiveTab(tab);
      resetProfileChrome();
    },
    [allProfiles, ownProfileSlug, resetProfileChrome, setActiveTab, setMainView],
  );

  const handleSelectView = useCallback(
    (view) => {
      if (view === 'profile') {
        if (!profile) {
          setMainView('landing');
          return;
        }
        setViewedProfile(null);
      }
      setMainView(view);
    },
    [profile, setMainView],
  );

  const dashboardLayout = getDashboardControlLayout({
    harvestPhase,
    postPhase: postGen.phase,
  });
  const dashboardBusy = dashboardLayout.actionSlot !== 'timer';

  return (
    <div
      className={`page-outer persona-${personaKey} view-${mainView}`}
      style={{
        '--persona-accent': personaColor,
        '--tabs-capsule-fill': personaColor,
        '--persona-secondary': personaColor,
      }}
    >
      <ScoreAnimator />
      {mainView !== 'home' && mainView !== 'profile' && (
        <button
          type="button"
          className="persona-toggle-btn persona-toggle-btn--compact"
          aria-label="Change persona theme"
          onClick={cyclePersona}
          style={{
            borderColor: personaColor,
            backgroundColor: personaColor,
            color: '#000',
          }}
        >
          {personaToggleLabel}
        </button>
      )}
      <div className="project-name">COMPLIANT</div>
      <Sidebar mainView={mainView} onSelectView={handleSelectView} />
      <div className="page">
        {mainView === 'home' && (
          <div className="main-col">
            <ScrollArea key="home" mode="home">
              <HomeTab
                profile={profile}
                feedProfiles={feedProfiles}
                isGeneratingPosts={postGen.phase === 'generating'}
                highlightedPostId={highlightedPost?.id ?? null}
                onHighlightPost={handleHighlightPost}
                onPostHide={handlePostHideClick}
                onPostTellMeMore={handlePostTellMeMoreClick}
                tellMeMorePostId={tellExpanded ? (highlightedPost?.id ?? null) : null}
                personaBadgePersona={personaKey}
                onOpenProfile={handleOpenProfile}
              />
            </ScrollArea>
          </div>
        )}

        {mainView === 'profile' && displayProfile && (
          <ProfileView
            profile={displayProfile}
            personaColor={displayPersonaColor}
            personaBadgePersona={displayPersonaKey}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            onOpenProfile={handleOpenProfile}
            mainScoreEntryReplayKey={profileScoreReplayNonce}
            isGeneratingPosts={!viewedProfile && postGen.phase === 'generating'}
            generateApiOrigin={GENERATE_API_ORIGIN}
          />
        )}

        {mainView === 'home' && (
          <aside className="persona-side-panel" aria-label="Persona dashboard">
            <p className="dashboard-top-label">dashboard</p>
            <div
              className={`dashboard-capsule dashboard-capsule--figma${tellExpanded ? ' is-tell-expanded' : ''}${tellClosing ? ' is-tell-closing' : ''}`}
              style={(() => {
                const base = { '--persona-accent': personaColor };
                if (!tellExpanded || !highlightedPost) return base;
                const pk = String(highlightedPost.persona ?? personaKey).toLowerCase();
                return {
                  ...base,
                  '--tell-pill-accent': highlightedPost.noteColor ?? personaColor,
                  '--tell-pill-pastel':
                    PERSONA_PASTEL_COLORS[pk] ?? PERSONA_PASTEL_COLORS.security,
                };
              })()}
            >
              <DashboardTimerRow
                highlightedPost={highlightedPost}
                highlightedPostIsHidden={highlightedPostIsHidden}
                highlightedPostPersonaLabel={highlightedPostPersonaLabel}
                personaKey={personaKey}
                personaColor={personaColor}
                personaLabels={PERSONA_LABELS}
                hideBlocked={hideBlocked}
                confirmingHide={confirmingHide}
                confirmingUnhide={confirmingUnhide}
                onCancelHide={handleCancelHide}
                onConfirmHide={handleConfirmHide}
                onConfirmUnhide={handleConfirmUnhide}
                dashboardLayout={dashboardLayout}
                harvestProgress={harvestProgress}
                harvestError={harvestError}
                personaDeltas={personaDeltas}
                adjustedScores={adjustedScores}
                postGen={postGen}
                profile={profile}
                updateTimerLabel={updateTimerLabel}
                updateRemainingMs={updateRemainingMs}
                onGeneratePersonaPosts={handleGeneratePersonaPosts}
              />

              <div className="dashboard-tell-row">
                <TellMeMorePill
                  highlightedPost={highlightedPost}
                  selectionPulseFlip={selectionPulseFlip}
                  expanded={tellExpanded}
                  closing={tellClosing}
                  onExpand={() => {
                    if (tellCloseTimerRef.current) clearTimeout(tellCloseTimerRef.current);
                    setTellClosing(false);
                    setTellExpanded(true);
                  }}
                  disabled={dashboardBusy}
                  fallbackPersona={personaKey}
                />
              </div>
            </div>

              <DashboardPersonaRings
                scores={adjustedScores}
                dominantPersona={personaKey}
                deltas={personaDeltas}
                onRingClick={cyclePersona}
              />
          </aside>
        )}
      </div>
    </div>
  );
}

export default function App() {
  /** 'landing' = onboarding/intro; 'home' = feed only; 'profile' = profile capsule + tab bar + sections */
  const [mainView, setMainView] = useState('landing');
  const [activeTab, setActiveTab] = useState('posts');
  const [profile, setProfile] = useState(null);
  const [allProfiles, setAllProfiles] = useState([]);
  const [personaOverride, setPersonaOverride] = useState(null); // 'productivity' | 'popularity' | 'security' | null
  const [postGen, setPostGen] = useState(POST_GEN_IDLE);
  const [harvestPhase, setHarvestPhase] = useState('idle');
  const [harvestProgress, setHarvestProgress] = useState(null);
  const [harvestError, setHarvestError] = useState(null);
  const [personaDeltas, setPersonaDeltas] = useState(null);
  const streamPostsBaselineRef = useRef([]);
  const personaDeltasClearRef = useRef(null);
  /** Bumps when user navigates onto the profile view — drives MainScoreStyle ring replay only then. */
  const [profileScoreReplayNonce, setProfileScoreReplayNonce] = useState(0);
  const prevMainViewRef = useRef(null);
  const [landingEnteringProfile, setLandingEnteringProfile] = useState(false);
  const [landingOwnedProfile, setLandingOwnedProfile] = useState(null);
  const landingEnterProfileTimerRef = useRef(null);

  const cancelPersonaDeltasClear = useCallback(() => {
    if (personaDeltasClearRef.current) {
      clearTimeout(personaDeltasClearRef.current);
      personaDeltasClearRef.current = null;
    }
  }, []);

  const schedulePersonaDeltasClearAfterGenerate = useCallback(() => {
    cancelPersonaDeltasClear();
    personaDeltasClearRef.current = setTimeout(() => {
      setPersonaDeltas(null);
      personaDeltasClearRef.current = null;
    }, PERSONA_RING_DELTA_CLEAR_MS);
  }, [cancelPersonaDeltasClear]);

  useEffect(() => () => cancelPersonaDeltasClear(), [cancelPersonaDeltasClear]);

  useEffect(
    () => () => {
      if (landingEnterProfileTimerRef.current) {
        clearTimeout(landingEnterProfileTimerRef.current);
        landingEnterProfileTimerRef.current = null;
      }
    },
    [],
  );

  const handleLandingEnterProfile = useCallback(() => {
    const owned = landingOwnedProfile ?? profile;
    if (landingEnteringProfile || !owned) return;
    const slug = owned.slug || owned.id;
    if (slug) persistProfileSlug(slug);
    setLandingEnteringProfile(true);
    if (landingEnterProfileTimerRef.current) clearTimeout(landingEnterProfileTimerRef.current);
    landingEnterProfileTimerRef.current = setTimeout(() => {
      landingEnterProfileTimerRef.current = null;
      setLandingEnteringProfile(false);
      setMainView('home');
    }, LANDING_PROFILE_ENTRY_MS);
  }, [landingEnteringProfile, landingOwnedProfile, profile]);

  const handleLandingBrowseFeed = useCallback(() => {
    setMainView('home');
  }, []);

  useEffect(() => {
    if (mainView === 'profile' && prevMainViewRef.current !== 'profile') {
      setProfileScoreReplayNonce((n) => n + 1);
    }
    prevMainViewRef.current = mainView;
  }, [mainView]);

  // Lock body scroll in home mode; release it for profile (full-page scroll).
  useEffect(() => {
    const isHome = mainView === 'home';
    document.documentElement.style.overflowY = isHome ? 'hidden' : '';
    document.body.style.overflowY = isHome ? 'hidden' : '';
    return () => {
      document.documentElement.style.overflowY = '';
      document.body.style.overflowY = '';
    };
  }, [mainView]);

  const syncAccountDeletionState = useCallback(async () => {
    try {
      const stateRes = await fetch(`${API_ORIGIN}/api/account-state`);
      if (stateRes.ok) {
        const state = await stateRes.json();
        if (applyAccountDeletionFromServer(state?.lastDeletionAt)) {
          setProfile(null);
          setMainView('landing');
          setPersonaOverride(null);
          setPersonaDeltas(null);
          setPostGen(POST_GEN_IDLE);
          setHarvestPhase('idle');
          setHarvestError(null);
          setHarvestProgress(null);
          return true;
        }
      }
    } catch {
      /* ignore */
    }
    return false;
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (await syncAccountDeletionState()) return;

      try {
        const res = await fetch(`${API_ORIGIN}/api/profiles`);
        if (!res.ok) throw new Error('failed');
        const data = await res.json();
        if (cancelled) return;
        if (!Array.isArray(data) || data.length === 0) {
          setLandingOwnedProfile(null);
          setAllProfiles([]);
          return;
        }
        setAllProfiles(data);
        const owned = resolveOwnedLandingProfile(data);
        if (readStoredProfileSlug() && !owned) {
          clearStoredProfileSlug();
        }
        setLandingOwnedProfile(owned);
        if (owned) {
          setProfile((prev) => mergeProfileFromApi(prev, owned));
        }
      } catch {
        if (cancelled) return;
      }
    };

    load();
    // Poll quickly on landing/home so other users' newly generated posts appear in "for you".
    const pollMs = mainView === 'landing' || mainView === 'home' ? 5_000 : 30_000;
    const id = setInterval(load, pollMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [syncAccountDeletionState, mainView]);

  const reloadProfileFromApi = useCallback(async () => {
    const res = await fetch(`${API_ORIGIN}/api/profiles`);
    if (!res.ok) throw new Error('Failed to reload profile');
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    setAllProfiles(data);
    const incoming = selectProfileBySlug(data, selectedProfileSlug()) ?? data[0];
    let merged = incoming;
    setProfile((prev) => {
      merged = mergeProfileFromApi(prev, incoming);
      return merged;
    });
    return merged;
  }, []);

  const pollHarvestUntilDone = useCallback(async (scoresBefore) => {
    const start = Date.now();
    while (Date.now() - start < HARVEST_WAIT_MS) {
      const res = await fetch(`${API_ORIGIN}/api/harvest/status`);
      if (!res.ok) throw new Error('Harvest status unavailable');
      const st = await res.json();
      setHarvestProgress(st.progress ?? null);
      if (st.status === 'done') {
        const after = st.scoresAfter ?? getPersonaScoresNormalized(await reloadProfileFromApi());
        setPersonaDeltas(computePersonaDeltas(scoresBefore, after));
        await fetch(`${API_ORIGIN}/api/harvest/ack`, { method: 'POST' });
        return st;
      }
      if (st.status === 'error') {
        throw new Error(st.error || 'Harvest failed');
      }
      if (st.status === 'idle' && Date.now() - start > 8000) {
        throw new Error(
          'Desktop collector not responding. Open the Compliant app on this machine, then try again.',
        );
      }
      await new Promise((r) => setTimeout(r, HARVEST_POLL_MS));
    }
    throw new Error('Harvest timed out');
  }, [reloadProfileFromApi]);

  const runBioAndPostGeneration = useCallback(async (profileSnapshot) => {
    const p = profileSnapshot ?? profile;
    if (!p) return;
    streamPostsBaselineRef.current = Array.isArray(p.personaPosts) ? p.personaPosts : [];

    const existingBio = String(p.profileSummary || p.userDescription || '').trim();
    if (!existingBio) {
      try {
        const sumRes = await fetch(`${GENERATE_API_ORIGIN}/api/profile/generate-summary`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        if (!sumRes.ok) {
          const errText = await sumRes.text().catch(() => '');
          let msg = `Bio request failed (${sumRes.status})`;
          try {
            const j = JSON.parse(errText);
            if (j?.error) msg = j.error;
          } catch {
            if (errText) msg = errText.slice(0, 200);
          }
          throw new Error(msg);
        }
        const sumJson = await sumRes.json();
        const bio = sumJson.profileSummary ?? sumJson.userDescription ?? '';
        if (bio) {
          flushSync(() => {
            setProfile((prev) =>
              prev
                ? { ...prev, profileSummary: bio, userDescription: bio }
                : prev,
            );
          });
        }
      } catch (e) {
        setPostGen({ loading: false, phase: 'idle', error: e?.message || 'Bio generation failed' });
        return;
      }
    }

    const baseline = streamPostsBaselineRef.current;
    // Reveal in ARRIVAL order, not slotIndex order. Server stamps each post's
    // createdAt at completion, so first-arrived = oldest createdAt. Revealing
    // in arrival order means each new reveal has a strictly newer createdAt
    // than what's already shown → the sort by createdAt desc consistently
    // places the just-revealed post at the top of the feed, and matches the
    // order returned by the server after reloadProfileFromApi (no post-reveal
    // reorder snap).
    const arrivalQueue = [];
    let streamDone = false;

    const revealPromise = (async () => {
      const batch = [];
      let revealedCount = 0;
      let nextIndex = 0;

      while (true) {
        while (nextIndex >= arrivalQueue.length && !streamDone) {
          await new Promise((r) => setTimeout(r, 40));
        }
        if (nextIndex >= arrivalQueue.length) break;

        if (revealedCount > 0) {
          await new Promise((r) => setTimeout(r, INTER_REVEAL_PAUSE_MS));
        }

        const raw = arrivalQueue[nextIndex];
        nextIndex += 1;
        revealedCount += 1;

        const key =
          typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : `feed-${Date.now()}-${revealedCount}`;
        const { _feedEnter: _fe, _feedKey: _fk, ...rest } = raw;
        const post = {
          ...rest,
          _feedKey: key,
          _feedRevealSeq: revealedCount,
        };
        batch.push(post);

        const batchForProfile = batch.map((p, i) => ({
          ...p,
          _feedEnter: i === batch.length - 1,
        }));

        flushSync(() => {
          setProfile((prev) => {
            if (!prev) return prev;
            return { ...prev, personaPosts: [...batchForProfile, ...baseline] };
          });
        });
      }
    })();

    const enqueueArrivedPost = (post) => {
      if (!post || typeof post !== 'object') return;
      arrivalQueue.push(post);
    };

    try {
      const res = await fetch(`${GENERATE_API_ORIGIN}/api/posts/generate-stream`, {
        method: 'POST',
        headers: {
          Accept: 'application/x-ndjson',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        let msg = `Request failed (${res.status})`;
        try {
          const j = JSON.parse(errText);
          if (j?.error) msg = j.error;
        } catch {
          if (errText) msg = errText.slice(0, 200);
        }
        throw new Error(msg);
      }
      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response body');

      const dec = new TextDecoder();
      let buf = '';

      const processLine = (line) => {
        if (!line) return;
        let row;
        try {
          row = JSON.parse(line);
        } catch {
          return;
        }
        if (row.success === false && row.error) throw new Error(row.error);
        if (row.done) return;
        if (row.error && !row.post) throw new Error(row.error);
        if (row.post) {
          enqueueArrivedPost(row.post);
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let nl;
        while ((nl = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          processLine(line);
        }
      }

      const tail = buf.trim();
      if (tail) {
        try {
          const row = JSON.parse(tail);
          if (row.success === false && row.error) throw new Error(row.error);
          if (!row.done) {
            if (row.error && !row.post) throw new Error(row.error);
            if (row.post) enqueueArrivedPost(row.post);
          }
        } catch (e) {
          if (e instanceof SyntaxError) {
            /* ignore trailing garbage */
          } else {
            throw e;
          }
        }
      }

      streamDone = true;
      await revealPromise;
      await reloadProfileFromApi();
      setPostGen(POST_GEN_IDLE);
      schedulePersonaDeltasClearAfterGenerate();
    } catch (e) {
      streamDone = true;
      await revealPromise.catch(() => {});
      setPostGen({ loading: false, phase: 'idle', error: e?.message || 'Generation failed' });
      schedulePersonaDeltasClearAfterGenerate();
    }
  }, [profile, reloadProfileFromApi, schedulePersonaDeltasClearAfterGenerate]);

  // Keep a stable ref so the auto-trigger effect below doesn't re-run when
  // runBioAndPostGeneration re-memoizes (it has `profile` in its deps).
  const runBioAndPostGenerationRef = useRef(runBioAndPostGeneration);
  useEffect(() => {
    runBioAndPostGenerationRef.current = runBioAndPostGeneration;
  }, [runBioAndPostGeneration]);

  // Track which profile ID has already had auto-generation triggered so we
  // never fire twice for the same profile (even if posts get cleared later).
  const autoPostGenProfileIdRef = useRef(null);

  // Auto-trigger the first-time post generation: when Electron syncs a new
  // profile that has a bio but no posts yet, kick off the streaming reveal
  // flow here so posts arrive with animation and inference-chain data intact.
  useEffect(() => {
    if (!profile || postGen.loading || harvestPhase !== 'idle') return;
    const profileId = [profile.firstname, profile.lastname]
      .filter(Boolean).join('-').toLowerCase();
    if (!profileId || autoPostGenProfileIdRef.current === profileId) return;
    const hasBio = String(profile.profileSummary || profile.userDescription || '').trim().length > 0;
    const hasPosts = Array.isArray(profile.personaPosts) && profile.personaPosts.length > 0;
    if (!hasBio || hasPosts) return;
    autoPostGenProfileIdRef.current = profileId;
    setPostGen({ loading: true, phase: 'generating', error: null });
    runBioAndPostGenerationRef.current(profile);
  }, [profile, postGen.loading, harvestPhase]);

  const handleGeneratePersonaPosts = async () => {
    if (postGen.loading || harvestPhase === 'harvesting' || !profile) return;

    cancelPersonaDeltasClear();
    const scoresBefore = getPersonaScoresNormalized(profile);
    setHarvestError(null);
    setHarvestProgress(null);
    setHarvestPhase('harvesting');

    try {
      const reqRes = await fetch(`${API_ORIGIN}/api/harvest/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scoresBefore, dynamicOnly: true }),
      });
      if (!reqRes.ok) {
        const errText = await reqRes.text().catch(() => '');
        let msg = `Harvest request failed (${reqRes.status})`;
        try {
          const j = JSON.parse(errText);
          if (j?.error) msg = j.error;
        } catch {
          if (errText) msg = errText.slice(0, 200);
        }
        throw new Error(msg);
      }

      await pollHarvestUntilDone(scoresBefore);
      await reloadProfileFromApi();
    } catch (e) {
      setHarvestError(e?.message || 'Harvest failed');
      setHarvestPhase('idle');
      setPostGen({ loading: false, phase: 'idle', error: e?.message || 'Harvest failed' });
      try {
        await fetch(`${API_ORIGIN}/api/harvest/ack`, { method: 'POST' });
      } catch {
        /* ignore */
      }
      return;
    }

    setHarvestPhase('idle');
    setHarvestProgress(null);
    const freshProfile = await reloadProfileFromApi();
    const scoresAfter = getPersonaScoresNormalized(freshProfile ?? {});
    setPersonaDeltas(computePersonaDeltas(scoresBefore, scoresAfter));

    setPostGen({ loading: true, phase: 'deltas', error: null });
    const generationPromise = runBioAndPostGeneration(freshProfile);

    await new Promise((r) => setTimeout(r, PERSONA_DELTA_DISPLAY_MS));

    setPostGen((prev) => {
      if (!prev.loading || prev.phase !== 'deltas') return prev;
      return { ...prev, phase: 'generating' };
    });

    await generationPromise;
  };

  if (mainView === 'landing') {
    return (
      <>
        <LandingPage
          profile={landingOwnedProfile ?? profile}
          onEnterProfile={handleLandingEnterProfile}
          onBrowseFeed={handleLandingBrowseFeed}
          profileEntryLoading={landingEnteringProfile}
        />
      </>
    );
  }

  return (
    <LiveScoringProvider profile={profile}>
      <PersonaBlurbsProvider profile={profile}>
        <AppInner
          mainView={mainView}
          setMainView={setMainView}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          profile={profile}
          setProfile={setProfile}
          allProfiles={allProfiles}
          personaOverride={personaOverride}
          setPersonaOverride={setPersonaOverride}
          postGen={postGen}
          harvestPhase={harvestPhase}
          harvestProgress={harvestProgress}
          harvestError={harvestError}
          personaDeltas={personaDeltas}
          profileScoreReplayNonce={profileScoreReplayNonce}
          handleGeneratePersonaPosts={handleGeneratePersonaPosts}
        />
      </PersonaBlurbsProvider>
    </LiveScoringProvider>
  );
}
