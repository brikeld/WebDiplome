import UserSilhouetteIcon from '@/features/identity/UserSilhouetteIcon.jsx';
import PostCard from '@/features/feed/PostCard.jsx';
import ProfileHeader from '@/features/profile/ProfileHeader.jsx';
import { LiveScoringProvider } from '@/features/liveScoring/LiveScoringContext.jsx';
import {
  avatarSrcFromProfile,
  getPersonaBadgeModel,
} from '@/lib/profileUtils.js';
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
  personaScores: {
    productivity: 71,
    security: 64,
    social: 84,
  },
  avatarUrl: MOCK_AVATAR,
  wallpaperBase64: MOCK_AVATAR,
  profileSummary: 'I keep every signal tidy, every system current, and every conversation moving just in case my digital identity needs to pass inspection.',
  personaPosts: [],
};

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
    render: () => (
      <div className="lp-mac-screen-content lp-mac-collect">
        <div className="lp-mac-collect-head">
          <h3>Collecting data</h3>
          <p>Reconstructing 7-day history...</p>
        </div>
        <div className="lp-mac-progress">
          <div><span>Step 3 / 4</span><b>72%</b></div>
          <i />
        </div>
        <div className="lp-mac-phases">
          <div className="is-done"><span>01</span><p>Machine identity</p></div>
          <div className="is-done"><span>02</span><p>History · 7d</p></div>
          <div className="is-active"><span>03</span><p>Assets</p></div>
          <div><span>04</span><p>Scoring signals</p></div>
        </div>
        <div className="lp-mac-logbox">
          <span><b>17:25:34</b> history → shell · 612 commands</span>
          <span><b>17:25:35</b> sqlite3 Safari/History.db ✓</span>
          <span><b>17:25:36</b> wifi known_networks · 9 SSID</span>
          <span><b>17:25:37</b> app usage windows · 7d ✓</span>
          <span><b>17:25:38</b> login/last sessions parsed ✓</span>
        </div>
      </div>
    ),
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
            <div className="lp-mac-profile-score">78</div>
          </div>
        </div>
        <div className="lp-mac-profile-block lp-mac-profile-block--stats">
          <header><span>System data</span><i /><b /></header>
          <div className="lp-mac-statgrid">
            <span><b>OS Version</b>macOS 15.3</span>
            <span><b>Applications</b>142</span>
            <span><b>RAM</b>16 GB</span>
            <span><b>Storage</b>61%</span>
          </div>
        </div>
        <div className="lp-mac-profile-block">
          <header><span>Persona scores</span><i /><b /></header>
          <div className="lp-mac-algo">
            <span><b>71</b>productivity</span>
            <span className="is-main"><b>84</b>social</span>
            <span><b>64</b>security</span>
          </div>
        </div>
      </div>
    ),
  },
];

const PERSONAS = [
  {
    name: 'Social',
    className: 'lp-persona-card--social',
    about: 'Communication, collaboration and socially oriented usage.',
    focus: "'Chat/collab apps in installed apps and recent use. Browser/social patterns where implemented. Anything that suggests connected, communicative behavior rather than offline solo work.",
  },
  {
    name: 'Productivity',
    className: 'lp-persona-card--productivity',
    about: 'Work output, structure and professional usage.',
    focus: 'Apps and habits that look like professional or creative work: dev tools, office/design suites, terminals, scripts, project files, recent files and shell history.',
  },
  {
    name: 'Security',
    className: 'lp-persona-card--security',
    about: 'Digital hygiene, risk surface and conformity.',
    focus: 'System defenses and posture. FileVault, Gatekeeper, SIP, firewall, updates, disk health, fewer sketchy downloads, fewer repeated errors and fewer neglect signals.',
  },
];

const FAKE_POSTS = [
  {
    id: 'landing-productivity-post',
    persona: 'productivite',
    personaBadgePersona: 'productivity',
    noteColor: '#D8D8D8',
    content: 'I save every screenshot and asset folder just in case my digital existence ever needs to be perfectly optimized for compliance.',
    systemDeltaPct: 3,
  },
  {
    id: 'landing-security-post',
    persona: 'securite',
    personaBadgePersona: 'security',
    noteColor: '#759AEF',
    content: "The list of saved Wi-Fi networks is a digital breadcrumb trail. From my secure home router to that 'Guest' network... I swear someone is tracking every single stop. 📶 paranoia mode activated. 😱🧐",
    systemDeltaPct: 2,
  },
  {
    id: 'landing-social-post',
    persona: 'popularite',
    personaBadgePersona: 'popularity',
    noteColor: '#CCF847',
    content: 'Three chat apps open, two group threads revived, and somehow every calendar invite has become a personality test. Presence is the product.',
    systemDeltaPct: 4,
  },
];

function AppCarousel() {
  return (
    <section className="lp-screen lp-app-showcase" aria-labelledby="lp-app-title" style={{ '--stagger-i': 1 }}>
      <div className="lp-app-left">
        <h2 id="lp-app-title">THE COMPLIANT APP</h2>
        <div className="lp-app-step-list" aria-label="App screens">
          {APP_SCREENS.map((screen, index) => (
            <div
              key={screen.id}
              className="lp-app-step"
              style={{ '--step-i': index }}
            >
              <span>{screen.number}</span>
              <p>{screen.description}</p>
            </div>
          ))}
        </div>
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

function PersonaSections() {
  return (
    <section className="lp-screen lp-personas" aria-labelledby="lp-personas-title" style={{ '--stagger-i': 2 }}>
      <h2 id="lp-personas-title">THE THREE PERSONAS</h2>
      <div className="lp-persona-grid">
        {PERSONAS.map((persona) => (
          <article key={persona.name} className={`lp-persona-card ${persona.className}`}>
            <h3>{persona.name}</h3>
            <div>
              <h4>About</h4>
              <p>{persona.about}</p>
            </div>
            <div>
              <h4>Focus</h4>
              <p>{persona.focus}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function IdentitySection() {
  return (
    <section className="lp-screen lp-identity" aria-labelledby="lp-identity-title" style={{ '--stagger-i': 3 }}>
      <div className="lp-identity-copy">
        <h2 id="lp-identity-title">
          YOUR <span className="lp-identity-emphasis">COMPLIANT</span> IDENTITY
        </h2>
        <p>Let COMPLIANT build your presence from who you already are.</p>
        <p>Your habits, rhythms, interactions, and behaviors become content automatically.</p>
        <div
          className="lp-identity-profile-card"
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
      </div>
      <LiveScoringProvider profile={MOCK_PROFILE}>
        <div className="lp-identity-post-capsule">
        <div className="lp-identity-feed" aria-label="Fake posts">
          {FAKE_POSTS.map((post) => (
            <PostCard
              key={post.id}
              post={{
                ...post,
                createdAt: '2026-06-07T15:45:00.000Z',
                displayName: 'Alex Johnson',
                handle: '@Alexs MacBook Pro',
                avatarInitials: 'AJ',
                avatarSrc: MOCK_AVATAR,
              }}
              pillsMode="bottom-only"
              aiSuggestionsEnabled={false}
            />
          ))}
        </div>
        </div>
      </LiveScoringProvider>
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
        <div className="lp-footer__status" aria-label="Platform status">
          <span>System status</span>
          <strong>Profile ingestion online</strong>
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

function LandingHeroAccess({ profile, onEnterProfile, onRegister, profileEntryLoading }) {
  const hasProfile = Boolean(profile);

  if (hasProfile) {
    const avatarSrc = avatarSrcFromProfile(profile);
    const personaColor = getPersonaBadgeModel(profile).color;

    return (
      <div className="lp-hero-access">
        <button
          type="button"
          className={`lp-hero-access-profile${profileEntryLoading ? ' lp-hero-access-profile--loading' : ''}`}
          onClick={() => onEnterProfile?.()}
          disabled={profileEntryLoading}
          aria-busy={profileEntryLoading}
          aria-label="Enter COMPLIANT"
        >
          <span
            className={`lp-hero-avatar-box${profileEntryLoading ? ' lp-hero-avatar-box--loading' : ''}`}
            style={{
              '--lp-avatar-top': personaColor,
              '--lp-avatar-bottom': '#e88a2d',
            }}
          >
            {avatarSrc ? (
              <img className="lp-hero-avatar-img" src={avatarSrc} alt="" />
            ) : (
              <UserSilhouetteIcon className="lp-hero-avatar-initials" />
            )}
          </span>
          <span className="lp-hero-access-btn">
            {profileEntryLoading ? 'Loading…' : 'enter COMPLIANT'}
          </span>
        </button>
      </div>
    );
  }

  return (
    <div className="lp-hero-access">
      <button type="button" className="lp-hero-access-btn lp-hero-access-btn--solo" onClick={onRegister}>
        Register
      </button>
    </div>
  );
}

export default function LandingPage({ profile, onEnterProfile, onBrowseFeed, onRegister, profileEntryLoading }) {
  return (
    <div className="lp-root">
      <main>
        <section className="lp-screen lp-hero" style={{ '--stagger-i': 0 }}>
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
          <div className="lp-hero-footer">
            <div className="lp-hero-text">
              <h2 className="lp-hero-sub">
                Who are you really?
                <br />
                <em>Let our algorithm answer that for you.</em>
              </h2>
            </div>
            <LandingHeroAccess
              profile={profile}
              onEnterProfile={onEnterProfile}
              onRegister={onRegister}
              profileEntryLoading={profileEntryLoading}
            />
          </div>
        </section>
        <AppCarousel />
        <PersonaSections />
        <IdentitySection />
      </main>
      <LandingFooter />
    </div>
  );
}
