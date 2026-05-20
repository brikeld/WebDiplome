import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { flushSync } from 'react-dom';
import Sidebar from '@/layout/Sidebar.jsx';
import ScrollArea from '@/layout/ScrollArea.jsx';
import ProfileHeader from '@/features/profile/ProfileHeader.jsx';
import TabBar from '@/features/profile/TabBar.jsx';
import ProfileTab from '@/features/profile/ProfileTab.jsx';
import PostsTab from '@/features/feed/PostsTab.jsx';
import HomeTab from '@/features/home/HomeTab.jsx';
import LandingPage from '@/landing-page/LandingPage.jsx';
import BadgesTab from '@/features/profile/tabs/BadgesTab.jsx';
import LeaderboardsTab from '@/features/profile/tabs/LeaderboardsTab.jsx';
import {
  getPersonaScoreForAxis,
  getPersonaScoresNormalized,
  machineHandleFromProfile,
} from '@/lib/profileUtils.js';
import HarvestScreen from '@/features/harvest/HarvestScreen.jsx';
import '@/features/harvest/harvest.css';
import { LiveScoringProvider } from '@/features/liveScoring/LiveScoringContext.jsx';
import ScoreAnimator from '@/features/liveScoring/ScoreAnimator.jsx';

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

/** Page background — always black */
const PERSONA_TAB_FILLS = {
  productivity: '#000000',
  security: '#000000',
  popularity: '#000000',
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

function topPersonaFromProfile(profile) {
  if (!profile) return 'productivity';

  const rawDominant = String(
    profile?.dominantPersona ?? profile?.dominant_persona ?? ''
  ).toLowerCase();
  if (rawDominant) {
    const key =
      PERSONA_ALIASES[rawDominant] ??
      (PERSONA_KEYS.includes(rawDominant) ? rawDominant : null);
    if (key) return key;
  }

  const posts = Array.isArray(profile.personaPosts) ? profile.personaPosts : [];
  if (posts.length > 0) {
    const counts = Object.fromEntries(PERSONA_KEYS.map((k) => [k, 0]));
    for (const p of posts) {
      const raw = String(p?.persona ?? '').toLowerCase();
      const key = PERSONA_ALIASES[raw] ?? (PERSONA_KEYS.includes(raw) ? raw : null);
      if (key) counts[key] += 1;
    }
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    if (sorted[0][1] > 0) return sorted[0][0];
  }
  return 'productivity';
}

const POST_REVEAL_GAP_MS = 2000;
/** Must match `.post-card--feed-enter` duration in `src/styles/base.css`. */
const POST_FEED_ENTER_ANIM_MS = 1000;
const INTER_REVEAL_PAUSE_MS = Math.max(POST_REVEAL_GAP_MS, POST_FEED_ENTER_ANIM_MS + 150);
const HARVEST_POLL_MS = 450;
const HARVEST_WAIT_MS = 12 * 60 * 1000;

function computePersonaDeltas(before, after) {
  if (!before || !after) return null;
  const keys = ['productivity', 'security', 'social'];
  const out = {};
  for (const k of keys) {
    const b = Number(before[k]);
    const a = Number(after[k]);
    if (!Number.isFinite(b) || !Number.isFinite(a)) continue;
    const diff = Math.round(a - b);
    if (diff !== 0) out[k] = diff;
  }
  return Object.keys(out).length ? out : null;
}

function axisKeyToScoreKey(axisKey) {
  const k = String(axisKey || '').toLowerCase();
  if (k === 'popularity') return 'social';
  return k;
}

export default function App() {
  /** 'landing' = onboarding/intro; 'home' = feed only; 'profile' = profile capsule + tab bar + sections */
  const [mainView, setMainView] = useState('landing');
  const [activeTab, setActiveTab] = useState('posts');
  const [profile, setProfile] = useState(null);
  const [personaOverride, setPersonaOverride] = useState(null); // 'productivity' | 'popularity' | 'security' | null
  const [postGen, setPostGen] = useState({ loading: false, error: null });
  const [harvestPhase, setHarvestPhase] = useState('idle');
  const [harvestProgress, setHarvestProgress] = useState(null);
  const [harvestError, setHarvestError] = useState(null);
  const [personaDeltas, setPersonaDeltas] = useState(null);
  const streamPostsBaselineRef = useRef([]);
  /** Bumps when user navigates onto the profile view — drives MainScoreStyle ring replay only then. */
  const [profileScoreReplayNonce, setProfileScoreReplayNonce] = useState(0);
  const prevMainViewRef = useRef(null);

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

  useEffect(() => {
    let cancelled = false;

    const load = () => {
      fetch(`${API_ORIGIN}/api/profiles`)
        .then((res) => {
          if (!res.ok) throw new Error('failed');
          return res.json();
        })
        .then((data) => {
          if (cancelled) return;
          if (!Array.isArray(data) || data.length === 0) {
            return; /* keep previous profile; avoid clearing on transient [] */
          }
          setProfile(data[0]);
        })
        .catch(() => {
          if (cancelled) return; /* keep previous profile on network error */
        });
    };

    load();
    const id = setInterval(load, 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const calculatedPersonaKey = useMemo(() => topPersonaFromProfile(profile), [profile]);
  const personaKey = personaOverride ?? calculatedPersonaKey;
  const personaColor = PERSONA_COLORS[personaKey] ?? PERSONA_COLORS.productivity;
  const personaTabFill =
    PERSONA_TAB_FILLS[personaKey] ?? PERSONA_TAB_FILLS.productivity;
  const personaToggleLabel =
    personaKey === 'productivity' ? 'P' : personaKey === 'security' ? 'S' : '☺';

  /** Main persona ring always centered; side order follows PERSONA_KEYS for the other two. */
  const dashboardRingOrder = useMemo(() => {
    const others = PERSONA_KEYS.filter((k) => k !== personaKey);
    if (others.length !== 2) return [...PERSONA_KEYS];
    return [others[0], personaKey, others[1]];
  }, [personaKey]);

  const cyclePersona = () => {
    // productivity → social(popularity) → security → productivity
    const order = ['productivity', 'popularity', 'security'];
    const idx = Math.max(0, order.indexOf(personaKey));
    const next = order[(idx + 1) % order.length];
    setPersonaOverride(next);
  };

  const reloadProfileFromApi = useCallback(async () => {
    const res = await fetch(`${API_ORIGIN}/api/profiles`);
    if (!res.ok) throw new Error('Failed to reload profile');
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    setProfile(data[0]);
    return data[0];
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
    setPostGen({ loading: true, error: null });

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
        setPostGen({ loading: false, error: e?.message || 'Bio generation failed' });
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
        const { createdAt: _c1, created_at: _c2, _feedEnter: _fe, _feedKey: _fk, ...slotRest } = raw;
        revealedCount += 1;
        const post = {
          ...slotRest,
          createdAt: new Date().toISOString(),
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
      setPostGen({ loading: false, error: null });
    } catch (e) {
      streamDone = true;
      await revealPromise.catch(() => {});
      setPostGen({ loading: false, error: e?.message || 'Generation failed' });
    }
  }, [profile, reloadProfileFromApi]);

  const handleGeneratePersonaPosts = async () => {
    if (postGen.loading || harvestPhase === 'harvesting' || !profile) return;

    const scoresBefore = getPersonaScoresNormalized(profile);
    setHarvestError(null);
    setHarvestProgress(null);
    setHarvestPhase('harvesting');

    try {
      const reqRes = await fetch(`${API_ORIGIN}/api/harvest/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scoresBefore }),
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
      setPostGen({ loading: false, error: e?.message || 'Harvest failed' });
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
    await runBioAndPostGeneration(freshProfile);
  };

  if (mainView === 'landing') {
    return <LandingPage onEnterDemo={() => setMainView('home')} />;
  }

  return (
    <LiveScoringProvider profile={profile}>
      <div
        className={`page-outer persona-${personaKey} view-${mainView}`}
        style={{
          '--persona-accent': personaColor,
          '--tabs-capsule-fill': personaTabFill,
          '--persona-secondary': personaTabFill,
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
        <div className="main-col">
          <ScrollArea key={mainView} mode={mainView}>
            {mainView === 'home' && (
              <HomeTab
                profile={profile}
                isGeneratingPosts={postGen.loading}
              />
            )}
            {mainView === 'profile' && (
              <div className="profile-capsule-wrap">
                <p className="home-top-label">{machineHandleFromProfile(profile)}</p>
                <div
                  className="posts-capsule"
                  style={{ '--persona-accent': personaColor }}
                >
                  <div className="posts-capsule-inner">
                    <ProfileHeader
                      profile={profile}
                      personaColor={personaColor}
                      mainScoreEntryReplayKey={profileScoreReplayNonce}
                    />

                    <TabBar
                      activeTab={activeTab}
                      onTabChange={setActiveTab}
                      personaColor={personaColor}
                    />

                    <div className="profile-tabs-divider" aria-hidden />

                    <div className="tab-content">
                      {activeTab === 'profile' && <ProfileTab />}
                      {activeTab === 'posts' && (
                        <PostsTab profile={profile} feedContext="profile" isGeneratingPosts={postGen.loading} />
                      )}
                      {activeTab === 'badges' && <BadgesTab />}
                      {activeTab === 'leaderboards' && <LeaderboardsTab />}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </ScrollArea>
        </div>

        {(mainView === 'home' || mainView === 'profile') && (
          <aside className="persona-side-panel" aria-label="Persona dashboard">
            <p className="dashboard-top-label">dashboard</p>
            <div
              className="dashboard-capsule"
              style={{ '--persona-accent': personaColor }}
            >
              <button
                type="button"
                className="dashboard-persona-pill"
                onClick={cyclePersona}
              >
                {`${PERSONA_LABELS[personaKey] ?? ''} user`}
              </button>

              <div className="dashboard-grid">
                {harvestPhase === 'harvesting' ? (
                  <div
                    className="dashboard-card dashboard-card--generate dashboard-card--generate-harvest"
                    aria-busy="true"
                  >
                    <HarvestScreen progress={harvestProgress} error={harvestError} />
                  </div>
                ) : (
                  <button
                    type="button"
                    className="dashboard-card dashboard-card--generate"
                    disabled={postGen.loading || !profile}
                    onClick={handleGeneratePersonaPosts}
                  >
                    {postGen.loading
                      ? 'GENERATING…'
                      : 'next analysis in 10 minutes'}
                    {postGen.error ? (
                      <span className="generate-posts-error" role="alert">
                        {postGen.error}
                      </span>
                    ) : null}
                  </button>
                )}
                <div className="dashboard-card dashboard-card--analyze">
                  ANALYZE UR LAST POST
                </div>
                <div className="dashboard-card dashboard-card--leaderboards">
                  SOMETHING ABOUT THE LEADERBOARDS OR RANKINGS
                </div>
              </div>

              <div className="dashboard-rings">
                {dashboardRingOrder.map((k) => {
                  const ringColor = PERSONA_COLORS[k];
                  const value = Math.max(
                    0,
                    Math.min(100, getPersonaScoreForAxis(profile ?? {}, k)),
                  );
                  const R = 32;
                  const CIRC = 2 * Math.PI * R;
                  const dash = CIRC * (value / 100);
                  const gap = CIRC - dash;
                  const isDominantRing = k === personaKey;
                  return (
                    <div
                      key={k}
                      className={`dashboard-ring-card${isDominantRing ? ' dashboard-ring-card--dominant' : ''}`}
                      style={{ '--ring-accent': ringColor }}
                    >
                      <svg
                        className="dashboard-ring-svg"
                        viewBox="0 0 80 80"
                        aria-label={`${PERSONA_LABELS[k]} ${value}%`}
                      >
                        <circle
                          cx="40"
                          cy="40"
                          r={R}
                          fill="none"
                          stroke={isDominantRing ? 'rgba(255,255,255,0.22)' : '#000'}
                          strokeOpacity={isDominantRing ? 1 : 0.22}
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
                        {Number.isFinite(value) ? value : '—'}
                        {personaDeltas?.[axisKeyToScoreKey(k)] != null ? (
                          <span
                            className={`dashboard-ring-delta${
                              personaDeltas[axisKeyToScoreKey(k)] > 0
                                ? ' dashboard-ring-delta--up'
                                : ' dashboard-ring-delta--down'
                            }`}
                          >
                            {personaDeltas[axisKeyToScoreKey(k)] > 0
                              ? `+${personaDeltas[axisKeyToScoreKey(k)]}`
                              : String(personaDeltas[axisKeyToScoreKey(k)])}
                          </span>
                        ) : null}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
    </LiveScoringProvider>
  );
}
