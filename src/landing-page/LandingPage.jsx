import PostCard from '../features/feed/PostCard.jsx';
import './landingPage.css';

const PERSONAS = [
  {
    key: 'popularity',
    color: '#CCF847',
    title: 'Social',
    focus: 'Communication, collaboration, and socially oriented usage.',
    cares:
      'Chat/collab apps in installed apps and recent use. Browser/social patterns where implemented (visits to social/video/community sites). Anything that suggests connected, communicative behavior rather than offline solo work.',
    foot: 'axis 01 of 03 · weighted · no appeals',
  },
  {
    key: 'productivity',
    color: '#D8D8D8',
    title: 'Productivity',
    focus: 'Work output, structure, and create stuff.',
    cares:
      'Apps and habits that look like professional / creative work: dev tools, office/design suites, terminals, scripts, project files. Recent files and shell history that look like creation (code, docs, design) rather than pure consumption.',
    foot: 'axis 02 of 03 · weighted · no appeals',
  },
  {
    key: 'security',
    color: '#759AEF',
    title: 'Security',
    focus: 'Digital hygiene, risk surface, compliance and conformity.',
    cares:
      'System defenses and posture: FileVault, Gatekeeper, SIP, firewall, updates, disk health (SMART), fewer “sketchy” download patterns, fewer repeated errors/crashes as neglect signals.',
    foot: 'axis 03 of 03 · weighted · no appeals',
  },
];

const STEPS = [
  {
    n: '01',
    color: '#D8D8D8',
    title: 'Install. Surrender.',
    body: "The collector deploys silently — exactly the way good software should. It reads every process, keystroke, and connection so you don't have to remember what you did. Browser history, shell, sleep cycles, networks — all backed up. For convenience.",
    foot: 'step 01 of 03 · entirely optional · also mandatory',
  },
  {
    n: '02',
    color: '#759AEF',
    title: 'Process. Be judged.',
    body: 'Your patterns become a posture. Your posture becomes a verdict. The model resolves your entire digital existence into a tidy number between 0 and 100. Finally — an answer to the question "but what kind of person am I?"',
    foot: 'step 02 of 03 · entirely optional · also mandatory',
  },
  {
    n: '03',
    color: '#CCF847',
    title: 'Publish. Smile.',
    body: 'Your file goes public. Score, posts, badges — all visible. Strangers will read it. Recruiters will read it. Your ex will read it. The score updates without notice, because surprises are fun.',
    foot: 'step 03 of 03 · entirely optional · also mandatory',
  },
];

const DEMO_POSTS = [
  {
    id: 'dp-1',
    persona: 'productivite',
    color: '#D8D8D8',
    name: 'Alex Johnson',
    handle: '@AlexLaptop',
    content: 'Resumed work 03:14. Closed 47 tabs. Reopened 19. Productivity penalty applied. Subject was disappointed — we were too.',
    delta: '-2',
    time: '4m',
  },
  {
    id: 'dp-2',
    persona: 'securite',
    color: '#759AEF',
    name: 'Alex Johnson',
    handle: '@AlexLaptop',
    content: 'Webcam active during off-hours. 14 facial expressions classified as guilt. Logged automatically.',
    delta: '-9',
    time: '21m',
    attachment: {
      type: 'photo',
      url: '/uploads/deb273de2bce06fbccb2c0bd07b889a77af5163f37302840855afa6593976548.jpg',
      caption: 'frame_0047 · subject flagged · auto-captured',
    },
  },
  {
    id: 'dp-4',
    persona: 'popularite',
    color: '#CCF847',
    name: 'Alex Johnson',
    handle: '@AlexLaptop',
    content: 'Group chat silent for 6 days. Read 11 messages. Replied to 0. We respect that.',
    delta: '-4',
    time: '6d',
  },
];

function timeToCreatedAt(timeStr) {
  const m = String(timeStr).match(/^(\d+)([mhd])$/);
  if (!m) return new Date();
  const ms = { m: 60_000, h: 3_600_000, d: 86_400_000 }[m[2]];
  return new Date(Date.now() - parseInt(m[1]) * ms);
}

function ProfileHeaderPreview() {
  return (
    <div style={{ '--persona-accent': '#759AEF', '--tabs-capsule-fill': '#c5d4f8' }}>
      <div className="profile-header-stack">
        <div className="profile-hero-capsule">
          <div className="profile-cap-avatar" aria-hidden style={{ '--cap-avatar-stroke': '#759AEF' }}>
            <img className="profile-cap-avatar-img" src="/imgs/AlexP.png" alt="" />
          </div>
          <div className="profile-hero-main">
            <div className="profile-hero-left">
              <div className="profile-name-handle-stack">
                <div className="profile-name-row">
                  <div className="profile-name-lg">Alex Johnson</div>
                </div>
                <div className="profile-handle-row">
                  <div className="profile-handle-lg">@AlexLaptop</div>
                  <button
                    type="button"
                    className="profile-connect-btn"
                    style={{ color: '#759AEF' }}
                  >
                    connect
                  </button>
                </div>
              </div>
              <div className="profile-follow-row">
                <span className="profile-follow-item">
                  <svg className="profile-follow-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                    <path d="M9 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0zm-7 9a7 7 0 0 1 14 0H2z" />
                    <path d="M13 6a3 3 0 1 0 6 0 3 3 0 0 0-6 0zm1 9a7 7 0 0 0-2-4.9A5 5 0 0 1 19 15h-5z" />
                  </svg>
                  <span className="profile-follow-num">412</span>
                </span>
                <span className="profile-follow-item">
                  <svg className="profile-follow-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                    <path d="M10 9a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm0 2c-4.42 0-8 2.02-8 4.5V17h16v-1.5c0-2.48-3.58-4.5-8-4.5z" />
                  </svg>
                  <span className="profile-follow-num">38</span>
                </span>
              </div>
              <p className="profile-bio">
                Subject observed for 412 days without interruption. 9,184 events logged this week.
                Behavior is consistent — perhaps disturbingly so.
              </p>
            </div>
          </div>
        </div>
        <div
          className="profile-badge-capsule"
          style={{
            borderColor: '#759AEF',
            background: 'color-mix(in srgb, #759AEF 15%, #fff)',
          }}
        >
          <div className="profile-badge-circle" style={{ background: '#759AEF' }} />
          <div className="profile-badge-circle" style={{ background: '#759AEF' }} />
          <div className="profile-badge-circle" style={{ background: '#759AEF' }} />
        </div>
      </div>
    </div>
  );
}

export default function LandingPage({ onEnterDemo }) {
  return (
    <div className="lp-root">
      <header className="lp-topbar">
        <button
          type="button"
          className="lp-topbar-debug"
          onClick={() => onEnterDemo?.()}
          title="developer shortcut — enter feed without enrolling"
        >
          debug
        </button>
      </header>

      <main>

        {/* ── SCREEN 1: HERO ── */}
        <section className="lp-screen lp-hero" style={{ '--stagger-i': 0 }}>
          <h1 className="lp-hero-title">COMPLIANT</h1>
          <div className="lp-hero-text">
            <h2 className="lp-hero-sub">
              Who are you really?
              <br />
              <em>Let our algorithm answer that for you.</em>
            </h2>
          </div>
        </section>

        {/* ── SCREEN 2: PROFILE + DOWNLOAD ── */}
        <section className="lp-screen lp-profile-screen" style={{ '--stagger-i': 1 }}>
          <div className="lp-profile-col-left">
            <ProfileHeaderPreview />
            <div className="lp-mock-posts">
              {DEMO_POSTS.map((post) => (
                <PostCard
                  key={post.id}
                  pillsMode="bottom-only"
                  post={{
                    id: post.id,
                    noteColor: post.color,
                    displayName: post.name,
                    handle: post.handle,
                    content: post.content,
                    createdAt: timeToCreatedAt(post.time),
                    systemDeltaPct: Math.abs(parseInt(post.delta, 10)),
                    persona: post.persona,
                    avatarSrc: '/imgs/AlexP.png',
                    attachedAsset: post.attachment?.type === 'photo' ? {
                      kind: 'image',
                      url: post.attachment.url,
                      filename: post.attachment.caption || '',
                    } : undefined,
                  }}
                />
              ))}
            </div>
          </div>

          <div className="lp-profile-col-right">
            <div className="lp-desc-card">
              <h2 className="lp-desc-card-title">Create your compliant identity.</h2>
              <div className="lp-desc-card-body">
                <p>
                  Let Compliant build your digital presence from who you already are.
                  Your habits, rhythms, interactions, and behaviors become content automatically.
                </p>
                <p>
                  No more posting.
                  <br />
                  No more curating yourself.
                  <br />
                  Compliant does it for you.
                </p>
              </div>
            </div>
            <div className="lp-download-card">
              <div className="lp-download-card-info">
                <p className="lp-download-title">Download Compliant</p>
                <p className="lp-download-sub">Let the process begin</p>
                <p className="lp-download-fine">Compliant.dmg · macOS · zero refunds</p>
              </div>
              <div className="lp-app-icon">icon app,{' '}coming soon</div>
            </div>
          </div>
        </section>

        {/* ── SCREEN 3: WORKFLOW ── */}
        <section className="lp-screen lp-workflow-screen" style={{ '--stagger-i': 2 }}>
          <h2 className="lp-screen-title">workflow in 3 parts.</h2>
          <div className="lp-cards-row">
            {STEPS.map((s) => (
              <article
                key={s.n}
                className="lp-workflow-card"
                style={{ '--lp-card-fill': s.color }}
              >
                <span className="lp-persona-num">{s.n}</span>
                <h3 className="lp-desc-card-title">{s.title}</h3>
                <div className="lp-desc-card-body lp-workflow-card-body">
                  <p>{s.body}</p>
                </div>
                <p className="lp-persona-foot">{s.foot}</p>
              </article>
            ))}
          </div>
        </section>

        {/* ── SCREEN 4: PERSONAS ── */}
        <section className="lp-screen lp-personas-screen" style={{ '--stagger-i': 3 }}>
          <h2 className="lp-screen-title">the 3 personas.</h2>
          <div className="lp-cards-row">
            {PERSONAS.map((p, i) => (
              <article
                key={p.key}
                className="lp-persona-card"
                style={{ '--lp-card-fill': p.color }}
              >
                <span className="lp-persona-num">{String(i + 1).padStart(2, '0')}</span>
                <h3 className="lp-desc-card-title">{p.title}</h3>
                <div className="lp-desc-card-body">
                  <div className="lp-persona-chunk">
                    <p className="lp-persona-kicker">Focus:</p>
                    <p>{p.focus}</p>
                  </div>
                  <div className="lp-persona-chunk lp-persona-chunk--fill">
                    <p className="lp-persona-kicker">What it cares about:</p>
                    <p>{p.cares}</p>
                  </div>
                </div>
                <p className="lp-persona-foot">{p.foot}</p>
              </article>
            ))}
          </div>
        </section>

        {/* ── SCREEN 5: SUMMARY ── */}
        <section className="lp-screen lp-summary-screen" style={{ '--stagger-i': 4 }}>
          <h2 className="lp-screen-title">screen resume of everything.</h2>
          <div className="lp-summary-body">

            <div className="lp-summary-profile-card">
              <ProfileHeaderPreview />
            </div>

            <div className="lp-summary-right">
              <div className="lp-summary-mini-row">
                {STEPS.map((s) => (
                  <div key={s.n} className="lp-summary-mini-card">
                    <span className="lp-summary-mini-num">{s.n}</span>
                    <p className="lp-summary-mini-title">{s.title}</p>
                  </div>
                ))}
              </div>

              <div className="lp-summary-mini-row">
                {PERSONAS.map((p, i) => (
                  <div
                    key={p.key}
                    className="lp-summary-mini-card lp-summary-mini-card--persona"
                    style={{ '--lp-card-fill': p.color }}
                  >
                    <span className="lp-summary-mini-num">{String(i + 1).padStart(2, '0')}</span>
                    <p className="lp-summary-mini-title">{p.title}</p>
                  </div>
                ))}
              </div>

              <div className="lp-summary-download-row">
                <div className="lp-summary-download-info">
                  <p className="lp-summary-download-title">Download Compliant</p>
                  <p className="lp-summary-download-fine">Compliant.dmg · macOS · zero refunds</p>
                </div>
                <div className="lp-summary-app-icon">icon app,{' '}coming soon</div>
              </div>
            </div>

          </div>
        </section>

      </main>
    </div>
  );
}
