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
import '@/features/harvest/harvest.css';
import { applyAccountDeletionFromServer } from '@/lib/liveScoringStorage.js';
import { LiveScoringProvider } from '@/features/liveScoring/LiveScoringContext.jsx';
import ScoreAnimator from '@/features/liveScoring/ScoreAnimator.jsx';
import { useLiveScoring } from '@/features/liveScoring/useLiveScoring.js';
import HidePostConfirmDialog from '@/features/feed/HidePostConfirmDialog.jsx';
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
const PERSONA_LABELS = {
  productivity: 'Productivity',
  security: 'Security',
  popularity: 'Social',
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

const POST_REVEAL_GAP_MS = 2000;
/** Must match `.post-card--feed-enter` duration in `src/styles/base.css`. */
const POST_FEED_ENTER_ANIM_MS = 1000;
const INTER_REVEAL_PAUSE_MS = Math.max(POST_REVEAL_GAP_MS, POST_FEED_ENTER_ANIM_MS + 150);
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
  const { adjustedScores, dominantPersona: liveDominantPersona, hidePost, isHidden } =
    useLiveScoring();
  const [dashboardHideConfirm, setDashboardHideConfirm] = useState(null);

  const personaKey = personaOverride ?? liveDominantPersona;
  const personaColor = PERSONA_COLORS[personaKey] ?? PERSONA_COLORS.productivity;
  const personaToggleLabel =
    personaKey === 'productivity' ? 'P' : personaKey === 'security' ? 'S' : '☺';

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

  const handleDashboardHide = () => {
    const posts = Array.isArray(profile?.personaPosts) ? profile.personaPosts : [];
    const target = posts.find((p) => !isHidden(normalizePostHideKey(p.createdAt)));
    if (target) setDashboardHideConfirm({ post: target });
  };

  const handleDashboardRanking = () => {
    setMainView('profile');
    setActiveTab('leaderboards');
  };

  const handleDashboardTellMeMore = () => {
    setMainView('profile');
    setActiveTab('posts');
  };

  const dashboardBusy =
    harvestPhase === 'harvesting' ||
    postGen.phase === 'deltas' ||
    postGen.phase === 'generating';

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
                profile={profile}
                isGeneratingPosts={postGen.phase === 'generating'}
              />
            </ScrollArea>
          </div>
        )}

        {mainView === 'profile' && (
          <ProfileView
            profile={profile}
            personaColor={personaColor}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            mainScoreEntryReplayKey={profileScoreReplayNonce}
            isGeneratingPosts={postGen.phase === 'generating'}
          />
        )}

        {mainView === 'home' && (
          <aside className="persona-side-panel" aria-label="Persona dashboard">
            <p className="dashboard-top-label">dashboard</p>
            <div
              className="dashboard-capsule dashboard-capsule--figma"
              style={{ '--persona-accent': personaColor }}
            >
              <div className="dashboard-actions-row">
                <button
                  type="button"
                  className="dashboard-action-pill"
                  onClick={handleDashboardHide}
                  disabled={!profile}
                >
                  HIDE
                </button>
                <button
                  type="button"
                  className="dashboard-action-pill"
                  onClick={handleDashboardRanking}
                >
                  RANKING
                </button>
              </div>

              <div className="dashboard-primary-row">
                {harvestPhase === 'harvesting' ? (
                  <div
                    className="dashboard-timer-card dashboard-timer-card--primary dashboard-timer-card--wide dashboard-timer-card--status dashboard-timer-card--harvest"
                    aria-busy="true"
                  >
                    <HarvestScreen progress={harvestProgress} error={harvestError} />
                  </div>
                ) : postGen.phase === 'deltas' ? (
                  <div
                    className="dashboard-timer-card dashboard-timer-card--primary dashboard-timer-card--wide dashboard-timer-card--status dashboard-timer-card--analysis"
                    aria-live="polite"
                  >
                    <PersonaDeltaSummary deltas={personaDeltas} />
                  </div>
                ) : postGen.phase === 'generating' ? (
                  <div
                    className="dashboard-timer-card dashboard-timer-card--primary dashboard-timer-card--wide dashboard-timer-card--status dashboard-timer-card--generating"
                    aria-busy="true"
                  >
                    <GeneratingContentLabel />
                  </div>
                ) : (
                  <button
                    type="button"
                    className="dashboard-timer-card dashboard-timer-card--primary dashboard-timer-card--wide"
                    disabled={postGen.loading || !profile}
                    onClick={handleGeneratePersonaPosts}
                  >
                    next analysis in 10 minutes
                    {postGen.error ? (
                      <span className="generate-posts-error" role="alert">
                        {postGen.error}
                      </span>
                    ) : null}
                  </button>
                )}
              </div>
              <div className="dashboard-tell-row">
                <button
                  type="button"
                  className="dashboard-timer-card dashboard-timer-card--primary dashboard-timer-card--wide"
                  onClick={handleDashboardTellMeMore}
                  disabled={dashboardBusy}
                >
                  tell me more
                </button>
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
                          stroke={isDominantRing ? 'rgba(0, 0, 0, 0.12)' : 'rgba(0, 0, 0, 0.18)'}
                          strokeWidth="8"
                        />
                        <circle
                          cx="40"
                          cy="40"
                          r={R}
                          fill="none"
                          stroke={isDominantRing ? personaColor : '#000'}
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
            </div>
          </aside>
        )}
      </div>
      {dashboardHideConfirm ? (
        <HidePostConfirmDialog
          post={dashboardHideConfirm.post}
          onCancel={() => setDashboardHideConfirm(null)}
          onConfirm={() => {
            hidePost(dashboardHideConfirm.post, null);
            setDashboardHideConfirm(null);
          }}
        />
      ) : null}
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
    const slotsBuffer = Array(3).fill(null);
    let streamDone = false;

    const revealPromise = (async () => {
      const batch = [];
      let revealedCount = 0;

      for (let slot = 0; slot < 3; slot += 1) {
        while (!slotsBuffer[slot] && !streamDone) {
          await new Promise((r) => setTimeout(r, 40));
        }
        if (!slotsBuffer[slot]) continue;

        // Wait long enough that only one new card is "entering" at a time (gap + enter animation).
        if (revealedCount > 0) {
          await new Promise((r) => setTimeout(r, INTER_REVEAL_PAUSE_MS));
        }

        const key =
          typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : `feed-${Date.now()}-${slot}`;
        const raw = slotsBuffer[slot];
        const { _feedEnter: _fe, _feedKey: _fk, ...slotRest } = raw;
        revealedCount += 1;
        const post = {
          ...slotRest,
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

    const assignPostToSlot = (post, slotIndex) => {
      if (typeof slotIndex !== 'number' || slotIndex < 0 || slotIndex > 2) return;
      slotsBuffer[slotIndex] = post;
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
          assignPostToSlot(row.post, row.slotIndex);
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
            if (row.post) assignPostToSlot(row.post, row.slotIndex);
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
