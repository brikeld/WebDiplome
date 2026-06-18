import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { flushSync } from 'react-dom';
import Sidebar from '@/layout/Sidebar.jsx';
import ScrollArea from '@/layout/ScrollArea.jsx';
import ProfileView from '@/features/profile/ProfileView.jsx';
import HomeTab from '@/features/home/HomeTab.jsx';
import DashboardTimerRow from '@/features/home/DashboardTimerRow.jsx';
import LandingPage from '@/landing-page/LandingPage.jsx';
import LoginEntryPage from '@/landing-page/LoginEntryPage.jsx';
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
import PersonaChangeCapsule from '@/features/home/PersonaChangeCapsule.jsx';
import TellMeMorePill from '@/features/inferenceChain/TellMeMorePill.jsx';
import '@/features/inferenceChain/inferenceChain.css';
import { applyAccountDeletionFromServer } from '@/lib/liveScoringStorage.js';
import { LiveScoringProvider } from '@/features/liveScoring/LiveScoringContext.jsx';
import { PersonaBlurbsProvider } from '@/features/personaBlurbs/PersonaBlurbsContext.jsx';
import ScoreAnimator from '@/features/liveScoring/ScoreAnimator.jsx';
import GenerationParticleAnimator from '@/features/harvest/GenerationParticleAnimator.jsx';
import { useLiveScoring } from '@/features/liveScoring/useLiveScoring.js';
import {
  canHideContentForScores,
  PERSONA_SCORE_RESTRICT_THRESHOLD,
  personaToUiKey,
  resolveHideContentPersona,
} from '@/lib/personaScoreCompliance.js';
import {
  createCompliantLowScorePost,
  createCompliantPersonaChangePost,
  shouldCreateLowScorePostOnce,
  shouldCreatePersonaChangePost,
  stripLowScorePostsForPersona,
} from '@/lib/compliantSystemPosts.js';
import { markLowScoreFired, loadLowScoreFiredPersonas } from '@/lib/compliantLowScoreStorage.js';
import {
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
import { isHostedApiOrigin, profileSlugFromProfile } from '@/lib/aiJobClient.js';
import { createFeedSpectatorRevealController } from '@/lib/feedSpectatorReveals.js';
import { runHostedPostGenerationWithReveal } from '@/lib/hostedPostGeneration.js';
import { createGenerationBeforeReveal } from '@/lib/generationParticleFlight.js';
import {
  attachApiPersonaPosts,
  mergeProfilePreservePosts,
} from '@/lib/profileReload.js';
import { isCompliantSystemPost } from '@/lib/mergePersonaPosts.js';
import {
  createPostFeedRevealQueue,
  POST_REVEAL_GAP_MS,
  settleFeedPostsAsBaseline,
  sleep as feedRevealSleep,
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
  fetchWithHostedAuth,
  hostedAuthHeaders,
  ingestHostedSessionFromHash,
  readHostedSession,
  readLinkedProfileSlug,
  refreshHostedSession,
  resolveOwnedProfileForFeatures,
  shouldResetHostedSessionForProfileMeStatus,
} from '@/lib/hostedAccount.js';
import DemoRotateButton from '@/features/debug/DemoRotateButton.jsx';
import { canUseDemoRotateControl } from '@/lib/demoRotate.js';
import {
  persistProfileSlug,
  readStoredProfileSlug,
  readViewProfileSlugFromUrl,
  resolveOwnedLandingProfile,
  clearStoredProfileSlug,
} from '@/lib/profileSlugStorage.js';
import { selectProfileBySlug } from '@/lib/profileDirectory.js';
import { canManuallyGenerateDashboardUpdate } from '@/lib/adminProfile.js';

function selectedProfileSlug() {
  return readStoredProfileSlug();
}

const API_ORIGIN = resolveApiOrigin();
const GENERATE_API_ORIGIN = resolveGenerateApiOrigin();
const PUBLIC_DIRECTORY_POLL_MS = 30_000;
const PUBLIC_FEED_POLL_MS = 30_000;
const TELL_LAYOUT_MS = 2250;
const TELL_CROSSFADE_MS = 780;
const TELL_RADAR_HOLD_MS = 3400;
const TELL_REVEAL_MS = 1300;
const TELL_CLOSE_FADE_MS = 720;

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
// Pastel companion colors for idle tell-me-more + timer surfaces.
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
const generationBeforeReveal = createGenerationBeforeReveal();

function sleep(ms) {
  return feedRevealSleep(ms);
}

function isFeedGenerationPhase(phase) {
  return phase === 'generating';
}

/** Full directory with every profile's posts — summaries-only snapshots drop posts on navigation. */
async function fetchPublicDirectorySnapshot() {
  const res = await fetch(`${API_ORIGIN}/api/profiles`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Profile directory failed (${res.status})`);
  const data = await res.json();
  return Array.isArray(data) ? data : [];
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
  deletedProfileIds = [],
  accountResetKey = 0,
  onGoLanding,
  reloadProfileFromApi,
  spectateRevealRef,
  demoRotateActive = false,
  onDemoRotateActiveChange,
  demoGeneratingPersona = null,
  onDemoGeneratingPersona,
  setAllProfiles,
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
    isPostHiddenFor,
  } = useLiveScoring();
  const [confirmingHide, setConfirmingHide] = useState(false);
  const [confirmingUnhide, setConfirmingUnhide] = useState(false);
  const [highlightedPost, setHighlightedPost] = useState(null);
  const [hideTargetPost, setHideTargetPost] = useState(null);
  const [tellPhase, setTellPhase] = useState('idle');
  const tellCloseTimerRef = useRef(null);
  const tellPhaseTimersRef = useRef([]);
  const tellRunIdRef = useRef(0);
  const tellThemePostRef = useRef(null);
  const blockTellOpenRef = useRef(false);
  const [hideBlocked, setHideBlocked] = useState(false);
  const [personaRingWiggle, setPersonaRingWiggle] = useState({ key: null, nonce: 0 });
  const [personaChangeBanner, setPersonaChangeBanner] = useState(null);
  const [personaChangeBannerExiting, setPersonaChangeBannerExiting] = useState(false);
  const personaChangeBannerTimerRef = useRef(null);
  const [viewedProfile, setViewedProfile] = useState(null);
  const previousLivePersonaRef = useRef(null);
  const previousPersonaScoresRef = useRef(null);
  const boundProfileIdentityRef = useRef(null);
  const pendingPersonaChangeRef = useRef(null);
  const joinEnsureAttemptedRef = useRef(false);
  const updateTimerLastTickRef = useRef(Date.now());
  const autoDashboardGenerateRef = useRef(false);
  const [updateRemainingMs, setUpdateRemainingMs] = useState(DASHBOARD_UPDATE_INTERVAL_MS);

  const profileId = useMemo(() => {
    if (!profile) return boundProfileIdentityRef.current;
    let candidate;
    if (isHostedApiOrigin()) {
      candidate = profileSlugFromProfile(profile);
    } else {
      const first = String(profile.firstname ?? '').trim().toLowerCase();
      const last = String(profile.lastname ?? '').trim().toLowerCase();
      candidate = first && last ? `${first}-${last}` : null;
    }
    if (!candidate) return boundProfileIdentityRef.current;
    const bound = boundProfileIdentityRef.current;
    if (
      bound === candidate
      || (bound && slugsReferToSameAccount(bound, candidate))
      || (
        profile?.id
        && profile?.slug
        && bound === String(profile.id).trim()
        && candidate === String(profile.slug).trim()
      )
    ) {
      if (bound !== candidate) boundProfileIdentityRef.current = candidate;
      return boundProfileIdentityRef.current ?? candidate;
    }
    return candidate;
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
    (mainView === 'home' || mainView === 'profile')
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

  const showPersonaChangeTransition = useCallback(
    (fromPersona, toPersona) => {
      if (!profile || !fromPersona || !toPersona || fromPersona === toPersona) return;
      const userDisplayName = displayNameFromProfileLite(profile);
      setPersonaChangeBannerExiting(false);
      setPersonaChangeBanner({
        fromPersona,
        toPersona,
        userDisplayName,
        key: Date.now(),
      });
      previousLivePersonaRef.current = toPersona;

      const posts = Array.isArray(profile.personaPosts) ? profile.personaPosts : [];
      if (!shouldCreatePersonaChangePost(posts, fromPersona, toPersona)) return;

      const post = createCompliantPersonaChangePost({
        profile,
        fromPersona,
        toPersona,
        userDisplayName,
      });
      prependCompliantPost(post);
    },
    [profile, prependCompliantPost],
  );

  useEffect(() => {
    if (!profile || !liveDominantPersona || !scoresLoaded) return;

    const previous = previousLivePersonaRef.current;
    if (previous === null) {
      previousLivePersonaRef.current = liveDominantPersona;
      pendingPersonaChangeRef.current = null;
      return;
    }

    if (previous === liveDominantPersona) {
      pendingPersonaChangeRef.current = null;
      return;
    }

    if (updateSessionActive || postGen.loading) {
      pendingPersonaChangeRef.current = {
        fromPersona: previous,
        toPersona: liveDominantPersona,
      };
      return;
    }

    pendingPersonaChangeRef.current = null;
    showPersonaChangeTransition(previous, liveDominantPersona);
  }, [
    liveDominantPersona,
    profile,
    scoresLoaded,
    updateSessionActive,
    postGen.loading,
    showPersonaChangeTransition,
  ]);

  useEffect(() => {
    if (!profile || !scoresLoaded || updateSessionActive || postGen.loading) return;
    const pending = pendingPersonaChangeRef.current;
    if (!pending) return;
    if (previousLivePersonaRef.current === pending.toPersona) {
      pendingPersonaChangeRef.current = null;
      return;
    }
    pendingPersonaChangeRef.current = null;
    showPersonaChangeTransition(pending.fromPersona, pending.toPersona);
  }, [
    profile,
    scoresLoaded,
    updateSessionActive,
    postGen.loading,
    liveDominantPersona,
    showPersonaChangeTransition,
  ]);

  useEffect(() => {
    if (!profileId) {
      boundProfileIdentityRef.current = null;
      previousLivePersonaRef.current = null;
      previousPersonaScoresRef.current = null;
      pendingPersonaChangeRef.current = null;
      setPersonaChangeBanner(null);
      setPersonaChangeBannerExiting(false);
      return;
    }

    const prev = boundProfileIdentityRef.current;
    const sameAccount =
      prev === profileId
      || (prev && slugsReferToSameAccount(prev, profileId))
      || (
        profile?.id
        && profile?.slug
        && prev === String(profile.id).trim()
        && profileId === String(profile.slug).trim()
      );

    boundProfileIdentityRef.current = profileId;

    if (!prev || sameAccount) return;

    previousLivePersonaRef.current = null;
    previousPersonaScoresRef.current = null;
    pendingPersonaChangeRef.current = null;
    setPersonaChangeBanner(null);
    setPersonaChangeBannerExiting(false);
  }, [profileId, profile?.id, profile?.slug]);

  useEffect(() => {
    if (!personaChangeBanner) return undefined;
    if (personaChangeBannerTimerRef.current) {
      clearTimeout(personaChangeBannerTimerRef.current);
    }
    personaChangeBannerTimerRef.current = setTimeout(() => {
      setPersonaChangeBannerExiting(true);
      personaChangeBannerTimerRef.current = setTimeout(() => {
        setPersonaChangeBanner(null);
        setPersonaChangeBannerExiting(false);
        personaChangeBannerTimerRef.current = null;
      }, 380);
    }, 8200);
    return () => {
      if (personaChangeBannerTimerRef.current) {
        clearTimeout(personaChangeBannerTimerRef.current);
        personaChangeBannerTimerRef.current = null;
      }
    };
  }, [personaChangeBanner?.key]);

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
    // Each persona gets one low-score notice for the lifetime of this profile.
    const firedPersonas = loadLowScoreFiredPersonas(profileId);
    const posts = Array.isArray(profile.personaPosts) ? profile.personaPosts : [];

    const ensureLowScorePost = (ui, key) => {
      const score = Math.max(0, Math.min(100, Number(adjustedScores[key]) || 0));
      const rounded = Math.round(score);
      if (rounded >= PERSONA_SCORE_RESTRICT_THRESHOLD) return;

      if (!shouldCreateLowScorePostOnce(posts, firedPersonas, ui)) return;

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
        ensureLowScorePost(ui, key);
      }
      previousPersonaScoresRef.current = {
        productivity: adjustedScores.productivity,
        security: adjustedScores.security,
        social: adjustedScores.social,
      };
      return;
    }

    for (const { ui, key } of scoreKeys) {
      ensureLowScorePost(ui, key);
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

  const clearTellTimers = useCallback(() => {
    if (tellCloseTimerRef.current) {
      clearTimeout(tellCloseTimerRef.current);
      tellCloseTimerRef.current = null;
    }
    tellPhaseTimersRef.current.forEach((id) => clearTimeout(id));
    tellPhaseTimersRef.current = [];
  }, []);

  const scheduleTellPhaseTimers = useCallback((skipRadar = false) => {
    const runId = tellRunIdRef.current + 1;
    tellRunIdRef.current = runId;
    tellPhaseTimersRef.current.forEach((id) => clearTimeout(id));
    if (skipRadar) {
      tellPhaseTimersRef.current = [
        setTimeout(() => {
          if (tellRunIdRef.current !== runId) return;
          setTellPhase('revealing');
        }, TELL_LAYOUT_MS),
        setTimeout(() => {
          if (tellRunIdRef.current !== runId) return;
          setTellPhase('content');
        }, TELL_LAYOUT_MS + TELL_REVEAL_MS),
      ];
      return;
    }
    tellPhaseTimersRef.current = [
      setTimeout(() => {
        if (tellRunIdRef.current !== runId) return;
        setTellPhase('loading');
      }, TELL_LAYOUT_MS),
      setTimeout(() => {
        if (tellRunIdRef.current !== runId) return;
        setTellPhase('revealing');
      }, TELL_LAYOUT_MS + TELL_CROSSFADE_MS + TELL_RADAR_HOLD_MS),
      setTimeout(() => {
        if (tellRunIdRef.current !== runId) return;
        setTellPhase('content');
      }, TELL_LAYOUT_MS + TELL_CROSSFADE_MS + TELL_RADAR_HOLD_MS + TELL_REVEAL_MS),
    ];
  }, []);

  const beginTellForPost = useCallback((post) => {
    if (!post) return;
    clearTellTimers();
    tellRunIdRef.current += 1;

    flushSync(() => {
      setHighlightedPost(post);
      setTellPhase('expanding');
    });
    scheduleTellPhaseTimers(Boolean(post.leaderboard));
  }, [clearTellTimers, scheduleTellPhaseTimers]);

  const closeTell = useCallback(({ preserveHighlight = false } = {}) => {
    clearTellTimers();
    tellRunIdRef.current += 1;

    if (tellPhase === 'idle') return;

    setTellPhase('closing');

    tellCloseTimerRef.current = setTimeout(() => {
      setTellPhase('idle');
      if (!preserveHighlight) setHighlightedPost(null);
      tellCloseTimerRef.current = null;
    }, TELL_CLOSE_FADE_MS);
  }, [clearTellTimers, tellPhase]);

  /** Hide flow must never animate or leave tell open — only the timer confirm UI. */
  const resetTellImmediate = useCallback(() => {
    clearTellTimers();
    tellRunIdRef.current += 1;
    if (tellCloseTimerRef.current) {
      clearTimeout(tellCloseTimerRef.current);
      tellCloseTimerRef.current = null;
    }
    setTellPhase('idle');
    setHighlightedPost(null);
  }, [clearTellTimers]);

  const blockTellOpenBriefly = useCallback(() => {
    blockTellOpenRef.current = true;
    window.setTimeout(() => {
      blockTellOpenRef.current = false;
    }, 0);
  }, []);

  useEffect(() => () => {
    clearTellTimers();
  }, [clearTellTimers]);

  useEffect(() => {
    if (highlightedPost) tellThemePostRef.current = highlightedPost;
  }, [highlightedPost]);

  const tellDisplayPost =
    tellPhase === 'idle'
      ? null
      : (highlightedPost ?? (tellPhase === 'closing' ? tellThemePostRef.current : null));

  const tellActive = tellPhase !== 'idle';
  const feedHighlightedPostId =
    hideTargetPost?.id ?? (tellActive ? highlightedPost?.id : null) ?? null;

  const dashboardCapsuleStyle = useMemo(() => {
    const base = { '--persona-accent': personaColor };
    const applyPostTheme =
      ['loading', 'revealing', 'content', 'closing'].includes(tellPhase) && tellDisplayPost;
    if (!applyPostTheme) return base;
    const pk = String(tellDisplayPost.persona ?? personaKey).toLowerCase();
    const uiKey = PERSONA_ALIASES[pk] ?? pk;
    return {
      ...base,
      '--tell-pill-accent': tellDisplayPost.noteColor ?? PERSONA_COLORS[uiKey] ?? personaColor,
      '--tell-pill-pastel':
        PERSONA_PASTEL_COLORS[pk] ?? PERSONA_PASTEL_COLORS[uiKey] ?? PERSONA_PASTEL_COLORS.security,
    };
  }, [tellDisplayPost, tellPhase, personaColor, personaKey]);

  const handleHighlightPost = useCallback((post) => {
    if (blockTellOpenRef.current) return;

    const isDeselect = highlightedPost?.id === post.id && tellActive;
    if (isDeselect) {
      setHighlightedPost(null);
      closeTell();
      return;
    }
    setHideTargetPost(null);
    setConfirmingHide(false);
    setConfirmingUnhide(false);
    setHideBlocked(false);
    beginTellForPost(post);
  }, [highlightedPost?.id, tellActive, closeTell, beginTellForPost]);

  const hideTargetPostIsHidden = hideTargetPost
    ? (hideTargetPost.leaderboard
        ? isLeaderboardSelfHidden(hideTargetPost.leaderboard.boardId)
        : isPostHiddenFor(hideTargetPost))
    : false;

  const hideTargetPostPersonaLabel = hideTargetPost
    ? (PERSONA_LABEL_BY_POST[hideTargetPost.persona] ?? 'Social')
    : null;

  const tellPostIsHidden = tellDisplayPost
    ? (tellDisplayPost.leaderboard
        ? isLeaderboardSelfHidden(tellDisplayPost.leaderboard.boardId)
        : isPostHiddenFor(tellDisplayPost))
    : false;

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

  const getPostCapsuleRect = useCallback((postId) => {
    if (!postId) return null;
    const el = document.querySelector(`[data-post-id="${CSS.escape(String(postId))}"]`);
    return el?.querySelector('.post-unified-capsule')?.getBoundingClientRect() ?? null;
  }, []);

  const getHighlightedLeaderboardSelfRect = () =>
    document
      .querySelector('.post-card--highlighted .leaderboard-row--viewer-position')
      ?.getBoundingClientRect() ??
    document
      .querySelector('.post-card--highlighted .leaderboard-row--self')
      ?.getBoundingClientRect() ??
    getHighlightedPostRect();

  const getDashboardHideActionRect = () =>
    document
      .querySelector('[data-hide-confirm-action="hide"]')
      ?.getBoundingClientRect() ??
    null;

  const handleConfirmHide = () => {
    if (hideTargetPost) {
      const actionRect = getDashboardHideActionRect();
      if (hideTargetPost.leaderboard) {
        hideLeaderboardSelf(hideTargetPost, actionRect ?? getHighlightedLeaderboardSelfRect(), {
          waypointRect: getHighlightedLeaderboardSelfRect(),
        });
      } else {
        const postWaypointRect =
          getPostCapsuleRect(hideTargetPost.id) ?? getPostCardRect(hideTargetPost.id);
        hidePost(hideTargetPost, actionRect ?? postWaypointRect, {
          waypointRect: postWaypointRect,
        });
      }
    }
    setConfirmingHide(false);
    setHideTargetPost(null);
    resetTellImmediate();
  };

  const handleConfirmUnhide = () => {
    if (hideTargetPost) {
      if (hideTargetPost.leaderboard) {
        revealLeaderboardSelf(hideTargetPost, getPostCardRect(hideTargetPost.id));
      } else {
        revealPost(hideTargetPost, getPostCardRect(hideTargetPost.id));
      }
    }
    setConfirmingUnhide(false);
    setHideTargetPost(null);
    resetTellImmediate();
  };

  const handleTellRedactedUnhideConfirm = useCallback(() => {
    const post = tellDisplayPost ?? highlightedPost;
    if (!post) return;
    if (post.leaderboard) {
      revealLeaderboardSelf(post, getPostCardRect(post.id));
    } else {
      revealPost(post, getPostCardRect(post.id));
    }
  }, [
    tellDisplayPost,
    highlightedPost,
    revealLeaderboardSelf,
    revealPost,
    getPostCardRect,
  ]);

  const handleCancelHide = () => {
    setConfirmingHide(false);
    setConfirmingUnhide(false);
    setHideBlocked(false);
    setHideTargetPost(null);
  };

  const handlePostHideClick = useCallback(
    (post) => {
      if (!profile || !post) return;

      const postIsHidden = post.leaderboard
        ? isLeaderboardSelfHidden(post.leaderboard.boardId)
        : isPostHiddenFor(post);

      blockTellOpenBriefly();
      resetTellImmediate();
      setHideTargetPost(post);

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
      blockTellOpenBriefly,
      resetTellImmediate,
      isPostHiddenFor,
      isLeaderboardSelfHidden,
    ],
  );

  const handlePostTellMeMoreClick = useCallback((post) => {
    if (!post) return;
    setHideTargetPost(null);
    setHideBlocked(false);
    setConfirmingHide(false);
    setConfirmingUnhide(false);
    beginTellForPost(post);
  }, [beginTellForPost]);

  const ownProfileSlug = profile?.slug ?? profile?.id ?? null;
  const leaderboardDirectorySlugs = useMemo(
    () => (Array.isArray(allProfiles) ? allProfiles : [])
      .map((p) => String(p?.slug ?? p?.id ?? '').trim())
      .filter(Boolean),
    [allProfiles],
  );
  const displayProfile = viewedProfile ?? profile;
  const displayPersonaKey = viewedProfile
    ? resolveDominantPersonaKey(viewedProfile)
    : personaKey;
  const displayPersonaColor = PERSONA_COLORS[displayPersonaKey] ?? PERSONA_COLORS.productivity;

  const resetProfileChrome = useCallback(() => {
    setHighlightedPost(null);
    setHideTargetPost(null);
    setConfirmingHide(false);
    setConfirmingUnhide(false);
    setHideBlocked(false);
    clearTellTimers();
    setTellPhase('idle');
  }, [clearTellTimers]);

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
      try {
        const res = await fetch(
          `${API_ORIGIN}/api/profiles/${encodeURIComponent(targetSlug)}`,
          { cache: 'no-store' },
        );
        if (res.ok) {
          target = await res.json();
        }
      } catch (e) {
        console.warn('[profile] fetch by slug failed', e?.message || e);
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
      const normalizedTarget = normalizeProfilesFromApi([target])[0] ?? target;
      setViewedProfile(normalizedTarget);
      const targetKey = String(normalizedTarget?.slug ?? normalizedTarget?.id ?? targetSlug);
      setAllProfiles((prev) => {
        const list = Array.isArray(prev) ? prev : [];
        let matched = false;
        const next = list.map((p) => {
          const key = String(p?.slug ?? p?.id ?? '');
          if (key !== targetKey) return p;
          matched = true;
          return normalizedTarget;
        });
        return matched ? next : [normalizedTarget, ...list];
      });
      setMainView('profile');
      setActiveTab(tab);
      resetProfileChrome();
      bumpProfileEntryReplay?.();
    },
    [allProfiles, ownProfileSlug, resetProfileChrome, setActiveTab, setMainView, bumpProfileEntryReplay, setAllProfiles],
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
      <GenerationParticleAnimator />
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
      <div className="project-brand">
        <button
          type="button"
          className="project-name project-name--button"
          onClick={onGoLanding}
          aria-label="Go to landing page"
        >
          COMPLIANT
        </button>
        {canUseDemoRotateControl(profile) && (
          <DemoRotateButton
            allProfiles={allProfiles}
            reloadProfileFromApi={reloadProfileFromApi}
            spectateController={spectateRevealRef.current}
            onActiveChange={onDemoRotateActiveChange}
            onGeneratingPersona={onDemoGeneratingPersona}
          />
        )}
      </div>
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
                generatingPersona={demoGeneratingPersona ?? postGen.generatingPersona}
                highlightedPostId={feedHighlightedPostId}
                onHighlightPost={handleHighlightPost}
                onPostHide={handlePostHideClick}
                onPostTellMeMore={handlePostTellMeMoreClick}
                tellMeMorePostId={tellActive ? highlightedPost?.id ?? null : null}
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
            isOwnProfile={!viewedProfile}
            ownedProfileSlug={ownProfileSlug}
            leaderboardDirectorySlugs={leaderboardDirectorySlugs}
          />
        )}

        {mainView === 'home' && (
          <aside className="persona-side-panel" aria-label="Persona dashboard">
            <p className="dashboard-top-label">dashboard</p>
            <div
              className="dashboard-capsule dashboard-capsule--figma"
              style={dashboardCapsuleStyle}
              data-tell-step={tellPhase}
            >
              <DashboardTimerRow
                highlightedPost={hideTargetPost}
                highlightedPostIsHidden={hideTargetPostIsHidden}
                highlightedPostPersonaLabel={hideTargetPostPersonaLabel}
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
              />

              <div className="dashboard-tell-row">
                <TellMeMorePill
                  tellPhase={tellPhase}
                  highlightedPost={tellDisplayPost}
                  fallbackPersona={personaKey}
                  personaAccent={personaColor}
                  personaPastel={PERSONA_PASTEL_COLORS[personaKey] ?? PERSONA_PASTEL_COLORS.security}
                  isAnalysisRedacted={Boolean(tellDisplayPost && tellPostIsHidden)}
                  onRedactedUnhideConfirm={tellPostIsHidden ? handleTellRedactedUnhideConfirm : null}
                  onOpenProfile={handleOpenProfile}
                  authorSlug={tellDisplayPost?.authorSlug ?? ownProfileSlug}
                  leaderboardDirectorySlugs={leaderboardDirectorySlugs}
                />
              </div>
            </div>

              {personaChangeBanner ? (
                <PersonaChangeCapsule
                  key={personaChangeBanner.key}
                  userDisplayName={personaChangeBanner.userDisplayName}
                  fromPersona={personaChangeBanner.fromPersona}
                  toPersona={personaChangeBanner.toPersona}
                  exiting={personaChangeBannerExiting}
                />
              ) : (
                <DashboardPersonaRings
                  scores={adjustedScores}
                  dominantPersona={personaKey}
                  deltas={personaDeltas}
                  onRingClick={cyclePersona}
                  wigglePersonaKey={personaRingWiggle.key}
                  wiggleNonce={personaRingWiggle.nonce}
                />
              )}
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
  const streamPostsBaselineRef = useRef([]);
  const generationSessionActiveRef = useRef(false);
  const [updateSessionActive, setUpdateSessionActive] = useState(false);
  const deferCompliantRef = useRef(false);
  const pendingCompliantRef = useRef([]);
  const spectateRevealRef = useRef(null);
  if (!spectateRevealRef.current) {
    spectateRevealRef.current = createFeedSpectatorRevealController({
      setAllProfiles,
    });
  }
  const [demoRotateActive, setDemoRotateActive] = useState(false);
  const [demoGeneratingPersona, setDemoGeneratingPersona] = useState(null);
  const demoRotateActiveRef = useRef(false);
  const personaDeltasClearRef = useRef(null);
  /** Bumps when user navigates onto the profile view — drives MainScoreStyle ring replay only then. */
  const [profileScoreReplayNonce, setProfileScoreReplayNonce] = useState(0);
  const prevMainViewRef = useRef(null);
  const [landingEnteringProfile, setLandingEnteringProfile] = useState(false);
  const [landingOwnedProfile, setLandingOwnedProfile] = useState(null);
  const [linkedProfileSlug, setLinkedProfileSlug] = useState(() => readLinkedProfileSlug());
  const landingEnterProfileTimerRef = useRef(null);
  const landingManualReturnRef = useRef(false);
  /** True when opened via Electron “View on web” (`#access_token=…` in URL). */
  const openedFromElectronRef = useRef(false);

  const tryDeferCompliant = useCallback((apply) => {
    if (!deferCompliantRef.current) return false;
    pendingCompliantRef.current.push(apply);
    return true;
  }, []);

  const flushDeferredCompliant = useCallback(({ apply = true } = {}) => {
    deferCompliantRef.current = false;
    const pending = pendingCompliantRef.current.splice(0);
    if (!apply) return;
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
    landingManualReturnRef.current = false;
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
    landingManualReturnRef.current = false;
    setMainView('home');
  }, []);

  const handleGoLanding = useCallback(() => {
    landingManualReturnRef.current = true;
    setLandingEnteringProfile(false);
    if (landingEnterProfileTimerRef.current) {
      clearTimeout(landingEnterProfileTimerRef.current);
      landingEnterProfileTimerRef.current = null;
    }
    setMainView('landing');
  }, []);

  useEffect(() => {
    if (!landingOwnedProfile && mainView === 'login') {
      landingManualReturnRef.current = false;
      setMainView('landing');
    }
  }, [landingOwnedProfile, mainView]);

  const handleLandingLoginClick = useCallback(() => {
    setMainView('login');
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
    landingManualReturnRef.current = false;
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
    if (demoRotateActiveRef.current) return;
    const snapshot = Array.isArray(profiles) ? profiles : [];
    queueMicrotask(() => {
      if (cancelledRef?.cancelled) return;
      if (demoRotateActiveRef.current) return;
      spectateRevealRef.current?.ingestProfiles(snapshot);
    });
  }, []);

  useEffect(() => {
    demoRotateActiveRef.current = demoRotateActive;
  }, [demoRotateActive]);

  const handleDemoRotateActiveChange = useCallback((active) => {
    setDemoRotateActive(active);
    if (!active) setDemoGeneratingPersona(null);
  }, []);

  const handleDemoGeneratingPersona = useCallback((persona) => {
    setDemoGeneratingPersona(persona ?? null);
  }, []);

  // Re-apply the live reveal order onto a fresh API snapshot before it replaces
  // allProfiles, so a directory poll / reload can't drop already-revealed posts
  // back to their stale `createdAt` position (which would make the feed jump
  // back to the wrong order between reveals).
  const reconcileProfilesRevealOrder = useCallback((profiles) => {
    const controller = spectateRevealRef.current;
    if (!controller?.reconcileRevealOrder || !Array.isArray(profiles)) return profiles;
    return profiles.map((p) =>
      p && Array.isArray(p.personaPosts)
        ? { ...p, personaPosts: controller.reconcileRevealOrder(p.personaPosts) }
        : p,
    );
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
    if (landingManualReturnRef.current) return;
    if (mainView !== 'landing' && mainView !== 'login') return;

    const urlSlug = readViewProfileSlugFromUrl();
    const fromElectron = openedFromElectronRef.current;
    const hasHostedSession = Boolean(readHostedSession()?.access_token);
    const shouldDeepLink =
      fromElectron
      || (urlSlug && hasHostedSession && isHostedApiOrigin())
      || (urlSlug && !isHostedApiOrigin());

    if (!shouldDeepLink) return;

    let target =
      landingOwnedProfile
      ?? (profile
        && (!urlSlug || String(profile.slug ?? profile.id) === String(urlSlug))
        ? profile
        : null);
    if (!target && urlSlug) {
      target = (Array.isArray(allProfiles) ? allProfiles : []).find(
        (p) => p?.slug === urlSlug || p?.id === urlSlug,
      ) ?? null;
    }
    if (!target) return;

    const wasFromElectron = fromElectron;
    openedFromElectronRef.current = false;
    const slug = target.slug ?? target.id ?? urlSlug;
    if (slug) persistProfileSlug(slug);
    setProfile((prev) => mergeOwnedProfileFromApi(prev, target, {
      preserveClientPosts: generationSessionActiveRef.current,
    }));
    // Opening from the Compliant app lands on the feed; a shared profile link
    // (URL slug only) still deep-links into the profile view.
    if (wasFromElectron) {
      setMainView('home');
    } else {
      setActiveTab('profile');
      setMainView('profile');
    }
  }, [landingOwnedProfile, profile, allProfiles, mainView]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (ingestHostedSessionFromHash()) {
        openedFromElectronRef.current = true;
      }
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
        const data = await fetchPublicDirectorySnapshot();
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

        const normalized = reconcileProfilesRevealOrder(
          normalizeProfilesFromApi(filterProfilesNotDeleted(data, deleted)),
        );
        ingestProfileAvatars(normalized);
        inferPublicMediaConfigFromProfiles(normalized);

        if (isHostedApiOrigin() && readHostedSession()?.access_token) {
          const meRes = await fetchWithHostedAuth(`${API_ORIGIN}/api/profile/me`).catch(() => null);
          if (!meRes?.ok) {
            if (shouldResetHostedSessionForProfileMeStatus(meRes?.status)) {
              if (demoRotateActiveRef.current) {
                await refreshHostedSession().catch(() => null);
              } else {
                clearHostedAccountStorage();
                setLinkedProfileSlug(null);
                setProfile(null);
                setLandingOwnedProfile(null);
              }
              setAllProfiles(normalized);
              scheduleSpectatorIngest(normalized, cancelledRef);
              return;
            }
          } else {
            const meJson = await meRes.json().catch(() => ({}));
            const meProfile = meJson?.profile ?? null;
            if (meProfile) {
              // `/api/profile/me` returns posts WITHOUT `_feedRevealSeq`. Reconcile
              // them back into reveal order here, or the owner's freshly revealed
              // posts lose their sequence on every poll/navigation and sink below
              // spectator posts that still carry theirs — the feed reshuffles when
              // you leave and return to home. (The directory `normalized` is already
              // reconciled; this `/me` payload is a separate, un-reconciled fetch.)
              const reconciledMe = reconcileProfilesRevealOrder([meProfile])[0] ?? meProfile;
              const meSlug = String(reconciledMe.slug ?? reconciledMe.id ?? '').trim();
              if (meSlug) {
                setLinkedProfileSlug(meSlug);
                persistProfileSlug(meSlug);
              }
              setLandingOwnedProfile(reconciledMe);
              setProfile((prev) =>
                mergeOwnedProfileFromApi(prev, reconciledMe, {
                  preserveClientPosts: generationSessionActiveRef.current,
                }),
              );
              const directory = [...normalized];
              const idx = directory.findIndex(
                (p) => p?.slug === meSlug || p?.id === meSlug,
              );
              if (idx >= 0) {
                directory[idx] = mergeOwnedProfileFromApi(directory[idx], reconciledMe, {
                  preserveClientPosts: generationSessionActiveRef.current,
                });
              } else {
                directory.unshift(reconciledMe);
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
  }, [syncAccountDeletionState, mainView, linkedProfileSlug, applyFullAccountReset, scheduleSpectatorIngest, syncDeletedProfileIds, reconcileProfilesRevealOrder]);

  const reloadProfileFromApi = useCallback(async ({
    skipPostsMerge = false,
    forcePostsMerge = false,
    preservePersonaPostsForSlugs = [],
  } = {}) => {
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
    const normalized = reconcileProfilesRevealOrder(normalizeProfilesFromApi(filtered));
    ingestProfileAvatars(normalized);
    const preserveSet = new Set(
      (Array.isArray(preservePersonaPostsForSlugs) ? preservePersonaPostsForSlugs : [])
        .map((s) => String(s || '').trim())
        .filter(Boolean),
    );
    if (preserveSet.size > 0) {
      setAllProfiles((prev) => {
        const prevList = Array.isArray(prev) ? prev : [];
        return normalized.map((p) => {
          const slug = String(p?.slug ?? p?.id ?? '');
          if (!preserveSet.has(slug)) return p;
          const old = prevList.find((row) => String(row?.slug ?? row?.id ?? '') === slug);
          if (!Array.isArray(old?.personaPosts)) return p;
          return { ...p, personaPosts: old.personaPosts };
        });
      });
      spectateRevealRef.current?.ingestProfiles(normalized);
    } else {
      setAllProfiles(normalized);
      queueMicrotask(() => {
        spectateRevealRef.current?.ingestProfiles(normalized);
      });
    }
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
  }, [deletedProfileIds, linkedProfileSlug, reconcileProfilesRevealOrder]);

  useEffect(() => {
    // Your own profile is never "spectator" content: your posts are revealed by
    // the generation flow (the lobbing particle), not the spectator controller
    // (the descend/demo particle meant for other users). Always exclude your slug
    // from spectator reveals — otherwise the first poll after a generation sees
    // your fresh posts as "new from someone else" and replays them with the demo
    // animation. Order for your posts is still preserved separately via
    // reconcileProfilesRevealOrder + recordRevealOrder, which don't depend on this.
    const operatorSlug = profile?.slug ?? profile?.id ?? null;
    spectateRevealRef.current?.setSkipSlug(linkedProfileSlug ?? operatorSlug);
  }, [linkedProfileSlug, profile?.slug, profile?.id]);

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
    // Keep `_feedRevealSeq` so existing posts hold their place; only clear the
    // active-entry markers so they don't re-animate.
    streamPostsBaselineRef.current = settleFeedPostsAsBaseline(p.personaPosts ?? []);

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
      // Shared global reveal counter so freshly generated own posts sort
      // newest-on-top against already-revealed spectator posts.
      nextRevealSeq: () => spectateRevealRef.current?.allocRevealSeq?.() ?? 0,
      getBaseline: () => streamPostsBaselineRef.current,
      beforeRevealPost: generationBeforeReveal,
      onPostRevealed: (persona) => {
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
          if (!prev.loading || prev.phase !== 'generating') return prev;
          const plannedPersona = personaAfterReveal(prev.generationPlan, planRevealCount);
          return { ...prev, generatingPersona: persona ?? plannedPersona };
        });
      },
      // No flushSync: the 2s gap between reveals already prevents update
      // coalescing, and forcing synchronous renders here stalls the main
      // thread when the feed has 50+ cards — which in turn blocks the
      // stream reader from draining further posts.
      onPostsChange: (personaPosts) => {
        spectateRevealRef.current?.recordRevealOrder?.(personaPosts);
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

      await revealQueue.waitUntilIdle({ waitForEnterAnimation: false });
      await reloadProfileFromApi({ skipPostsMerge: true });
      schedulePersonaDeltasClearAfterGenerate();
    } catch (e) {
      await revealQueue.waitUntilIdle().catch(() => {});
      throw e;
    } finally {
      disarmIdleWatchdog();
    }
  }, [
    profile,
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
          // Collapse any duplicate COMPLIANT/system posts (mirrors the manual
          // generate path) so an already-duplicated row never renders twice.
          // Settle (keep `_feedRevealSeq`) so existing posts hold their place
          // instead of dropping to stale createdAt order when generation starts.
          streamPostsBaselineRef.current = mergePostsPrepend(
            settleFeedPostsAsBaseline(owned.personaPosts ?? []),
            [],
          );
          await runHostedPostGenerationWithReveal({
            jobId,
            reloadProfileFromApi,
            getBaselinePosts: () => streamPostsBaselineRef.current,
            beforeRevealPost: generationBeforeReveal,
            nextRevealSeq: () => spectateRevealRef.current?.allocRevealSeq?.() ?? 0,
            onGenerationPlan: applyGenerationPlan,
            onPostRevealed: (persona) => {
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
                if (!prev.loading || prev.phase !== 'generating') return prev;
                const plannedPersona = personaAfterReveal(prev.generationPlan, planRevealCount);
                return { ...prev, generatingPersona: persona ?? plannedPersona };
              });
            },
            applyRevealedPosts: (personaPosts) => {
              spectateRevealRef.current?.recordRevealOrder?.(personaPosts);
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
      flushDeferredCompliant({ apply: false });
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
        const triggerRes = await fetch(`${API_ORIGIN}/api/generation-jobs/trigger-update`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...hostedAuthHeaders(),
          },
          body: JSON.stringify({ profileSlug: slug }),
        });
        const triggerBody = await triggerRes.json().catch(() => ({}));
        if (!triggerRes.ok) {
          throw new Error(triggerBody?.error || `Generation queue failed (${triggerRes.status})`);
        }
        generationJobId = triggerBody?.jobId ?? null;
        if (!generationJobId) {
          throw new Error('Generation queue did not return a job id');
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
    // Settle (NOT strip) so existing posts keep their `_feedRevealSeq` and hold
    // their place in the feed; new generated posts get a higher sequence and
    // reveal on top. Stripping the sequence here made already-revealed posts
    // fall back to stale createdAt order and visibly sink during the deltas step.
    const freshServerPosts = settleFeedPostsAsBaseline(freshProfile?.personaPosts ?? []);
    setProfile((prev) => {
      const livePosts = settleFeedPostsAsBaseline(prev?.personaPosts ?? []);
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
          beforeRevealPost: generationBeforeReveal,
          nextRevealSeq: () => spectateRevealRef.current?.allocRevealSeq?.() ?? 0,
          onGenerationPlan: applyGenerationPlan,
          onPostRevealed: (persona) => {
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
              if (!prev.loading || prev.phase !== 'generating') return prev;
              const plannedPersona = personaAfterReveal(prev.generationPlan, planRevealCount);
              return { ...prev, generatingPersona: persona ?? plannedPersona };
            });
          },
          applyRevealedPosts: (personaPosts) => {
            spectateRevealRef.current?.recordRevealOrder?.(personaPosts);
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
      // Discard COMPLIANT notices that were queued during the generation flow;
      // generation should reveal only generated persona posts.
      flushDeferredCompliant({ apply: false });
      // Reconcile profile fields without replacing the animated client post list
      // with a possibly stale API snapshot.
      try {
        await reloadProfileFromApi({ skipPostsMerge: true });
      } catch {
        /* network hiccup — next background poll will reconcile */
      }
      generationSessionActiveRef.current = false;
      setUpdateSessionActive(false);
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
          onLoginClick={handleLandingLoginClick}
          profileEntryLoading={landingEnteringProfile}
        />
      </>
    );
  }

  if (mainView === 'login') {
    return (
      <LoginEntryPage
        profile={landingOwnedProfile}
        onEnterProfile={handleLandingEnterProfile}
        onBackToLanding={handleGoLanding}
        loading={landingEnteringProfile}
      />
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
        onGoLanding={handleGoLanding}
        reloadProfileFromApi={reloadProfileFromApi}
        spectateRevealRef={spectateRevealRef}
        demoRotateActive={demoRotateActive}
        onDemoRotateActiveChange={handleDemoRotateActiveChange}
        demoGeneratingPersona={demoGeneratingPersona}
        onDemoGeneratingPersona={handleDemoGeneratingPersona}
        setAllProfiles={setAllProfiles}
      />
    </LiveScoringProvider>
  );
}
