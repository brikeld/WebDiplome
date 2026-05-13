import { useState, useEffect, useMemo, useRef } from 'react';
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
import { getPersonaScoreForAxis, machineHandleFromProfile } from '@/lib/profileUtils.js';

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

export default function App() {
  /** 'landing' = onboarding/intro; 'home' = feed only; 'profile' = profile capsule + tab bar + sections */
  const [mainView, setMainView] = useState('landing');
  const [activeTab, setActiveTab] = useState('posts');
  const [profile, setProfile] = useState(null);
  const [personaOverride, setPersonaOverride] = useState(null); // 'productivity' | 'popularity' | 'security' | null
  const [nowTick, setNowTick] = useState(0);
  const [postGen, setPostGen] = useState({ loading: false, error: null });
  const streamPostsBaselineRef = useRef([]);

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

  // Re-render once per second in profile mode so "Last analysis" stays live.
  useEffect(() => {
    if (mainView !== 'profile') return undefined;
    const id = setInterval(() => setNowTick((t) => t + 1), 1000);
    return () => clearInterval(id);
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
  const lastAnalysisText = useMemo(() => formatLastAnalysis(profile), [profile, nowTick]);
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

  const handleGeneratePersonaPosts = async () => {
    if (postGen.loading || !profile) return;
    streamPostsBaselineRef.current = Array.isArray(profile.personaPosts) ? profile.personaPosts : [];
    setPostGen({ loading: true, error: null });

    const baseline = streamPostsBaselineRef.current;
    const slotsBuffer = Array(5).fill(null);
    let streamDone = false;

    const revealPromise = (async () => {
      const batch = [];
      let revealedCount = 0;

      for (let slot = 0; slot < 5; slot += 1) {
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
      if (typeof slotIndex !== 'number' || slotIndex < 0 || slotIndex > 4) return;
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
      setPostGen({ loading: false, error: null });
    } catch (e) {
      streamDone = true;
      await revealPromise.catch(() => {});
      setPostGen({ loading: false, error: e?.message || 'Generation failed' });
    }
  };

  if (mainView === 'landing') {
    return <LandingPage onEnterDemo={() => setMainView('home')} />;
  }

  return (
    <div
      className={`page-outer persona-${personaKey} view-${mainView}`}
      style={{
        '--persona-accent': personaColor,
        '--tabs-capsule-fill': personaTabFill,
        '--persona-secondary': personaTabFill,
      }}
    >
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
            {mainView === 'home' && <HomeTab profile={profile} isGeneratingPosts={postGen.loading} />}
            {mainView === 'profile' && (
              <div className="profile-capsule-wrap">
                <p className="home-top-label">{machineHandleFromProfile(profile)}</p>
                <div
                  className="posts-capsule"
                  style={{ '--persona-accent': personaColor }}
                >
                  <div className="posts-capsule-inner">
                    <ProfileHeader profile={profile} personaColor={personaColor} />

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
                <div className="dashboard-card dashboard-card--analysis">
                  <span className="dashboard-card-label">last analysis</span>
                  <strong className="dashboard-card-value">
                    {lastAnalysisText ?? '—'}
                  </strong>
                </div>
                <button
                  type="button"
                  className="dashboard-card dashboard-card--generate"
                  disabled={postGen.loading || !profile}
                  onClick={handleGeneratePersonaPosts}
                >
                  {postGen.loading
                    ? 'GENERATING…'
                    : 'GENERATE NEW CONTENT / DO ANOTHER ANALYSIS'}
                  {postGen.error ? (
                    <span className="generate-posts-error" role="alert">
                      {postGen.error}
                    </span>
                  ) : null}
                </button>
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
  );
}
