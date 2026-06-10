import { useEffect, useRef, useState } from 'react';
import UserSilhouetteIcon from '@/features/identity/UserSilhouetteIcon.jsx';
import PostCard from '@/features/feed/PostCard.jsx';
import ProfileHeader from '@/features/profile/ProfileHeader.jsx';
import { LiveScoringProvider } from '@/features/liveScoring/LiveScoringContext.jsx';
import { avatarSrcFromProfile, getPersonaBadgeModel } from '@/lib/profileUtils.js';
import './landingPage.css';

const MOCK_AVATAR = '/imgs/AlexP.png';

const MOCK_PROFILE = {
  id: 'landing-alex-johnson',
  slug: 'landing-alex-johnson',
  firstname: 'Alex',
  lastname: 'Johnson',
  machineName: 'Alexs MacBook Pro',
  dominantPersona: 'productivity',
  globalScore: 78,
  personaScores: { productivity: 71, security: 64, social: 84 },
  avatarUrl: MOCK_AVATAR,
  wallpaperBase64: MOCK_AVATAR,
  profileSummary:
    'I keep every signal tidy, every system current, and every conversation moving just in case my digital identity needs to pass inspection.',
  personaPosts: [],
};

const COLLECT_PHASES = ['Machine identity', 'History · 7d', 'Assets', 'Scoring signals'];

const COLLECT_LOG_SCRIPT = [
  { line: '[1/4] machine identity · hostname resolved ✓', step: 1, label: 'Reading machine identity…' },
  { line: 'system_profiler · hardware UUID', step: 1 },
  { line: '[2/4] history → shell · 612 commands', step: 2, label: 'Reconstructing 7-day history…' },
  { line: 'sqlite3 Safari/History.db ✓', step: 2 },
  { line: '[3/4] assets · recent_images scan', step: 3, label: 'Harvesting assets…' },
  { line: 'wifi known_networks · 9 SSID', step: 3 },
  { line: 'app usage windows · 7d ✓', step: 3 },
  { line: '[4/4] scoring signals · persona weights', step: 4, label: 'Computing scoring signals…' },
  { line: 'login/last sessions parsed ✓', step: 4 },
];

function MacCollectScreen() {
  const rootRef = useRef(null);
  const logBoxRef = useRef(null);
  const [step, setStep] = useState(0);
  const [pct, setPct] = useState(0);
  const [status, setStatus] = useState('Initializing system scan…');
  const [logs, setLogs] = useState([]);
  const stepRef = useRef(0);
  const pctSmoothRef = useRef(0);
  const lineRef = useRef(0);
  const wasVisibleRef = useRef(false);

  useEffect(() => {
    const screenEl = rootRef.current?.closest('.lp-mac-app-screen');
    if (!screenEl) return undefined;

    const reset = () => {
      stepRef.current = 0;
      pctSmoothRef.current = 0;
      lineRef.current = 0;
      setStep(0);
      setPct(0);
      setStatus('Initializing system scan…');
      setLogs([]);
    };

    let tickId = null;

    const advance = () => {
      const idx = lineRef.current;
      if (idx >= COLLECT_LOG_SCRIPT.length) {
        if (tickId) clearInterval(tickId);
        tickId = null;
        return;
      }

      const entry = COLLECT_LOG_SCRIPT[idx];
      lineRef.current += 1;
      const ts = `17:25:${String(34 + idx).padStart(2, '0')}`;

      setLogs((prev) => [...prev, { id: idx, ts, text: entry.line, ok: entry.line.includes('✓') }]);

      if (entry.step > stepRef.current) {
        stepRef.current = entry.step;
        setStep(entry.step);
        if (entry.label) setStatus(entry.label);
      }

      pctSmoothRef.current = Math.min(96, pctSmoothRef.current + 9);
      const stepPct = Math.round((stepRef.current / 4) * 95);
      setPct(Math.min(96, Math.max(stepPct, Math.round(pctSmoothRef.current))));
    };

    const pollId = setInterval(() => {
      const visible = Number.parseFloat(getComputedStyle(screenEl).opacity) > 0.6;

      if (visible && !wasVisibleRef.current) {
        wasVisibleRef.current = true;
        reset();
        advance();
        tickId = setInterval(advance, 260);
      } else if (!visible && wasVisibleRef.current) {
        wasVisibleRef.current = false;
        if (tickId) clearInterval(tickId);
        tickId = null;
        reset();
      }
    }, 80);

    return () => {
      clearInterval(pollId);
      if (tickId) clearInterval(tickId);
    };
  }, []);

  useEffect(() => {
    const box = logBoxRef.current;
    if (box) box.scrollTop = box.scrollHeight;
  }, [logs]);

  return (
    <div ref={rootRef} className="lp-mac-screen-content lp-mac-collect">
      <div className="lp-mac-collect-head">
        <h3>Collecting data</h3>
        <p>{status}</p>
      </div>
      <div className="lp-mac-progress">
        <div><span>Step {step} / 4</span><b>{pct}%</b></div>
        <div className="lp-mac-progress-track">
          <div className="lp-mac-progress-fill" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="lp-mac-phases">
        {COLLECT_PHASES.map((label, index) => {
          const phaseNum = index + 1;
          const className = [
            phaseNum < step ? 'is-done' : '',
            phaseNum === step ? 'is-active' : '',
          ].filter(Boolean).join(' ');
          return (
            <div key={label} className={className || undefined}>
              <span>{String(phaseNum).padStart(2, '0')}</span>
              <p>{label}</p>
            </div>
          );
        })}
      </div>
      <div ref={logBoxRef} className="lp-mac-logbox">
        {logs.map((log) => (
          <span key={log.id} className="lp-mac-logline">
            <b>{log.ts}</b>
            {log.ok ? (
              <>
                {' '}
                <strong>{log.text}</strong>
              </>
            ) : (
              ` ${log.text}`
            )}
          </span>
        ))}
      </div>
    </div>
  );
}

const APP_SCREENS = [
  {
    id: 'intro',
    number: '01',
    description:
      'Your first touchpoint with the platform: a clear value proposition, transparent disclosure, and a single action to begin enrollment into automated digital profiling.',
    theme: 'none',
    render: () => (
      <div className="lp-mac-screen-content lp-mac-intro">
        <div className="lp-mac-intro-top">
          <div className="lp-mac-eyebrow-row">
            <span>Automated Profiling System</span>
            <span>17:25:34</span>
          </div>
          <div className="lp-mac-wordmark">COMPLIANT</div>
          <div className="lp-mac-rule" />
        </div>
        <div className="lp-mac-intro-lines">
          <div><span className="lp-dot lp-dot--prod" /><h3>Your digital life,<br />quantified.</h3></div>
          <div><span className="lp-dot lp-dot--sec" /><h3>Who are you, really?<br />The algorithm decides.</h3></div>
          <div><span className="lp-dot lp-dot--soc" /><h3>Your profile goes public.<br />Score, posts, all visible.</h3></div>
        </div>
        <div className="lp-mac-intro-foot">
          <p>This terminal harvests local system data to synthesize a public social identity that posts autonomously in your name. Enrollment is irreversible.</p>
          <button type="button" className="lp-mac-btn lp-mac-btn--primary">Begin enrollment <span>→</span></button>
        </div>
      </div>
    ),
  },
  {
    id: 'welcome',
    number: '02',
    description:
      'We recognize you instantly from your Mac account and confirm that your profile is being built from real, local system data—personal, credible, and ready to go.',
    theme: 'social',
    render: () => (
      <div className="lp-mac-screen-content lp-mac-welcome">
        <h3>Alex Johnson</h3>
        <p>We found your account on this Mac. Your profile is being built from real system data — no input required.</p>
        <span>Source · macOS account · local harvest</span>
        <button type="button" className="lp-mac-btn lp-mac-btn--primary">Continue <span>→</span></button>
      </div>
    ),
  },
  {
    id: 'collect',
    number: '03',
    description:
      'A guided, four-phase scan of your machine that turns everyday usage into structured intelligence: identity, history, assets, and scoring signals—delivered with live progress you can trust.',
    theme: 'security',
    render: () => <MacCollectScreen />,
  },
  {
    id: 'verdict',
    number: '04',
    description:
      'Your moment of truth: the system reveals your dominant persona and an AI-crafted profile bio that captures who you are, distilled from what your Mac actually shows.',
    theme: 'social',
    render: () => (
      <div className="lp-mac-screen-content lp-mac-verdict">
        <p>Based on the data collected on this Mac, your main persona is</p>
        <h3>Social</h3>
        <div className="lp-mac-bio-block">
          <span>Profile bio</span>
          <blockquote>Always online, endlessly connected — a digital socialite whose every signal broadcasts presence over privacy.</blockquote>
        </div>
        <div className="lp-mac-actions">
          <button type="button" className="lp-mac-btn lp-mac-btn--accent">Open profile</button>
          <button type="button" className="lp-mac-btn lp-mac-btn--ghost">View on web</button>
        </div>
      </div>
    ),
  },
  {
    id: 'profile',
    number: '05',
    description:
      'Your complete digital identity dashboard—global score, persona breakdown, system stats, and public-ready profile—one place to review, publish, and share your synthesized presence.',
    theme: 'productivity',
    render: () => (
      <div className="lp-mac-screen-content lp-mac-profile">
        <div className="lp-mac-profile-block">
          <header><span>Profile card</span><i /><b /></header>
          <div className="lp-mac-profile-hero">
            <div>
              <div className="lp-mac-profile-id">
                <img src={MOCK_AVATAR} alt="" />
                <div><h3>Alex Johnson</h3><span>@Alexs MacBook Pro</span></div>
              </div>
              <p>Always online, endlessly connected — a digital socialite whose every signal broadcasts presence over privacy.</p>
            </div>
            <div className="lp-mac-profile-rings" aria-hidden>
              <span className="lp-mac-profile-ring lp-mac-profile-ring--security" style={{ '--ring-score': 64 }} />
              <span className="lp-mac-profile-ring lp-mac-profile-ring--productivity" style={{ '--ring-score': 71 }} />
              <span className="lp-mac-profile-ring lp-mac-profile-ring--social" style={{ '--ring-score': 84 }} />
            </div>
          </div>
        </div>
        <div className="lp-mac-profile-block lp-mac-profile-block--stats">
          <header><span>System data</span><i /><b /></header>
          <div className="lp-mac-statgrid">
            <span><b>Last analysis</b>11 hours ago</span>
            <span><b>OS Version</b>macOS 15.3</span>
            <span><b>Applications</b>142</span>
            <span><b>RAM</b>16 GB</span>
            <span><b>Battery cycles</b>260</span>
            <span><b>Storage</b>61%</span>
            <span><b>System languages</b>4</span>
            <span><b>Appearance</b>Dark Mode</span>
          </div>
        </div>
        <div className="lp-mac-profile-block">
          <header><span>Persona scores</span><i /><b /></header>
          <div className="lp-mac-algo">
            <span>
              <span className="lp-mac-algo-gauge lp-mac-algo-gauge--security" style={{ '--ring-score': 64 }}><b>64</b></span>
              security
            </span>
            <span>
              <span className="lp-mac-algo-gauge lp-mac-algo-gauge--productivity" style={{ '--ring-score': 71 }}><b>71</b></span>
              productivity
            </span>
            <span className="is-main">
              <span className="lp-mac-algo-gauge lp-mac-algo-gauge--social" style={{ '--ring-score': 84 }}><b>84</b></span>
              social
            </span>
          </div>
        </div>
        <div className="lp-mac-profile-foot">
          <button type="button" className="lp-mac-btn lp-mac-btn--ghost">View on web</button>
          <button type="button" className="lp-mac-btn lp-mac-btn--danger">Delete all data</button>
        </div>
      </div>
    ),
  },
];

/** Keep "&" with the following phrase so wraps break before the ampersand. */
function withAmpersandBreakBefore(text) {
  return text.replace(/ & /g, ' &\u00A0');
}

const PERSONAS = [
  {
    name: 'Social',
    key: 'social',
    tagline: 'Communication, Collaboration & Socially Oriented Usage',
    focus:
      'Chat/collab apps in installed apps and recent use. Browser/social patterns where implemented. Anything that suggests connected, communicative behavior rather than offline solo work.',
  },
  {
    name: 'Productivity',
    key: 'productivity',
    tagline: 'Work Output, Structure & Professional Usage',
    focus:
      'Apps and habits that look like professional or creative work: dev tools, office/design suites, terminals, scripts, project files, recent files and shell history.',
  },
  {
    name: 'Security',
    key: 'security',
    tagline: 'Digital Hygiene, Risk Surface & Conformity',
    focus:
      'System defenses and posture. FileVault, Gatekeeper, SIP, firewall, updates, disk health, fewer sketchy downloads, fewer repeated errors and fewer neglect\u00A0signals.',
  },
];

// Feed animation config
const FEED_VISIBLE = 3;
const FEED_HOLD_MS = 2400;
const FEED_EXIT_MS = 300;
const FEED_LOADER_LEAVE_MS = 280;

const FEED_PERSONA_COLORS = {
  productivite: '#D8D8D8',
  securite: '#759AEF',
  popularite: '#CCF847',
};

// 9-post pool cycling: productivity → security → social × 3
const FEED_POOL = [
  {
    id: 'fp-prod-1', persona: 'productivite', personaBadgePersona: 'productivity',
    content: 'I save every screenshot and asset folder just in case my digital existence ever needs to be perfectly optimized for compliance.',
    systemDeltaPct: 3,
  },
  {
    id: 'fp-sec-1', persona: 'securite', personaBadgePersona: 'security',
    content: "The list of saved Wi-Fi networks is a digital breadcrumb trail. From my secure home router to that 'Guest' network — someone is tracking every stop.",
    systemDeltaPct: 2,
  },
  {
    id: 'fp-soc-1', persona: 'popularite', personaBadgePersona: 'popularity',
    content: 'Three chat apps open, two group threads revived, and somehow every calendar invite has become a personality test. Presence is the product.',
    systemDeltaPct: 4,
  },
  {
    id: 'fp-prod-2', persona: 'productivite', personaBadgePersona: 'productivity',
    content: 'Ran seventeen terminal sessions before noon. Every script is documentation. Every alias is an identity statement. Efficiency is the only persona worth having.',
    systemDeltaPct: 5,
  },
  {
    id: 'fp-sec-2', persona: 'securite', personaBadgePersona: 'security',
    content: 'FileVault on, Gatekeeper locked, firewall active. My threat surface is a philosophy, not a checklist. Security hygiene is just hygiene.',
    systemDeltaPct: 1,
  },
  {
    id: 'fp-soc-2', persona: 'popularite', personaBadgePersona: 'popularity',
    content: 'Fourteen apps with unread badges, four active group chats, one persistent DM that shapes every context switch. Digital presence is continuous.',
    systemDeltaPct: 6,
  },
  {
    id: 'fp-prod-3', persona: 'productivite', personaBadgePersona: 'productivity',
    content: 'Three projects merged into one pipeline overnight. Automation is not laziness — it is structural trust in your own patterns.',
    systemDeltaPct: 3,
  },
  {
    id: 'fp-sec-3', persona: 'securite', personaBadgePersona: 'security',
    content: 'System update installed within six hours of release. Safari history cleared on schedule. The machine knows who you are — better to tell it first.',
    systemDeltaPct: 2,
  },
  {
    id: 'fp-soc-3', persona: 'popularite', personaBadgePersona: 'popularity',
    content: 'Every platform logged in, every notification enabled. Connectivity is not distraction — it is the signal that constitutes the self.',
    systemDeltaPct: 4,
  },
];

function toFeedItem(post, { uid = post.id, anim = 'visible' } = {}) {
  return {
    ...post,
    noteColor: FEED_PERSONA_COLORS[post.persona] ?? '#ccf847',
    uid,
    anim,
  };
}

function feedAccentForIndex(poolIndex) {
  return FEED_PERSONA_COLORS[FEED_POOL[poolIndex % FEED_POOL.length].persona] ?? '#ccf847';
}

function LandingNavbar({ profile, onLoginClick, profileEntryLoading }) {
  const hasProfile = Boolean(profile);
  const avatarSrc = hasProfile ? avatarSrcFromProfile(profile) : null;
  const personaColor = hasProfile ? getPersonaBadgeModel(profile).color : '#ccf847';

  return (
    <nav className="lp-navbar">
      <span className="lp-navbar-brand">COMPLIANT</span>
      <div className="lp-navbar-actions">
        {hasProfile ? (
          <button
            type="button"
            className={`lp-navbar-avatar${profileEntryLoading ? ' lp-navbar-avatar--loading' : ''}`}
            onClick={onLoginClick}
            disabled={profileEntryLoading}
            style={{ '--nav-persona': personaColor }}
            aria-label="Enter COMPLIANT"
          >
            {avatarSrc ? (
              <img src={avatarSrc} alt="" className="lp-navbar-avatar-img" />
            ) : (
              <UserSilhouetteIcon className="lp-navbar-avatar-icon" />
            )}
          </button>
        ) : (
          <span className="lp-navbar-login">Login</span>
        )}
        <button type="button" className="lp-navbar-register">Register</button>
      </div>
    </nav>
  );
}

function AppCarousel() {
  return (
    <section className="lp-screen lp-app-showcase" aria-labelledby="lp-app-title" style={{ '--stagger-i': 1 }}>
      <h2 id="lp-app-title">COMPLIANT APP</h2>
      <div className="lp-app-step-list" aria-label="App screens">
        {APP_SCREENS.map((screen, index) => (
          <div key={screen.id} className="lp-app-step" style={{ '--step-i': index }}>
            <div className="lp-app-step-num">{screen.number}</div>
            <p>{screen.description}</p>
          </div>
        ))}
      </div>
      <div className="lp-mac-app-shell" aria-label="COMPLIANT Mac app carousel preview">
        <div className="lp-mac-app-frame">
          <div className="lp-mac-app-atmos" aria-hidden />
          {APP_SCREENS.map((screen, index) => (
            <div
              key={screen.id}
              className={`lp-mac-app-screen lp-mac-app-screen--${screen.theme}`}
              style={{ '--slide-i': index }}
            >
              {screen.render()}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function getPersonaOffset(i, active) {
  const d = ((i - active) % 3 + 3) % 3;
  return d > 1 ? d - 3 : d; // -1, 0, or 1
}

function personaCardStyle(offset) {
  if (offset === 0) {
    return {
      transform: 'translateX(0) rotate(0deg) scale(1)',
      zIndex: 10,
      filter: 'none',
      pointerEvents: 'auto',
    };
  }
  const dir = offset > 0 ? 1 : -1;
  return {
    transform: `translateX(${dir * 62}%) rotate(${dir * 11}deg) scale(0.83)`,
    zIndex: 5,
    filter: 'none',
    pointerEvents: 'auto',
  };
}

function PersonaSections() {
  const [active, setActive] = useState(0);

  function handleCardClick(i) {
    if (i === active) {
      setActive((active + 1) % PERSONAS.length);
    } else {
      setActive(i);
    }
  }

  return (
    <section className="lp-screen lp-personas" aria-labelledby="lp-personas-title" style={{ '--stagger-i': 2 }}>
      <div className="lp-personas-head">
        <h2 id="lp-personas-title">The Three Personas</h2>
        <p><strong>COMPLIANT</strong> will choose for you based on your information.</p>
      </div>
      <div className="lp-persona-deck-overflow">
        <div className="lp-persona-deck">
          {PERSONAS.map((persona, i) => {
            const offset = getPersonaOffset(i, active);
            return (
              <button
                key={persona.key}
                className={`lp-persona-card lp-persona-card--${persona.key}${offset === 0 ? ' is-active' : ''}`}
                style={personaCardStyle(offset)}
                onClick={() => handleCardClick(i)}
                aria-label={`${persona.name} persona${offset === 0 ? ' (active)' : ', click to view'}`}
                tabIndex={offset === 0 ? 0 : -1}
              >
                <div className="lp-persona-card-header">
                  <span className="lp-persona-card-name">{persona.name.toUpperCase()}</span>
                </div>
                <span className="lp-persona-card-tagline">{withAmpersandBreakBefore(persona.tagline)}</span>
                <p className="lp-persona-card-focus">{persona.focus}</p>
                <span className="lp-persona-card-deco" aria-hidden="true">{persona.name[0]}</span>
              </button>
            );
          })}
        </div>
        <div className="lp-persona-dots" aria-label="Persona navigation">
          {PERSONAS.map((p, i) => (
            <button
              key={p.key}
              className={`lp-persona-dot${i === active ? ' is-active' : ''}`}
              onClick={() => setActive(i)}
              aria-label={`Go to ${p.name} persona`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function ProfileCardSection() {
  return (
    <section className="lp-profile-card-section" aria-labelledby="lp-identity-title" style={{ '--stagger-i': 3 }}>
      <div className="lp-section-center-head">
        <h2 id="lp-identity-title">Your Identity</h2>
        <p>
          <strong>COMPLIANT</strong> does everything for you.<br />
          No need to create an account.
        </p>
      </div>
      <div
        className="lp-profile-card-wrap"
        style={{ '--persona-accent': '#D8D8D8', '--score-fill': '#D8D8D8' }}
      >
        <ProfileHeader
          profile={MOCK_PROFILE}
          personaColor="#D8D8D8"
          personaBadgePersona="productivity"
          onNavigateTab={() => {}}
          statsOverride={{ postCount: 8, rankingCount: 20 }}
        />
      </div>
    </section>
  );
}

const TRANSITION_LINES = [
  { text: 'Your habits become content.', color: '#ccf847' },
  { text: 'Your content defines your score.', color: '#759aef' },
  { text: 'Your score determines who you are.', color: '#d8d8d8' },
];

function TransitionBanner() {
  return (
    <div className="lp-transition-banner">
      <div className="lp-transition-lines">
        {TRANSITION_LINES.map((line) => (
          <div key={line.text} className="lp-transition-line">
            <span className="lp-transition-dot" style={{ background: line.color }} aria-hidden="true" />
            <p>{line.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function FeedSection() {
  const [items, setItems] = useState(() =>
    FEED_POOL.slice(0, FEED_VISIBLE).map((p) => toFeedItem(p))
  );
  const [cycle, setCycle] = useState(0);
  const [loaderMounted, setLoaderMounted] = useState(true);
  const [loaderLeaving, setLoaderLeaving] = useState(false);
  const nextRef = useRef(FEED_VISIBLE);
  const nextAccent = feedAccentForIndex(nextRef.current);

  useEffect(() => {
    setLoaderMounted(true);
    setLoaderLeaving(false);

    let exitTimer;
    let leaveTimer;
    const holdTimer = setTimeout(() => {
      setItems((prev) => {
        const copy = [...prev];
        copy[copy.length - 1] = { ...copy[copy.length - 1], anim: 'exit' };
        return copy;
      });

      exitTimer = setTimeout(() => {
        setLoaderLeaving(true);

        leaveTimer = setTimeout(() => {
          const nextPost = FEED_POOL[nextRef.current % FEED_POOL.length];
          const uid = `${nextPost.id}-${nextRef.current}`;
          nextRef.current += 1;

          setItems((prev) => [
            toFeedItem(nextPost, { uid, anim: 'enter' }),
            ...prev.filter((x) => x.anim !== 'exit'),
          ]);
          setLoaderLeaving(false);
          setLoaderMounted(false);
          setCycle((n) => n + 1);
        }, FEED_LOADER_LEAVE_MS);
      }, FEED_EXIT_MS);
    }, FEED_HOLD_MS);

    return () => {
      clearTimeout(holdTimer);
      clearTimeout(exitTimer);
      clearTimeout(leaveTimer);
    };
  }, [cycle]);

  return (
    <section className="lp-feed-section" style={{ '--stagger-i': 5 }}>
      <div className="lp-section-center-head">
        <h2>Your Feed, Automated</h2>
        <p>
          <strong>COMPLIANT</strong> makes your habits, rhythms, interactions,<br />
          and behaviours become content automatically.
        </p>
      </div>
      <LiveScoringProvider profile={MOCK_PROFILE}>
        <div className="lp-feed-capsule">
          <div className="lp-feed-posts">
            <div
              className={`posts-generating-placeholder lp-feed-generating-placeholder${
                loaderLeaving ? ' posts-generating-placeholder--leaving' : ''
              }${!loaderMounted ? ' lp-feed-generating-placeholder--hidden' : ''}`}
              style={{
                '--persona-accent': nextAccent,
                '--post-accent': nextAccent,
              }}
              aria-busy={loaderMounted && !loaderLeaving}
              aria-hidden={!loaderMounted}
              aria-label="Generating post"
            >
              <div className="posts-generating-spinner lp-feed-generating-spinner" aria-hidden />
            </div>
            {items.map((item) => (
              <div key={item.uid} className={`lp-feed-post-wrap lp-feed-post-wrap--${item.anim}`}>
                <PostCard
                  post={{
                    ...item,
                    createdAt: '2026-06-07T15:45:00.000Z',
                    displayName: 'Alex Johnson',
                    handle: '@Alexs MacBook Pro',
                    avatarInitials: 'AJ',
                    avatarSrc: MOCK_AVATAR,
                  }}
                  pillsMode="bottom-only"
                  aiSuggestionsEnabled={false}
                />
              </div>
            ))}
          </div>
        </div>
      </LiveScoringProvider>
    </section>
  );
}

function CtaSection() {
  return (
    <section className="lp-cta-section" style={{ '--stagger-i': 6 }}>
      <h2>
        Start the experience now<br />
        &amp; become <strong>COMPLIANT</strong>
      </h2>
      <button type="button" className="lp-cta-download">Download</button>
    </section>
  );
}

function LandingFooter() {
  return (
    <footer className="lp-footer">
      <div className="lp-footer__top">
        <div className="lp-footer__brand">
          <h2>COMPLIANT</h2>
          <p>Operational identity infrastructure for turning local machine behavior into public-facing persona signals.</p>
        </div>
      </div>

      <div className="lp-footer__grid">
        <div>
          <h3>Product</h3>
          <a href="#lp-app-title">Mac app</a>
          <a href="#lp-personas-title">Personas</a>
          <a href="#lp-identity-title">Identity</a>
        </div>
        <div>
          <h3>Company</h3>
          <a href="mailto:hello@compliant.local">Contact</a>
          <a href="#privacy">Privacy</a>
          <a href="#terms">Terms</a>
        </div>
        <div className="lp-footer__brief">
          <h3>Deployment</h3>
          <p>Designed for local-first profiling workflows, controlled demos, and live social-score presentation.</p>
        </div>
      </div>

      <div className="lp-footer__bottom">
        <span>© 2026 COMPLIANT Systems</span>
        <span>Zurich / Paris / Localhost</span>
      </div>
    </footer>
  );
}

export default function LandingPage({ onBrowseFeed, onLoginClick, profile, profileEntryLoading }) {
  return (
    <div className="lp-root">
      {/* Gradient zone: navbar + hero share the lime→white gradient */}
      <div className="lp-hero-zone">
        <LandingNavbar
          profile={profile}
          onLoginClick={onLoginClick}
          profileEntryLoading={profileEntryLoading}
        />
        <section className="lp-screen lp-hero" style={{ '--stagger-i': 0 }}>
          <div className="lp-hero-body">
            <h2 className="lp-hero-question">Who are you really?</h2>
            <p className="lp-hero-answer">
              <em>Let our algorithm answer that for you.</em>
            </p>
            <button type="button" className="lp-hero-cta-btn">Get Started</button>
          </div>
          <h1 className="lp-hero-title">
            <button
              type="button"
              className="lp-hero-title-link"
              onClick={() => onBrowseFeed?.()}
              aria-label="Browse the public feed"
            >
              COMPLIANT
            </button>
          </h1>
        </section>
      </div>
      <main>
        <AppCarousel />
        <PersonaSections />
        <ProfileCardSection />
        <TransitionBanner />
        <FeedSection />
        <CtaSection />
      </main>
      <LandingFooter />
    </div>
  );
}
