import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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
  getDashboardCountdownNextRemaining,
  getDashboardControlLayout,
  shouldAutoTriggerDashboardUpdate,
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
  stripLowScorePostsForPersona,
} from '@/lib/compliantSystemPosts.js';
import { markLowScoreFired, loadLowScoreFiredPersonas } from '@/lib/compliantLowScoreStorage.js';
import {
  isCompliantPersonaChangePost,
  mergePersonaPostsFromApi,
  mergePostsPrepend,
} from '@/lib/mergePersonaPosts.js';
import { prependPersonaPosts } from '@/lib/postsApi.js';
import { resolveApiOrigin, resolveGenerateApiOrigin } from '@/lib/apiOrigin.js';
import { inferPublicMediaConfigFromProfiles } from '@/lib/publicMediaConfig.js';
import {
  ingestProfileAvatars,
  normalizeProfilesFromApi,
} from '@/lib/publicAvatarRegistry.js';
import { isHostedApiOrigin } from '@/lib/aiJobClient.js';
import { createFeedSpectatorRevealController } from '@/lib/feedSpectatorReveals.js';
import { runHostedPostGenerationWithReveal } from '@/lib/hostedPostGeneration.js';
import {
  attachApiPersonaPosts,
  mergeProfilePreservePosts,
} from '@/lib/profileReload.js';
import { isCompliantSystemPost } from '@/lib/mergePersonaPosts.js';
import {
  createPostFeedRevealQueue,
  POST_REVEAL_GAP_MS,
  sleep as feedRevealSleep,
  stripFeedRevealMetaFromPosts,
} from '@/lib/postFeedRevealQueue.js';
import {
  createOrderedSlotRevealBuffer,
  personaAfterReveal,
} from '@/lib/orderedSlotReveal.js';
import {
  filterProfilesNotDeleted,
  isProfileSlugDeleted,
  purgeClientAccountState,
  slugsReferToSameAccount,
} from '@/lib/accountDeletionClient.js';
import {
  buildCompliantJoinPostForProfile,
  profileNeedsCompliantJoin,
} from '@/lib/ensureCompliantJoin.js';
import {
  canUseHostedAccountFeatures,
  clearHostedAccountStorage,
  fetchLinkedProfile,
  hostedAuthHeaders,
  ingestHostedSessionFromHash,
  readHostedSession,
  readLinkedProfileSlug,
  resolveOwnedProfileForFeatures,
  shouldResetHostedSessionForProfileMeStatus,
} from '@/lib/hostedAccount.js';
import {
  persistProfileSlug,
  readStoredProfileSlug,
  resolveOwnedLandingProfile,
  clearStoredProfileSlug,
} from '@/lib/profileSlugStorage.js';
import { selectProfileBySlug } from '@/lib/profileDirectory.js';
import { canManuallyGenerateDashboardUpdate } from '@/lib/adminProfile.js';
import { mergeSummaryAndFeedProfiles } from '@/lib/publicFeedMerge.js';

function selectedProfileSlug() {
  return readStoredProfileSlug();
}

const API_ORIGIN = resolveApiOrigin();
const GENERATE_API_ORIGIN = resolveGenerateApiOrigin();
const PUBLIC_DIRECTORY_POLL_MS = 30_000;
const PUBLIC_FEED_POLL_MS = 30_000;
const PUBLIC_FEED_LIMIT = 20;

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

const HARVEST_POLL_MS = 450;
const HARVEST_WAIT_MS = 12 * 60 * 1000;
/** How long persona delta lines stay visible (generation runs in parallel). */
const PERSONA_DELTA_DISPLAY_MS = 7000;
/** Ring score deltas (= / + / −) stay after generation finishes. */
const PERSONA_RING_DELTA_CLEAR_MS = 15_000;
const POST_GEN_IDLE = {
  loading: false,
  phase: 'idle',
  error: null,
  generatingPersona: null,
  generationPlan: null,
};

function sleep(ms) {
  return feedRevealSleep(ms);
}

function isFeedGenerationPhase(phase) {
  return phase === 'generating';
}

async function fetchPublicDirectorySnapshot({ includeFeed = false } = {}) {
  try {
    const summaryRes = await fetch(`${API_ORIGIN}/api/profiles/summary`, { cache: 'no-store' });
    if (!summaryRes.ok) throw new Error(`Profile summary failed (${summaryRes.status})`);
    const summaries = await summaryRes.json();
    let feedProfiles = [];
    if (includeFeed) {
      const feedRes = await fetch(`${API_ORIGIN}/api/feed?limit=${PUBLIC_FEED_LIMIT}`, {
        cache: 'no-store',
      });
      if (feedRes.ok) {
        const feed = await feedRes.json().catch(() => ({}));
        feedProfiles = Array.isArray(feed?.profiles) ? feed.profiles : [];
      }
    }
    return mergeSummaryAndFeedProfiles(summaries, feedProfiles);
  } catch {
    const fallback = await fetch(`${API_ORIGIN}/api/profiles`, { cache: 'no-store' });
    if (!fallback.ok) throw new Error('failed');
    return fallback.json();
  }
}

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

/** Poll/harvest reload: server post list is authoritative unless a generation session is active. */
function adoptProfileFromApi(prev, incoming, { preserveClientPosts = false } = {}) {
  if (!incoming) return prev ?? null;
  if (preserveClientPosts && prev) return mergeProfilePreservePosts(prev, incoming);
  return {
    ...incoming,
    personaPosts: Array.isArray(incoming.personaPosts) ? incoming.personaPosts : [],
  };
}

function mergeOwnedProfileFromApi(prev, incoming, { preserveClientPosts = false } = {}) {
  if (!incoming) return prev ?? null;
  if (!prev) return incoming;
  if (preserveClientPosts) {
    return mergeProfilePreservePosts(prev, incoming);
  }
  return adoptProfileFromApi(prev, incoming);
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
  bumpProfileEntryReplay,
  handleGeneratePersonaPosts,
  linkedProfileSlug,
  tryDeferCompliant,
  updateSessionActive,
  postRevealFlash,
  deletedProfileIds = [],
  accountResetKey = 0,
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
  const [tellExpanded, setTellExpanded] = useState(false);
  const [tellClosing, setTellClosing] = useState(false);
  const tellCloseTimerRef = useRef(null);
  const tellThemePostRef = useRef(null);
  const [hideBlocked, setHideBlocked] = useState(false);
  const [personaRingWiggle, setPersonaRingWiggle] = useState({ key: null, nonce: 0 });
  const [viewedProfile, setViewedProfile] = useState(null);
  const previousLivePersonaRef = useRef(null);
  const previousPersonaScoresRef = useRef(null);
  const joinEnsureAttemptedRef = useRef(false);
  const updateTimerLastTickRef = useRef(Date.now());
  const autoDashboardGenerateRef = useRef(false);
  const [updateRemainingMs, setUpdateRemainingMs] = useState(DASHBOARD_UPDATE_INTERVAL_MS);

  const profileId = useMemo(() => {
    if (!profile) return null;
    if (isHostedApiOrigin()) {
      return profile.slug ?? profile.id ?? null;
    }
    const first = String(profile.firstname ?? '').trim().toLowerCase();
    const last = String(profile.lastname ?? '').trim().toLowerCase();
    return first && last ? `${first}-${last}` : null;
  }, [profile?.slug, profile?.id, profile?.firstname, profile?.lastname]);

  const prependCompliantPost = useCallback(
    (post) => {
      if (!profileId || !post) return;
      const apply = () => {
        setProfile((prev) =>
          prev
            ? { ...prev, personaPosts: mergePostsPrepend([post], prev.personaPosts ?? []) }
            : prev,
        );
        prependPersonaPosts(profileId, [post]).catch((err) => {
          console.warn('[compliant] failed to persist system post:', err?.message || err);
        });
      };
      if (tryDeferCompliant?.(apply)) return;
      apply();
    },
    [profileId, setProfile, tryDeferCompliant],
  );

  const prependCompliantLowScorePost = useCallback(
    (uiPersonaKey, post) => {
      if (!profileId || !post || !uiPersonaKey) return;
      const apply = () => {
        setProfile((prev) => {
          if (!prev) return prev;
          const stripped = stripLowScorePostsForPersona(prev.personaPosts ?? [], uiPersonaKey);
          return { ...prev, personaPosts: mergePostsPrepend([post], stripped) };
        });
        prependPersonaPosts(profileId, [post]).catch((err) => {
          console.warn('[compliant] failed to persist low-score post:', err?.message || err);
        });
      };
      if (tryDeferCompliant?.(apply)) return;
      apply();
    },
    [profileId, setProfile, tryDeferCompliant],
  );

  const personaKey = personaOverride ?? liveDominantPersona;
  const personaColor = PERSONA_COLORS[personaKey] ?? PERSONA_COLORS.productivity;
  const personaToggleLabel =
    personaKey === 'productivity' ? 'P' : personaKey === 'security' ? 'S' : '☺';

  // "for you" feed = every profile's posts. Swap in the live merged `profile`
  // (carries streaming reveals + client system posts) for the current user's row.
  const feedProfiles = useMemo(() => {
    const list = filterProfilesNotDeleted(
      Array.isArray(allProfiles) ? allProfiles.filter(Boolean) : [],
      deletedProfileIds,
    );
    const ownSlug = profile?.slug ?? profile?.id ?? null;
    if (ownSlug && isProfileSlugDeleted(ownSlug, deletedProfileIds)) {
      return list;
    }
    if (!profile) return list;
    const ownId = ownSlug;
    const inDirectory = list.some(
      (p) => ownId != null && (p?.slug === ownId || p?.id === ownId),
    );
    // Stale in-memory profile after delete — do not inject ghost posts into "for you".
    if (!inDirectory) return list;
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
  }, [allProfiles, profile, deletedProfileIds]);
  const updateTimerLabel = formatDashboardCountdown(updateRemainingMs);

  const accountFeaturesEnabled = useMemo(() => {
    const owned = resolveOwnedProfileForFeatures(profile, allProfiles, linkedProfileSlug);
    return canUseHostedAccountFeatures(owned, linkedProfileSlug, {
      viewedProfile,
      allProfiles,
    });
  }, [profile, allProfiles, linkedProfileSlug, viewedProfile]);

  const viewerProfile = useMemo(() => {
    if (!accountFeaturesEnabled) return null;
    return resolveOwnedProfileForFeatures(profile, allProfiles, linkedProfileSlug);
  }, [accountFeaturesEnabled, profile, allProfiles, linkedProfileSlug]);

  const manualDashboardGenerateEnabled = canManuallyGenerateDashboardUpdate(viewerProfile ?? profile);
  const dashboardTimerActive =
    mainView === 'home'
    && Boolean(profile)
    && accountFeaturesEnabled
    && !updateSessionActive
    && !postGen.loading
    && harvestPhase !== 'harvesting';

  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      const elapsed = now - updateTimerLastTickRef.current;
      updateTimerLastTickRef.current = now;
      const visible = typeof document === 'undefined' || document.visibilityState === 'visible';
      setUpdateRemainingMs((prev) =>
        getDashboardCountdownNextRemaining(prev, elapsed, {
          active: dashboardTimerActive,
          visible,
        }),
      );
    };
    updateTimerLastTickRef.current = Date.now();
    const id = setInterval(tick, 1000);
    const handleVisibility = () => {
      updateTimerLastTickRef.current = Date.now();
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibility);
    }
    return () => {
      clearInterval(id);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibility);
      }
    };
  }, [dashboardTimerActive]);

  useEffect(() => {
    if (updateRemainingMs > 0) {
      autoDashboardGenerateRef.current = false;
      return;
    }
    if (autoDashboardGenerateRef.current) return;
    if (
      !shouldAutoTriggerDashboardUpdate({
        remainingMs: updateRemainingMs,
        timerActive: dashboardTimerActive,
        accountFeaturesEnabled,
        postLoading: postGen.loading,
        harvestPhase,
      })
    ) {
      return;
    }
    autoDashboardGenerateRef.current = true;
    setUpdateRemainingMs(DASHBOARD_UPDATE_INTERVAL_MS);
    handleGeneratePersonaPosts();
  }, [
    updateRemainingMs,
    dashboardTimerActive,
    accountFeaturesEnabled,
    postGen.loading,
    harvestPhase,
    handleGeneratePersonaPosts,
  ]);

  const handleDashboardGenerateClick = useCallback(() => {
    if (!manualDashboardGenerateEnabled) return;
    autoDashboardGenerateRef.current = false;
    setUpdateRemainingMs(DASHBOARD_UPDATE_INTERVAL_MS);
    handleGeneratePersonaPosts();
  }, [manualDashboardGenerateEnabled, handleGeneratePersonaPosts]);

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
    if (updateSessionActive || postGen.loading) return;

    const prev = previousPersonaScoresRef.current;
    const userDisplayName = displayNameFromProfileLite(profile);
    const scoreKeys = [
      { ui: 'productivity', key: 'productivity' },
      { ui: 'security', key: 'security' },
      { ui: 'popularity', key: 'social' },
    ];
    // Personas that have already been reminded (persisted across sessions).
    // A reminder fires once per genuine above→below crossing; while a persona
    // stays below the threshold we do NOT keep re-adding the notice (that was
    // the disappear/reappear flicker after each generation). It is fine for the
    // notice to not be visible — we just never nag with a duplicate.
    const firedPersonas = loadLowScoreFiredPersonas(profileId);

    const ensureLowScorePost = (ui, key, prevScores) => {
      const score = Math.max(0, Math.min(100, Number(adjustedScores[key]) || 0));
      const rounded = Math.round(score);
      if (rounded >= PERSONA_SCORE_RESTRICT_THRESHOLD) return;

      const wasAbove =
        prevScores !== null &&
        (Number(prevScores[key]) || 0) >= PERSONA_SCORE_RESTRICT_THRESHOLD;
      const alreadyFired = firedPersonas.includes(ui);

      // Fire on a fresh drop (was above, now below) or the very first time we
      // ever observe this persona below threshold. Otherwise stay silent.
      const needsPost = wasAbove || !alreadyFired;
      if (!needsPost) return;

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
  }, [
    adjustedScores,
    profile,
    profileId,
    scoresLoaded,
    postGen.loading,
    updateSessionActive,
    prependCompliantLowScorePost,
  ]);

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

  useEffect(() => {
    if (highlightedPost) tellThemePostRef.current = highlightedPost;
  }, [highlightedPost]);

  const tellDisplayPost =
    highlightedPost ?? (tellClosing ? tellThemePostRef.current : null);

  const dashboardCapsuleStyle = useMemo(() => {
    const base = { '--persona-accent': personaColor };
    const themePost = tellDisplayPost;
    if (!themePost) return base;
    const pk = String(themePost.persona ?? personaKey).toLowerCase();
    const uiKey = PERSONA_ALIASES[pk] ?? pk;
    return {
      ...base,
      '--tell-pill-accent': themePost.noteColor ?? PERSONA_COLORS[uiKey] ?? personaColor,
      '--tell-pill-pastel':
        PERSONA_PASTEL_COLORS[pk] ?? PERSONA_PASTEL_COLORS[uiKey] ?? PERSONA_PASTEL_COLORS.security,
    };
  }, [tellDisplayPost, personaColor, personaKey]);

  const handleHighlightPost = useCallback((post) => {
    const isDeselect = highlightedPost?.id === post.id;
    if (isDeselect) {
      setHighlightedPost(null);
      closeTell();
      return;
    }
    setHighlightedPost(post);
    setConfirmingHide(false);
    setConfirmingUnhide(false);
    setHideBlocked(false);
    if (tellCloseTimerRef.current) clearTimeout(tellCloseTimerRef.current);
    setTellClosing(false);
    setTellExpanded(true);
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
    closeTell();
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
    closeTell();
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
        setPersonaRingWiggle({
          key: personaToUiKey(hidePersona),
          nonce: Date.now(),
        });
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

  const handlePostTellMeMoreClick = useCallback((post) => {
    if (!post) return;
    setHighlightedPost(post);
    setHideBlocked(false);
    setConfirmingHide(false);
    setConfirmingUnhide(false);
    if (tellCloseTimerRef.current) clearTimeout(tellCloseTimerRef.current);
    setTellClosing(false);
    setTellExpanded(true);
  }, []);

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

  useEffect(() => {
    if (!accountResetKey) return;
    joinEnsureAttemptedRef.current = false;
    setViewedProfile(null);
    resetProfileChrome();
  }, [accountResetKey, resetProfileChrome]);

  useEffect(() => {
    if (!profileId || !profile || joinEnsureAttemptedRef.current) return;
    if (!profileNeedsCompliantJoin(profile)) {
      joinEnsureAttemptedRef.current = true;
      return;
    }
    joinEnsureAttemptedRef.current = true;
    const post = buildCompliantJoinPostForProfile(profile, profile.personaPosts ?? []);
    if (!post) return;
    prependCompliantPost(post);
  }, [profileId, profile, prependCompliantPost]);

  const handleOpenProfile = useCallback(
    async (tab = 'profile', authorSlug = null) => {
      const explicitSlug =
        authorSlug != null && String(authorSlug).trim() !== ''
          ? String(authorSlug).trim()
          : null;
      const targetSlug = explicitSlug || ownProfileSlug;

      if (!targetSlug) {
        if (explicitSlug) return;
        setMainView(ownProfileSlug ? 'profile' : 'home');
        return;
      }

      if (ownProfileSlug && targetSlug === ownProfileSlug) {
        setViewedProfile(null);
        setMainView('profile');
        setActiveTab(tab);
        resetProfileChrome();
        bumpProfileEntryReplay?.();
        return;
      }

      let target = (Array.isArray(allProfiles) ? allProfiles : []).find(
        (p) =>
          p?.slug === targetSlug
          || p?.id === targetSlug
          || (explicitSlug && slugsReferToSameAccount(p?.slug ?? p?.id, explicitSlug)),
      );
      if (!target && explicitSlug) {
        try {
          const res = await fetch(
            `${API_ORIGIN}/api/profiles/${encodeURIComponent(targetSlug)}`,
            { cache: 'no-store' },
          );
          if (res.ok) target = await res.json();
        } catch (e) {
          console.warn('[profile] fetch by slug failed', e?.message || e);
        }
      }
      if (!target) {
        if (explicitSlug) {
          console.warn('[profile] not found for slug:', targetSlug);
          return;
        }
        setMainView('landing');
        return;
      }
      ingestProfileAvatars([target]);
      setViewedProfile(normalizeProfilesFromApi([target])[0] ?? target);
      setMainView('profile');
      setActiveTab(tab);
      resetProfileChrome();
      bumpProfileEntryReplay?.();
    },
    [allProfiles, ownProfileSlug, resetProfileChrome, setActiveTab, setMainView, bumpProfileEntryReplay],
  );

  const handleSelectView = useCallback(
    (view) => {
      if (view === 'profile') {
        if (profile) {
          setViewedProfile(null);
        } else if (viewedProfile) {
          setMainView('profile');
          return;
        } else {
          setMainView('home');
          return;
        }
      }
      if (view === 'home') {
        setViewedProfile(null);
      }
      setMainView(view);
    },
    [profile, viewedProfile, setMainView],
  );

  const dashboardLayout = getDashboardControlLayout({
    harvestPhase,
    postPhase: postGen.phase,
  });
  const dashboardBusy = dashboardLayout.actionSlot !== 'timer';

  return (
    <PersonaBlurbsProvider profile={displayProfile}>
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
                viewerProfile={viewerProfile}
                aiFeaturesEnabled={accountFeaturesEnabled}
                isGeneratingPosts={postGen.phase === 'generating' && postGen.loading}
                generatingPersona={postGen.generatingPersona}
                postRevealFlash={postRevealFlash}
                highlightedPostId={highlightedPost?.id ?? null}
                onHighlightPost={handleHighlightPost}
                onPostHide={handlePostHideClick}
                onPostTellMeMore={handlePostTellMeMoreClick}
                tellMeMorePostId={tellExpanded ? (highlightedPost?.id ?? null) : null}
                personaBadgePersona={personaKey}
                onOpenProfile={handleOpenProfile}
                deletedProfileIds={deletedProfileIds}
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
            deletedProfileIds={deletedProfileIds}
            mainScoreEntryReplayKey={profileScoreReplayNonce}
            isGeneratingPosts={!viewedProfile && postGen.phase === 'generating' && postGen.loading}
            generatingPersona={postGen.generatingPersona}
            generateApiOrigin={GENERATE_API_ORIGIN}
          />
        )}

        {mainView === 'home' && (
          <aside className="persona-side-panel" aria-label="Persona dashboard">
            <p className="dashboard-top-label">dashboard</p>
            <div
              className={`dashboard-capsule dashboard-capsule--figma${tellExpanded ? ' is-tell-expanded' : ''}${tellClosing ? ' is-tell-closing' : ''}`}
              style={dashboardCapsuleStyle}
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
                accountFeaturesEnabled={accountFeaturesEnabled}
                updateTimerLabel={updateTimerLabel}
                updateRemainingMs={updateRemainingMs}
                onGeneratePersonaPosts={handleDashboardGenerateClick}
                manualGenerateEnabled={manualDashboardGenerateEnabled}
                postRevealFlash={postRevealFlash}
              />

              <div className="dashboard-tell-row">
                <TellMeMorePill
                  highlightedPost={tellDisplayPost}
                  expanded={tellExpanded}
                  closing={tellClosing}
                  fallbackPersona={personaKey}
                  personaAccent={personaColor}
                  personaPastel={PERSONA_PASTEL_COLORS[personaKey] ?? PERSONA_PASTEL_COLORS.security}
                  holdLoadingOverlay={postGen.loading && isFeedGenerationPhase(postGen.phase)}
                />
              </div>
            </div>

              <DashboardPersonaRings
                scores={adjustedScores}
                dominantPersona={personaKey}
                deltas={personaDeltas}
                onRingClick={cyclePersona}
                wigglePersonaKey={personaRingWiggle.key}
                wiggleNonce={personaRingWiggle.nonce}
              />
          </aside>
        )}
      </div>
    </div>
    </PersonaBlurbsProvider>
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
  // Bumps once per revealed post; drives the synced accent flash on the
  // generate button and the feed top so users link the two.
  const [postRevealFlash, setPostRevealFlash] = useState({ persona: null, nonce: 0 });
  const streamPostsBaselineRef = useRef([]);
  const generationSessionActiveRef = useRef(false);
  const [updateSessionActive, setUpdateSessionActive] = useState(false);
  const deferCompliantRef = useRef(false);
  const pendingCompliantRef = useRef([]);
  const spectateRevealRef = useRef(null);
  if (!spectateRevealRef.current) {
    spectateRevealRef.current = createFeedSpectatorRevealController({ setAllProfiles });
  }
  const personaDeltasClearRef = useRef(null);
  /** Bumps when user navigates onto the profile view — drives MainScoreStyle ring replay only then. */
  const [profileScoreReplayNonce, setProfileScoreReplayNonce] = useState(0);
  const prevMainViewRef = useRef(null);
  const [landingEnteringProfile, setLandingEnteringProfile] = useState(false);
  const [landingOwnedProfile, setLandingOwnedProfile] = useState(null);
  const [linkedProfileSlug, setLinkedProfileSlug] = useState(() => readLinkedProfileSlug());
  const landingEnterProfileTimerRef = useRef(null);

  const tryDeferCompliant = useCallback((apply) => {
    if (!deferCompliantRef.current) return false;
    pendingCompliantRef.current.push(apply);
    return true;
  }, []);

  const flushDeferredCompliant = useCallback(() => {
    deferCompliantRef.current = false;
    const pending = pendingCompliantRef.current.splice(0);
    for (const apply of pending) apply();
  }, []);

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

  const applyGenerationPlan = useCallback((plan) => {
    if (!Array.isArray(plan) || plan.length === 0) return;
    setPostGen((prev) => ({
      ...prev,
      generationPlan: plan,
      generatingPersona: personaAfterReveal(plan, 0),
    }));
  }, []);

  const handlePostRevealed = useCallback((persona) => {
    setPostRevealFlash((prev) => ({
      persona: persona ?? prev.persona,
      nonce: prev.nonce + 1,
    }));
  }, []);

  const handlePostRevealedRef = useRef(handlePostRevealed);
  useEffect(() => {
    handlePostRevealedRef.current = handlePostRevealed;
  }, [handlePostRevealed]);

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
    const owned = landingOwnedProfile;
    if (landingEnteringProfile || !owned) return;
    const slug = owned.slug || owned.id;
    if (slug) persistProfileSlug(slug);
    setLandingEnteringProfile(true);
    if (landingEnterProfileTimerRef.current) clearTimeout(landingEnterProfileTimerRef.current);
    landingEnterProfileTimerRef.current = setTimeout(() => {
      landingEnterProfileTimerRef.current = null;
      setLandingEnteringProfile(false);
      setActiveTab('profile');
      setMainView('profile');
    }, LANDING_PROFILE_ENTRY_MS);
  }, [landingEnteringProfile, landingOwnedProfile]);

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

  const [deletedProfileIds, setDeletedProfileIds] = useState([]);
  const [accountResetKey, setAccountResetKey] = useState(0);

  const applyFullAccountReset = useCallback((profileIdForStorage = null) => {
    purgeClientAccountState({ profileId: profileIdForStorage, clearSession: true });
    clearStoredProfileSlug();
    setLinkedProfileSlug(null);
    setProfile(null);
    setAllProfiles([]);
    setLandingOwnedProfile(null);
    spectateRevealRef.current?.reset?.();
    spectateRevealRef.current?.ingestProfiles([]);
    setMainView('landing');
    setPersonaOverride(null);
    setPersonaDeltas(null);
    setPostGen(POST_GEN_IDLE);
    setHarvestPhase('idle');
    setHarvestError(null);
    setHarvestProgress(null);
    setAccountResetKey((k) => k + 1);
  }, []);

  const syncDeletedProfileIds = useCallback((deleted) => {
    const next = Array.isArray(deleted) ? deleted.map(String) : [];
    setDeletedProfileIds((prev) => {
      if (prev.length === next.length && prev.every((value, index) => value === next[index])) {
        return prev;
      }
      return next;
    });
    return next;
  }, []);

  const scheduleSpectatorIngest = useCallback((profiles, cancelledRef) => {
    const snapshot = Array.isArray(profiles) ? profiles : [];
    queueMicrotask(() => {
      if (cancelledRef?.cancelled) return;
      spectateRevealRef.current?.ingestProfiles(snapshot);
    });
  }, []);

  const syncAccountDeletionState = useCallback(async () => {
    try {
      const stateRes = await fetch(`${API_ORIGIN}/api/account-state`);
      if (!stateRes.ok) return false;
      const state = await stateRes.json();
      const deleted = syncDeletedProfileIds(state?.deletedProfileIds);
      // Live-scoring reset only — do not log out other users when someone else deletes.
      applyAccountDeletionFromServer(state?.lastDeletionAt);

      const mySlug = linkedProfileSlug || readLinkedProfileSlug() || readStoredProfileSlug();
      if (!mySlug || !isProfileSlugDeleted(mySlug, deleted)) return false;

      const storageProfileId = profile?.slug ?? profile?.id ?? mySlug;
      applyFullAccountReset(storageProfileId);
      return true;
    } catch {
      /* ignore */
    }
    return false;
  }, [applyFullAccountReset, linkedProfileSlug, profile?.slug, profile?.id, syncDeletedProfileIds]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      ingestHostedSessionFromHash();
      if (!readHostedSession()?.access_token) return;
      const linked = await fetchLinkedProfile();
      if (cancelled || !linked) return;
      const slug = linked.slug ?? linked.id;
      if (slug) {
        setLinkedProfileSlug(String(slug));
        persistProfileSlug(slug);
      }
      setProfile((prev) => mergeProfileFromApi(prev, linked));
      setLandingOwnedProfile(linked);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Keep ?profile=slug in the URL for linked accounts (session survives polls / feed updates).
  useEffect(() => {
    if (!isHostedApiOrigin() || typeof window === 'undefined') return;
    if (!readHostedSession()?.access_token) return;
    const slug = linkedProfileSlug || readLinkedProfileSlug();
    if (!slug) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('profile') === slug) return;
    params.set('profile', slug);
    window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`);
    persistProfileSlug(slug);
  }, [linkedProfileSlug, mainView]);

  useEffect(() => {
    const cancelledRef = { cancelled: false };

    const load = async () => {
      if (await syncAccountDeletionState()) return;

      try {
        const data = await fetchPublicDirectorySnapshot({ includeFeed: mainView === 'home' });
        if (cancelledRef.cancelled) return;
        if (!Array.isArray(data) || data.length === 0) {
          setLandingOwnedProfile(null);
          setAllProfiles([]);
          ingestProfileAvatars([]);
          setProfile(null);
          return;
        }
        let deleted = deletedProfileIds;
        try {
          const stateRes = await fetch(`${API_ORIGIN}/api/account-state`, { cache: 'no-store' });
          if (stateRes.ok) {
            const state = await stateRes.json();
            deleted = syncDeletedProfileIds(state?.deletedProfileIds);
            applyAccountDeletionFromServer(state?.lastDeletionAt);
          }
        } catch {
          /* ignore */
        }

        const normalized = normalizeProfilesFromApi(
          filterProfilesNotDeleted(data, deleted),
        );
        ingestProfileAvatars(normalized);
        inferPublicMediaConfigFromProfiles(normalized);

        if (isHostedApiOrigin() && readHostedSession()?.access_token) {
          const meRes = await fetch(`${API_ORIGIN}/api/profile/me`, {
            headers: { ...hostedAuthHeaders() },
          }).catch(() => null);
          if (!meRes?.ok) {
            if (shouldResetHostedSessionForProfileMeStatus(meRes?.status)) {
              clearHostedAccountStorage();
              setLinkedProfileSlug(null);
              setProfile(null);
              setLandingOwnedProfile(null);
              setAllProfiles(normalized);
              scheduleSpectatorIngest(normalized, cancelledRef);
              return;
            }
          } else {
            const meJson = await meRes.json().catch(() => ({}));
            const meProfile = meJson?.profile ?? null;
            if (meProfile) {
              const meSlug = String(meProfile.slug ?? meProfile.id ?? '').trim();
              if (meSlug) {
                setLinkedProfileSlug(meSlug);
                persistProfileSlug(meSlug);
              }
              setLandingOwnedProfile(meProfile);
              setProfile((prev) =>
                mergeOwnedProfileFromApi(prev, meProfile, {
                  preserveClientPosts: generationSessionActiveRef.current,
                }),
              );
              const directory = [...normalized];
              const idx = directory.findIndex(
                (p) => p?.slug === meSlug || p?.id === meSlug,
              );
              if (idx >= 0) {
                directory[idx] = mergeOwnedProfileFromApi(directory[idx], meProfile, {
                  preserveClientPosts: generationSessionActiveRef.current,
                });
              } else {
                directory.unshift(meProfile);
              }
              setAllProfiles(directory);
              scheduleSpectatorIngest(directory, cancelledRef);
              return;
            }
            const storageProfileId =
              profile?.slug ?? profile?.id ?? linkedProfileSlug ?? readStoredProfileSlug();
            applyFullAccountReset(storageProfileId);
            return;
          }
        }

        setAllProfiles(normalized);
        scheduleSpectatorIngest(normalized, cancelledRef);
        const owned = resolveOwnedLandingProfile(normalized, linkedProfileSlug);
        if (linkedProfileSlug && !owned) {
          const storageProfileId =
            profile?.slug ?? profile?.id ?? linkedProfileSlug ?? readStoredProfileSlug();
          applyFullAccountReset(storageProfileId);
          return;
        }
        if (!linkedProfileSlug && readStoredProfileSlug() && !owned) {
          clearStoredProfileSlug();
        }
        setLandingOwnedProfile(owned);
        if (owned) {
          setProfile((prev) =>
            mergeOwnedProfileFromApi(prev, owned, {
              preserveClientPosts: generationSessionActiveRef.current,
            }),
          );
        } else {
          setProfile(null);
        }
      } catch {
        if (cancelledRef.cancelled) return;
      }
    };

    load();
    // Keep the public directory fresh without hammering hosted Supabase through the API.
    const pollMs = mainView === 'home' ? PUBLIC_FEED_POLL_MS : PUBLIC_DIRECTORY_POLL_MS;
    const id = setInterval(load, pollMs);
    return () => {
      cancelledRef.cancelled = true;
      clearInterval(id);
    };
  }, [syncAccountDeletionState, mainView, linkedProfileSlug, applyFullAccountReset, scheduleSpectatorIngest, syncDeletedProfileIds]);

  const reloadProfileFromApi = useCallback(async ({ skipPostsMerge = false, forcePostsMerge = false } = {}) => {
    const res = await fetch(`${API_ORIGIN}/api/profiles`, { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to reload profile');
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) {
      setAllProfiles([]);
      setProfile(null);
      return null;
    }
    const filtered = filterProfilesNotDeleted(data, deletedProfileIds);
    if (filtered.length === 0) {
      setAllProfiles([]);
      setProfile(null);
      return null;
    }
    const normalized = normalizeProfilesFromApi(filtered);
    ingestProfileAvatars(normalized);
    setAllProfiles(normalized);
    queueMicrotask(() => {
      spectateRevealRef.current?.ingestProfiles(normalized);
    });
    inferPublicMediaConfigFromProfiles(normalized);
    const hosted = isHostedApiOrigin();
    const pickSlug = linkedProfileSlug || (hosted ? null : selectedProfileSlug());
    const incoming = pickSlug
      ? selectProfileBySlug(normalized, pickSlug)
      : hosted
        ? null
        : data[0];
    const apiPersonaPosts = Array.isArray(incoming?.personaPosts) ? incoming.personaPosts : [];
    let merged = incoming;
    setProfile((prev) => {
      if (skipPostsMerge && prev && incoming) {
        merged = attachApiPersonaPosts(
          { ...incoming, personaPosts: prev.personaPosts ?? [] },
          apiPersonaPosts,
        );
      } else {
        const preserveClientPosts =
          !forcePostsMerge && generationSessionActiveRef.current;
        merged = incoming
          ? mergeOwnedProfileFromApi(prev, incoming, { preserveClientPosts })
          : prev;
        if (merged && incoming) {
          merged = attachApiPersonaPosts(merged, apiPersonaPosts);
        }
      }
      return merged;
    });
    return merged;
  }, [deletedProfileIds, linkedProfileSlug]);

  useEffect(() => {
    const skip = postGen.loading
      ? linkedProfileSlug ?? profile?.slug ?? profile?.id ?? null
      : null;
    spectateRevealRef.current?.setSkipSlug(skip);
  }, [postGen.loading, linkedProfileSlug, profile?.slug, profile?.id]);

  const pollHarvestUntilDone = useCallback(async (scoresBefore, profileSlug) => {
    const slug = String(profileSlug || '').trim();
    if (!slug) throw new Error('Profile slug required for harvest');
    const statusUrl = `${API_ORIGIN}/api/harvest/status?profileSlug=${encodeURIComponent(slug)}`;
    const start = Date.now();
    while (Date.now() - start < HARVEST_WAIT_MS) {
      const res = await fetch(statusUrl);
      if (!res.ok) throw new Error('Harvest status unavailable');
      const st = await res.json();
      setHarvestProgress(st.progress ?? null);
      if (st.status === 'done') {
        const after = st.scoresAfter ?? getPersonaScoresNormalized(await reloadProfileFromApi());
        setPersonaDeltas(computePersonaDeltas(scoresBefore, after));
        await fetch(`${API_ORIGIN}/api/harvest/ack`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ profileSlug: slug }),
        });
        return st;
      }
      if (st.status === 'error') {
        throw new Error(st.error || 'Harvest failed');
      }
      if (st.status === 'idle' && Date.now() - start > 8000) {
        throw new Error(
          'Desktop collector not responding. Keep the Compliant app open on this machine, then try again.',
        );
      }
      await new Promise((r) => setTimeout(r, HARVEST_POLL_MS));
    }
    throw new Error('Harvest timed out');
  }, [reloadProfileFromApi]);

  const ownedProfileId = useMemo(() => {
    if (!profile) return null;
    if (isHostedApiOrigin()) {
      return profile.slug ?? profile.id ?? null;
    }
    const first = String(profile.firstname ?? '').trim().toLowerCase();
    const last = String(profile.lastname ?? '').trim().toLowerCase();
    return first && last ? `${first}-${last}` : null;
  }, [profile?.slug, profile?.id, profile?.firstname, profile?.lastname]);

  const prependCompliantPost = useCallback(
    (post) => {
      if (!ownedProfileId || !post) return;
      const apply = () => {
        setProfile((prev) =>
          prev
            ? { ...prev, personaPosts: mergePostsPrepend([post], prev.personaPosts ?? []) }
            : prev,
        );
        prependPersonaPosts(ownedProfileId, [post]).catch((err) => {
          console.warn('[compliant] failed to persist system post:', err?.message || err);
        });
      };
      if (tryDeferCompliant(apply)) return;
      apply();
    },
    [ownedProfileId, tryDeferCompliant],
  );

  const runBioAndPostGeneration = useCallback(async (profileSnapshot) => {
    let p = profileSnapshot ?? profile;
    if (!p) return;
    if (profileNeedsCompliantJoin(p)) {
      const joinPost = buildCompliantJoinPostForProfile(p, p.personaPosts ?? []);
      if (joinPost) {
        prependCompliantPost(joinPost);
        p = {
          ...p,
          personaPosts: mergePostsPrepend([joinPost], p.personaPosts ?? []),
        };
      }
    }
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
          setProfile((prev) =>
            prev
              ? { ...prev, profileSummary: bio, userDescription: bio }
              : prev,
          );
        }
      } catch (e) {
        setPostGen({ loading: false, phase: 'idle', error: e?.message || 'Bio generation failed' });
        return;
      }
    }

    const baseline = streamPostsBaselineRef.current;
    let revealQueue;
    let planRevealCount = 0;
    const slotBuffer = createOrderedSlotRevealBuffer({
      onRelease: (post) => {
        revealQueue.enqueue([post]);
      },
    });

    revealQueue = createPostFeedRevealQueue({
      gapMs: POST_REVEAL_GAP_MS,
      getBaseline: () => streamPostsBaselineRef.current,
      onPostRevealed: (persona) => {
        handlePostRevealedRef.current?.(persona);
        planRevealCount += 1;
        setPostGen((prev) => (
          prev.loading && prev.phase === 'generating'
            ? {
                ...prev,
                generatingPersona: personaAfterReveal(prev.generationPlan, planRevealCount),
              }
            : prev
        ));
      },
      onNextPostChange: (persona) => {
        setPostGen((prev) => {
          if (!prev.loading || prev.phase !== 'generating' || prev.generationPlan) return prev;
          return { ...prev, generatingPersona: persona };
        });
      },
      // No flushSync: the 2s gap between reveals already prevents update
      // coalescing, and forcing synchronous renders here stalls the main
      // thread when the feed has 50+ cards — which in turn blocks the
      // stream reader from draining further posts.
      onPostsChange: (personaPosts) => {
        setProfile((prev) => (prev ? { ...prev, personaPosts } : prev));
      },
    });
    revealQueue.markBaseline(baseline);

    const enqueueArrivedPost = (post, slotIndex) => {
      if (!post || typeof post !== 'object') return;
      if (typeof slotIndex === 'number') {
        slotBuffer.push(post, slotIndex);
        return;
      }
      revealQueue.enqueue([post]);
    };

    // Watchdog: if no chunk arrives for this long, abort so the generation flow
    // can settle and re-enable the trigger button instead of hanging forever.
    // The server keeps the stream open until its slowest LM slot settles; if
    // that stalls, we abort and the caller's finally reloads the posts the
    // server already persisted.
    const STREAM_IDLE_TIMEOUT_MS = 45000;
    const abortCtrl = new AbortController();
    let idleTimer = null;
    const armIdleWatchdog = () => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        try { abortCtrl.abort(); } catch { /* ignore */ }
      }, STREAM_IDLE_TIMEOUT_MS);
    };
    const disarmIdleWatchdog = () => {
      if (idleTimer) {
        clearTimeout(idleTimer);
        idleTimer = null;
      }
    };

    try {
      const res = await fetch(`${GENERATE_API_ORIGIN}/api/posts/generate-stream`, {
        method: 'POST',
        headers: {
          Accept: 'application/x-ndjson',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
        signal: abortCtrl.signal,
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
        if (Array.isArray(row.plan) && row.plan.length > 0) {
          slotBuffer.setPlan(row.plan);
          applyGenerationPlan(row.plan);
          return;
        }
        if (row.post) {
          const slotIndex = typeof row.slotIndex === 'number' ? row.slotIndex : undefined;
          enqueueArrivedPost(row.post, slotIndex);
        }
      };

      armIdleWatchdog();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        armIdleWatchdog();
        buf += dec.decode(value, { stream: true });
        let nl;
        while ((nl = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          processLine(line);
        }
      }
      disarmIdleWatchdog();

      const tail = buf.trim();
      if (tail) {
        try {
          const row = JSON.parse(tail);
          if (row.success === false && row.error) throw new Error(row.error);
          if (!row.done) {
            if (row.error && !row.post) throw new Error(row.error);
            if (Array.isArray(row.plan) && row.plan.length > 0) {
              slotBuffer.setPlan(row.plan);
              applyGenerationPlan(row.plan);
            } else if (row.post) {
              const slotIndex = typeof row.slotIndex === 'number' ? row.slotIndex : undefined;
              enqueueArrivedPost(row.post, slotIndex);
            }
          }
        } catch (e) {
          if (e instanceof SyntaxError) {
            /* ignore trailing garbage */
          } else {
            throw e;
          }
        }
      }

      await revealQueue.waitUntilIdle();
      await reloadProfileFromApi({ forcePostsMerge: true });
      schedulePersonaDeltasClearAfterGenerate();
    } catch (e) {
      await revealQueue.waitUntilIdle().catch(() => {});
      throw e;
    } finally {
      disarmIdleWatchdog();
    }
  }, [
    profile,
    prependCompliantPost,
    reloadProfileFromApi,
    schedulePersonaDeltasClearAfterGenerate,
    applyGenerationPlan,
  ]);

  const runBioAndPostGenerationRef = useRef(runBioAndPostGeneration);
  useEffect(() => {
    runBioAndPostGenerationRef.current = runBioAndPostGeneration;
  }, [runBioAndPostGeneration]);

  const autoPostGenProfileIdRef = useRef(null);

  const countAiGeneratedPosts = useCallback((posts) => {
    if (!Array.isArray(posts)) return 0;
    return posts.filter(
      (p) => String(p?.content || '').trim() && !isCompliantSystemPost(p),
    ).length;
  }, []);

  // After harvest sync: queue worker jobs on hosted; stream from :3010 locally.
  useEffect(() => {
    if (!profile || postGen.loading || harvestPhase === 'harvesting') return;

    const hosted = isHostedApiOrigin();
    const owned = hosted
      ? resolveOwnedProfileForFeatures(profile, allProfiles, linkedProfileSlug)
      : profile;
    if (!owned) return;

    const profileId = owned.slug ?? owned.id;
    if (!profileId || autoPostGenProfileIdRef.current === profileId) return;

    const aiPostCount = countAiGeneratedPosts(owned.personaPosts);
    if (aiPostCount >= 3) return;

    if (hosted && !readHostedSession()?.access_token) {
      return;
    }
    if (!hosted) {
      const bio = String(owned.profileSummary || owned.userDescription || '').trim();
      if (!bio) return;
    }

    autoPostGenProfileIdRef.current = profileId;
    setPostGen({
      loading: true,
      phase: 'generating',
      error: null,
      generatingPersona: null,
      generationPlan: null,
    });

    (async () => {
      try {
        if (hosted) {
          let planRevealCount = 0;
          const triggerRes = await fetch(`${API_ORIGIN}/api/generation-jobs/trigger-initial`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...hostedAuthHeaders(),
            },
            body: JSON.stringify({ profileSlug: profileId }),
          });
          if (!triggerRes.ok) {
            const errText = await triggerRes.text().catch(() => '');
            throw new Error(errText.slice(0, 200) || `Generation queue failed (${triggerRes.status})`);
          }
          const triggerBody = await triggerRes.json().catch(() => ({}));
          if (triggerBody?.alreadyComplete) {
            setPostGen(POST_GEN_IDLE);
            return;
          }
          const jobId = triggerBody?.jobId ?? null;
          streamPostsBaselineRef.current = stripFeedRevealMetaFromPosts(owned.personaPosts ?? []);
          await runHostedPostGenerationWithReveal({
            jobId,
            reloadProfileFromApi,
            getBaselinePosts: () => streamPostsBaselineRef.current,
            onGenerationPlan: applyGenerationPlan,
            onPostRevealed: (persona) => {
              handlePostRevealed(persona);
              planRevealCount += 1;
              setPostGen((prev) => (
                prev.loading && prev.phase === 'generating'
                  ? {
                      ...prev,
                      generatingPersona: personaAfterReveal(prev.generationPlan, planRevealCount),
                    }
                  : prev
              ));
            },
            applyRevealedPosts: (personaPosts) => {
              setProfile((prev) => (prev ? { ...prev, personaPosts } : prev));
            },
          });
          setPostGen(POST_GEN_IDLE);
          schedulePersonaDeltasClearAfterGenerate();
          await reloadProfileFromApi({ forcePostsMerge: true });
        } else {
          await runBioAndPostGenerationRef.current(owned);
          setPostGen(POST_GEN_IDLE);
        }
      } catch (e) {
        autoPostGenProfileIdRef.current = null;
        setPostGen({ loading: false, phase: 'idle', error: e?.message || 'Generation failed' });
      }
    })();
  }, [
    profile,
    allProfiles,
    linkedProfileSlug,
    postGen.loading,
    harvestPhase,
    countAiGeneratedPosts,
    reloadProfileFromApi,
    applyGenerationPlan,
    handlePostRevealed,
    schedulePersonaDeltasClearAfterGenerate,
  ]);

  const handleGeneratePersonaPosts = async () => {
    if (postGen.loading || harvestPhase === 'harvesting' || !profile) return;

    const hosted = isHostedApiOrigin();
    const profileSlug = profile?.slug ?? profile?.id ?? linkedProfileSlug;

    if (hosted && !profileSlug) {
      setHarvestError('Open this profile from the Compliant app (View on web), then try again.');
      return;
    }
    if (
      hosted
      && !canUseHostedAccountFeatures(
        resolveOwnedProfileForFeatures(profile, allProfiles, linkedProfileSlug),
        linkedProfileSlug,
        { allProfiles },
      )
    ) {
      setHarvestError('Generation is only available on your linked profile.');
      return;
    }

    cancelPersonaDeltasClear();
    generationSessionActiveRef.current = true;
    setUpdateSessionActive(true);
    deferCompliantRef.current = true;
    const scoresBefore = getPersonaScoresNormalized(profile);
    setHarvestError(null);
    setHarvestProgress(null);
    setHarvestPhase('harvesting');

    try {
      const reqRes = await fetch(`${API_ORIGIN}/api/harvest/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scoresBefore, dynamicOnly: true, profileSlug }),
      });
      if (!reqRes.ok && reqRes.status !== 409) {
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
      // 409 = harvest already running (double-click or retry) — join via poll.

      await pollHarvestUntilDone(scoresBefore, profileSlug);
      await reloadProfileFromApi();
    } catch (e) {
      setHarvestError(e?.message || 'Harvest failed');
      setHarvestPhase('idle');
      setPostGen({ loading: false, phase: 'idle', error: e?.message || 'Harvest failed' });
      try {
        await fetch(`${API_ORIGIN}/api/harvest/ack`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ profileSlug }),
        });
      } catch {
        /* ignore */
      }
      generationSessionActiveRef.current = false;
      setUpdateSessionActive(false);
      flushDeferredCompliant();
      return;
    }

    setHarvestPhase('idle');
    setHarvestProgress(null);
    const freshProfile = await reloadProfileFromApi();
    const scoresAfter = getPersonaScoresNormalized(freshProfile ?? {});
    setPersonaDeltas(computePersonaDeltas(scoresBefore, scoresAfter));

    setPostGen({
      loading: true,
      phase: 'deltas',
      error: null,
      generatingPersona: null,
      generationPlan: null,
    });

    let generationJobId = null;
    if (hosted) {
      const slug = freshProfile?.slug ?? freshProfile?.id ?? profile?.slug ?? profile?.id;
      if (slug) {
        try {
          const triggerRes = await fetch(`${API_ORIGIN}/api/generation-jobs/trigger-update`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ profileSlug: slug }),
          });
          if (triggerRes.ok) {
            const triggerBody = await triggerRes.json().catch(() => ({}));
            generationJobId = triggerBody?.jobId ?? null;
          }
        } catch {
          /* Electron may have already queued the job */
        }
      }
    }

    // Reveal baseline = everything currently on screen. We UNION the live
    // client list (`prev.personaPosts`, which carries any COMPLIANT system post
    // that may only exist client-side) with the fresh server snapshot, instead
    // of trusting the server snapshot alone. A server reload can omit a
    // client-only compliant post; using it as the sole baseline made that post
    // vanish the moment reveals started and "reappear" at the end. Unioning
    // keeps it pinned in the feed (the feed itself re-sorts by time, so new
    // posts still land above it).
    const freshServerPosts = stripFeedRevealMetaFromPosts(freshProfile?.personaPosts ?? []);
    setProfile((prev) => {
      const livePosts = stripFeedRevealMetaFromPosts(prev?.personaPosts ?? []);
      const baseline = mergePostsPrepend(livePosts, freshServerPosts);
      streamPostsBaselineRef.current = baseline;
      return prev ? { ...prev, personaPosts: baseline } : prev;
    });

    await new Promise((r) => setTimeout(r, PERSONA_DELTA_DISPLAY_MS));

    setPostGen((prev) => {
      if (!prev.loading || prev.phase !== 'deltas') return prev;
      return {
        ...prev,
        phase: 'generating',
        generatingPersona: null,
        generationPlan: null,
      };
    });

    try {
      if (hosted) {
        let planRevealCount = 0;
        await runHostedPostGenerationWithReveal({
          jobId: generationJobId,
          reloadProfileFromApi,
          getBaselinePosts: () => streamPostsBaselineRef.current,
          onGenerationPlan: applyGenerationPlan,
          onPostRevealed: (persona) => {
            handlePostRevealed(persona);
            planRevealCount += 1;
            setPostGen((prev) => (
              prev.loading && prev.phase === 'generating'
                ? {
                    ...prev,
                    generatingPersona: personaAfterReveal(prev.generationPlan, planRevealCount),
                  }
                : prev
            ));
          },
          applyRevealedPosts: (personaPosts) => {
            setProfile((prev) => (prev ? { ...prev, personaPosts } : prev));
          },
        });
      } else {
        await runBioAndPostGeneration(freshProfile);
      }
      setPostGen(POST_GEN_IDLE);
      schedulePersonaDeltasClearAfterGenerate();
    } catch (e) {
      setPostGen({ loading: false, phase: 'idle', error: e?.message || 'Generation failed' });
      schedulePersonaDeltasClearAfterGenerate();
    } finally {
      // End the session BEFORE the reconciling reload so forcePostsMerge wins
      // (preserveClientPosts is gated on this ref).
      generationSessionActiveRef.current = false;
      setUpdateSessionActive(false);
      flushDeferredCompliant();
      // Always pull the server's canonical post list. The reveal stream can
      // error, abort, or time out while the worker still wrote the posts to
      // disk — without this, the user had to manually reload to see them.
      try {
        await reloadProfileFromApi({ forcePostsMerge: true });
      } catch {
        /* network hiccup — next background poll will reconcile */
      }
      // Safety: guarantee the generate button is clickable again on every path.
      setPostGen((prev) => (prev.loading ? { loading: false, phase: 'idle', error: prev.error ?? null } : prev));
    }
  };

  if (mainView === 'landing') {
    return (
      <>
        <LandingPage
          profile={landingOwnedProfile}
          onEnterProfile={handleLandingEnterProfile}
          onBrowseFeed={handleLandingBrowseFeed}
          profileEntryLoading={landingEnteringProfile}
        />
      </>
    );
  }

  return (
    <LiveScoringProvider profile={profile}>
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
        bumpProfileEntryReplay={() => setProfileScoreReplayNonce((n) => n + 1)}
        deletedProfileIds={deletedProfileIds}
        accountResetKey={accountResetKey}
        handleGeneratePersonaPosts={handleGeneratePersonaPosts}
        linkedProfileSlug={linkedProfileSlug}
        tryDeferCompliant={tryDeferCompliant}
        updateSessionActive={updateSessionActive}
        postRevealFlash={postRevealFlash}
      />
    </LiveScoringProvider>
  );
}
