import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { flushSync } from 'react-dom';
import Sidebar from '@/layout/Sidebar.jsx';
import ScrollArea from '@/layout/ScrollArea.jsx';
import ProfileView from '@/features/profile/ProfileView.jsx';
import HomeTab from '@/features/home/HomeTab.jsx';
import LandingPage from '@/landing-page/LandingPage.jsx';
import LeaderboardsTab from '@/features/profile/tabs/LeaderboardsTab.jsx';
import {
  getPersonaScoresNormalized,
  personaPercentToRingFill,
} from '@/lib/profileUtils.js';
import HarvestScreen from '@/features/harvest/HarvestScreen.jsx';
import PersonaDeltaSummary from '@/features/harvest/PersonaDeltaSummary.jsx';
import GeneratingContentLabel from '@/features/harvest/GeneratingContentLabel.jsx';
import {
  DASHBOARD_UPDATE_INTERVAL_MS,
  formatDashboardCountdown,
  getDashboardControlLayout,
} from '@/features/harvest/dashboardUpdateFlow.js';
import '@/features/harvest/harvest.css';
import TellMeMorePill from '@/features/inferenceChain/TellMeMorePill.jsx';
import '@/features/inferenceChain/inferenceChain.css';
import { applyAccountDeletionFromServer } from '@/lib/liveScoringStorage.js';
import { LiveScoringProvider } from '@/features/liveScoring/LiveScoringContext.jsx';
import ScoreAnimator from '@/features/liveScoring/ScoreAnimator.jsx';
import { useLiveScoring } from '@/features/liveScoring/useLiveScoring.js';
import { normalizePostHideKey } from '@/lib/postHideKey.js';
const API_ORIGIN =
  (import.meta?.env?.VITE_API_ORIGIN && String(import.meta.env.VITE_API_ORIGIN)) ||
  'http://localhost:3001';

const GENERATE_API_ORIGIN =
  (import.meta?.env?.VITE_GENERATE_API_ORIGIN && String(import.meta.env.VITE_GENERATE_API_ORIGIN)) ||
  'http://localhost:3010';

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
// Pastel companion colors for hide-pill backgrounds. Security pastel matches the
// Figma spec (#BCCDF5); the others were picked to mirror that lightness ratio.
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

function createCompliantPersonaChangePost({ profile, fromPersona, toPersona }) {
  const userDisplayName = displayNameFromProfileLite(profile);
  const fromLabel = PERSONA_LABELS[fromPersona] ?? 'Unknown';
  const toLabel = PERSONA_LABELS[toPersona] ?? 'Unknown';
  const createdAt = Date.now();

  return {
    id: `compliant-persona-change-${createdAt}-${fromPersona}-${toPersona}`,
    persona: toPersona,
    createdAt,
    content: `Due to behavior on COMPLIANT, ${userDisplayName}'s main persona changed from ${fromLabel} to ${toLabel}.`,
    compliantPersonaChange: {
      fromPersona,
      toPersona,
      userDisplayName,
      fromLabel,
      toLabel,
    },
    _feedEnter: true,
    _feedKey: `compliant-persona-change-${createdAt}`,
    _feedRevealSeq: createdAt,
  };
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

function axisKeyToScoreKey(axisKey) {
  const k = String(axisKey || '').toLowerCase();
  if (k === 'popularity') return 'social';
  return k;
}

function formatRingDelta(delta) {
  const n = Number(delta);
  if (!Number.isFinite(n)) return null;
  if (n > 0) return { text: `+${n}`, mod: 'up' };
  if (n < 0) return { text: String(n), mod: 'down' };
  return { text: '=', mod: 'flat' };
}

/** Keep the longer post list when API returns stale data (e.g. after Electron re-sync). */
function mergeProfileFromApi(prev, incoming) {
  if (!incoming) return prev ?? null;
  if (!prev) return incoming;
  const prevPosts = Array.isArray(prev.personaPosts) ? prev.personaPosts : [];
  const incomingPosts = Array.isArray(incoming.personaPosts) ? incoming.personaPosts : [];
  if (incomingPosts.length >= prevPosts.length) return incoming;
  return { ...incoming, personaPosts: prevPosts };
}

function AppInner({
  mainView,
  setMainView,
  activeTab,
  setActiveTab,
  profile,
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
    hidePost,
    revealPost,
    hideLeaderboardSelf,
    revealLeaderboardSelf,
    isLeaderboardSelfHidden,
    isHidden,
  } = useLiveScoring();
  const [confirmingHide, setConfirmingHide] = useState(false);
  const [highlightedPost, setHighlightedPost] = useState(null);
  const [selectionPulseFlip, setSelectionPulseFlip] = useState(false);
  const [hideNudge, setHideNudge] = useState(false);
  const [tellExpanded, setTellExpanded] = useState(false);
  const [tellClosing, setTellClosing] = useState(false);
  const tellCloseTimerRef = useRef(null);
  const [compliantPosts, setCompliantPosts] = useState([]);
  const previousLivePersonaRef = useRef(null);
  const updateTimerStartRef = useRef(Date.now());
  const [updateRemainingMs, setUpdateRemainingMs] = useState(DASHBOARD_UPDATE_INTERVAL_MS);

  const personaKey = personaOverride ?? liveDominantPersona;
  const personaColor = PERSONA_COLORS[personaKey] ?? PERSONA_COLORS.productivity;
  const personaToggleLabel =
    personaKey === 'productivity' ? 'P' : personaKey === 'security' ? 'S' : '☺';
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
    if (!profile || !liveDominantPersona) return;
    const previous = previousLivePersonaRef.current;
    previousLivePersonaRef.current = liveDominantPersona;
    if (!previous || previous === liveDominantPersona) return;

    const post = createCompliantPersonaChangePost({
      profile,
      fromPersona: previous,
      toPersona: liveDominantPersona,
    });
    setCompliantPosts((prev) => [post, ...prev].slice(0, 6));
  }, [liveDominantPersona, profile]);

  const homeFeedProfile = useMemo(() => {
    if (!profile || compliantPosts.length === 0) return profile;
    const personaPosts = Array.isArray(profile.personaPosts) ? profile.personaPosts : [];
    return {
      ...profile,
      personaPosts: [...compliantPosts, ...personaPosts],
    };
  }, [compliantPosts, profile]);

  const dashboardRingOrder = useMemo(() => {
    const others = PERSONA_KEYS.filter((k) => k !== personaKey);
    if (others.length !== 2) return [...PERSONA_KEYS];
    return [others[0], personaKey, others[1]];
  }, [personaKey]);

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
    setHideNudge(false); // dismiss "select a post first" immediately when user picks one
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

  const getHighlightedLeaderboardSelfRect = () =>
    document
      .querySelector('.post-card--highlighted .leaderboard-row--self')
      ?.getBoundingClientRect() ??
    getHighlightedPostRect();

  const handleDashboardHide = () => {
    if (!profile) return;
    if (highlightedPost) {
      const isLeaderboard = Boolean(highlightedPost.leaderboard);
      if (highlightedPostIsHidden) {
        if (isLeaderboard) {
          revealLeaderboardSelf(highlightedPost, getHighlightedLeaderboardSelfRect());
        } else {
          revealPost(highlightedPost, getHighlightedPostRect());
        }
        setHighlightedPost(null);
        setConfirmingHide(false);
      } else {
        // Encode "only hide a leaderboard if user is in it" — userRank null means not present.
        if (isLeaderboard && highlightedPost.leaderboard.userRank == null) {
          setConfirmingHide(false);
          return;
        }
        setConfirmingHide(true);
        setHideNudge(false);
      }
    } else {
      setConfirmingHide(false);
      setHideNudge(true);
      setTimeout(() => setHideNudge(false), 4000);
    }
  };

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

  const handleCancelHide = () => {
    setConfirmingHide(false);
  };

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
      <Sidebar mainView={mainView} onSelectView={setMainView} />
      <div className="page">
        {mainView === 'home' && (
          <div className="main-col">
            <ScrollArea key="home" mode="home">
              <HomeTab
                profile={homeFeedProfile}
                isGeneratingPosts={postGen.phase === 'generating'}
                highlightedPostId={highlightedPost?.id ?? null}
                onHighlightPost={handleHighlightPost}
                personaBadgePersona={personaKey}
              />
            </ScrollArea>
          </div>
        )}

        {mainView === 'profile' && (
          <ProfileView
            profile={profile}
            personaColor={personaColor}
            personaBadgePersona={personaKey}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            mainScoreEntryReplayKey={profileScoreReplayNonce}
            isGeneratingPosts={postGen.phase === 'generating'}
            generateApiOrigin={GENERATE_API_ORIGIN}
          />
        )}

        {mainView === 'home' && (
          <aside className="persona-side-panel" aria-label="Persona dashboard">
            <p className="dashboard-top-label">dashboard</p>
            <div
              className={`dashboard-capsule dashboard-capsule--figma${tellExpanded ? ' is-tell-expanded' : ''}${tellClosing ? ' is-tell-closing' : ''}`}
              style={{ '--persona-accent': personaColor }}
            >
              {(() => {
                const personaKeyForPill = String(
                  highlightedPost?.persona ?? personaKey,
                ).toLowerCase();
                const hidePillAccent = highlightedPost?.noteColor ?? personaColor;
                const hidePillPastel =
                  PERSONA_PASTEL_COLORS[personaKeyForPill] ??
                  PERSONA_PASTEL_COLORS.security;
                const confirmActive =
                  confirmingHide && highlightedPost && !highlightedPostIsHidden;
                const points = Math.abs(
                  Number(highlightedPost?.systemDeltaPct) || 1,
                );
                const personaLabelLower = (
                  highlightedPostPersonaLabel ?? PERSONA_LABELS[personaKey] ?? 'Social'
                ).toLowerCase();

                const pillStyle = {
                  '--hide-pill-accent': hidePillAccent,
                  '--hide-pill-pastel': hidePillPastel,
                };
                const leaderboardSelected = Boolean(highlightedPost?.leaderboard);
                const leaderboardPillClass = leaderboardSelected
                  ? ' dashboard-hide-pill--leaderboard-selected'
                  : '';

                // eye-off (slashed): used for normal, armed-hidden, confirm mini, nudge
                const EyeOffIcon = (props) => (
                  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
                    <path d="M12 6.5c2.76 0 5 2.24 5 5 0 .51-.1 1-.24 1.46l3.06 3.06c1.39-1.23 2.49-2.77 3.18-4.53C21.27 7.11 17 4 12 4c-1.27 0-2.49.2-3.64.57l2.17 2.17c.47-.14.96-.24 1.47-.24zM2.71 3.16a.996.996 0 0 0 0 1.41l1.97 1.97C3.06 7.83 1.77 9.53 1 11.5 2.73 15.89 7 19 12 19c1.52 0 2.97-.3 4.31-.82l2.72 2.72a.996.996 0 1 0 1.41-1.41L4.13 3.16c-.39-.39-1.03-.39-1.42 0zM12 16.5c-2.76 0-5-2.24-5-5 0-.77.18-1.5.49-2.14l1.57 1.57c-.03.18-.06.37-.06.57 0 1.66 1.34 3 3 3 .2 0 .38-.03.57-.07l1.57 1.57c-.64.32-1.37.5-2.14.5zm2.97-5.33a2.97 2.97 0 0 0-2.64-2.64l2.64 2.64z" />
                  </svg>
                );
                // plain open eye: used for armed (unhidden post highlighted)
                const EyeIcon = (props) => (
                  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
                    <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
                  </svg>
                );
                const CursorIcon = (props) => (
                  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
                    <path d="M4 2v16.4l4.2-3.9 2.4 5.5 2.5-1.1-2.4-5.5H16L4 2z" />
                  </svg>
                );

                const GhostPost = () => (
                  <div
                    className="dashboard-hide-pill__bg-post"
                    aria-hidden
                  >
                    <div className="dashboard-hide-pill__avatar" />
                    <div className="dashboard-hide-pill__lines">
                      <div className="dashboard-hide-pill__line" />
                      <div className="dashboard-hide-pill__line dashboard-hide-pill__line--short" />
                      <div className="dashboard-hide-pill__line dashboard-hide-pill__line--tiny" />
                    </div>
                  </div>
                );

                if (confirmActive) {
                  return (
                    <div
                      className="dashboard-actions-row dashboard-actions-row--confirm"
                    >
                      <div
                        className={`dashboard-hide-pill dashboard-hide-pill--confirm${leaderboardPillClass}`}
                        role="alertdialog"
                        aria-labelledby="hide-confirm-title-inline"
                        style={pillStyle}
                      >
                        <div className="dashboard-hide-pill__confirm-left">
                          <h3
                            id="hide-confirm-title-inline"
                            className="dashboard-hide-pill__confirm-title"
                          >
                            {leaderboardSelected
                              ? 'Hide your ranking?'
                              : 'Hide this post?'}
                          </h3>
                          <p className="dashboard-hide-pill__confirm-body">
                            {leaderboardSelected ? (
                              <>
                                Hiding your position will cost you{' '}
                                <span className="dashboard-hide-pill__confirm-points">
                                  -{points}%
                                </span>{' '}
                                on your {personaLabelLower} score and remove
                                your row from this leaderboard.
                              </>
                            ) : (
                              <>
                                If you hide this post, you will lose{' '}
                                <span className="dashboard-hide-pill__confirm-points">
                                  -{points}%
                                </span>{' '}
                                on your {personaLabelLower} score and no one else will be
                                able to see this post.
                              </>
                            )}
                          </p>
                          <div className="dashboard-hide-pill__confirm-actions">
                            <button
                              type="button"
                              className="dashboard-hide-pill__confirm-btn dashboard-hide-pill__confirm-btn--cancel"
                              onClick={handleCancelHide}
                            >
                              {leaderboardSelected ? 'Stay visible' : 'Keep post'}
                            </button>
                            <button
                              type="button"
                              className="dashboard-hide-pill__confirm-btn dashboard-hide-pill__confirm-btn--hide"
                              onClick={handleConfirmHide}
                            >
                              {leaderboardSelected ? 'Hide ranking' : 'Hide anyway'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }

                let stateModifier = 'dashboard-hide-pill--normal';
                if (hideNudge) stateModifier = 'dashboard-hide-pill--nudge';
                else if (highlightedPostIsHidden)
                  stateModifier = 'dashboard-hide-pill--armed-hidden';
                else if (highlightedPost)
                  stateModifier = 'dashboard-hide-pill--armed';
                const selectionPulseClass = highlightedPost
                  ? ` dashboard-hide-pill--select-pulse-${selectionPulseFlip ? 'b' : 'a'}`
                  : '';

                return (
                  <div className="dashboard-actions-row">
                    <button
                      type="button"
                      className={`dashboard-hide-pill ${stateModifier}${selectionPulseClass}${leaderboardPillClass}`}
                      onClick={handleDashboardHide}
                      disabled={!profile}
                      style={pillStyle}
                    >
                      <GhostPost />
                      <span className="dashboard-hide-pill__icon">
                        {hideNudge ? (
                          <CursorIcon width="56" height="56" />
                        ) : highlightedPostIsHidden ? (
                          // hidden post selected → open eye = "you can reveal it"
                          <EyeIcon width="56" height="56" />
                        ) : (
                          // normal / unhidden-armed → eye-off = "you can hide it"
                          <EyeOffIcon width="56" height="56" />
                        )}
                      </span>
                      {hideNudge && (
                        <span className="dashboard-hide-pill__nudge-capsule">
                          Select a post first
                        </span>
                      )}
                    </button>
                    {dashboardLayout.actionSlot === 'harvest' ? (
                      <div
                        className="dashboard-timer-card dashboard-timer-card--update dashboard-timer-card--action-update dashboard-timer-card--action-status dashboard-timer-card--harvest"
                        aria-busy="true"
                      >
                        <HarvestScreen progress={harvestProgress} error={harvestError} />
                      </div>
                    ) : dashboardLayout.actionSlot === 'deltas' ? (
                      <div
                        className="dashboard-timer-card dashboard-timer-card--update dashboard-timer-card--action-update dashboard-timer-card--action-status dashboard-timer-card--analysis"
                        aria-live="polite"
                      >
                        <PersonaDeltaSummary
                          deltas={personaDeltas}
                          scores={adjustedScores}
                          dominantPersona={personaKey}
                        />
                      </div>
                    ) : dashboardLayout.actionSlot === 'generating' ? (
                      <div
                        className="dashboard-timer-card dashboard-timer-card--update dashboard-timer-card--action-update dashboard-timer-card--action-status dashboard-timer-card--generating"
                        aria-busy="true"
                      >
                        <GeneratingContentLabel />
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="dashboard-timer-card dashboard-timer-card--update dashboard-timer-card--action-update"
                        disabled={postGen.loading || !profile}
                        onClick={handleGeneratePersonaPosts}
                      >
                        <span
                          className="dashboard-update-timer"
                          aria-label={`Next update in ${updateTimerLabel}`}
                        >
                          <span className="dashboard-update-label">Next update in</span>
                          <span className="dashboard-update-time">{updateTimerLabel}</span>
                        </span>
                        {postGen.error ? (
                          <span className="generate-posts-error" role="alert">
                            {postGen.error}
                          </span>
                        ) : null}
                      </button>
                    )}
                  </div>
                );
              })()}

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

              <div className="dashboard-rings">
                {dashboardRingOrder.map((k) => {
                  const ringColor = PERSONA_COLORS[k];
                  const scoreKey = k === 'popularity' ? 'social' : k;
                  const value = Math.max(0, Math.min(100, adjustedScores[scoreKey] ?? 0));
                  const ringFill = personaPercentToRingFill(value);
                  const R = 32;
                  const CIRC = 2 * Math.PI * R;
                  const dash = CIRC * (ringFill / 100);
                  const gap = CIRC - dash;
                  const isDominantRing = k === personaKey;
                  const ringDelta = formatRingDelta(personaDeltas?.[axisKeyToScoreKey(k)]);
                  return (
                    <button
                      key={k}
                      type="button"
                      data-persona-ring={k}
                      className={`dashboard-ring-card${isDominantRing ? ' dashboard-ring-card--dominant' : ''}`}
                      style={{ '--ring-accent': ringColor }}
                      onClick={cyclePersona}
                      aria-label={`${PERSONA_LABELS[k]} ${value}%`}
                    >
                      <svg
                        className="dashboard-ring-svg"
                        viewBox="0 0 80 80"
                        aria-hidden
                      >
                        <circle
                          cx="40"
                          cy="40"
                          r={R}
                          fill="none"
                          stroke="rgba(0, 0, 0, 0.18)"
                          strokeWidth="8"
                        />
                        <circle
                          cx="40"
                          cy="40"
                          r={R}
                          fill="none"
                          stroke="#000"
                          strokeWidth="8"
                          strokeDasharray={`${dash} ${gap}`}
                          strokeLinecap="round"
                          style={{ transform: 'rotate(-90deg)', transformOrigin: '40px 40px' }}
                        />
                      </svg>
                      <span className="dashboard-ring-label">
                        {PERSONA_LABELS[k].toLowerCase()}
                      </span>
                      <span className="dashboard-ring-score">
                        <span data-persona-ring-score={k}>
                          {Number.isFinite(value) ? value : '—'}
                        </span>
                        {Number.isFinite(value) ? (
                          <span className="dashboard-ring-score-pct" aria-hidden>
                            %
                          </span>
                        ) : null}
                        {ringDelta ? (
                          <span
                            className={`dashboard-ring-delta dashboard-ring-delta--${ringDelta.mod}`}
                          >
                            {ringDelta.text}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  );
                })}
              </div>
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
          return;
        }
        setProfile((prev) => mergeProfileFromApi(prev, data[0]));
      } catch {
        if (cancelled) return;
      }
    };

    load();
    const id = setInterval(load, 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [syncAccountDeletionState]);

  const reloadProfileFromApi = useCallback(async () => {
    const res = await fetch(`${API_ORIGIN}/api/profiles`);
    if (!res.ok) throw new Error('Failed to reload profile');
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    const incoming = data[0];
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
    return <LandingPage onEnterDemo={() => setMainView('profile')} />;
  }

  return (
    <LiveScoringProvider profile={profile}>
      <AppInner
        mainView={mainView}
        setMainView={setMainView}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        profile={profile}
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
    </LiveScoringProvider>
  );
}
