import { useEffect, useRef, useState } from 'react';
import LandingMacbookMockup from './LandingMacbookMockup.jsx';
import PostCard from '../features/feed/PostCard.jsx';
import PostActions from '../features/feed/PostActions.jsx';
import './landingPage.css';

const PERSONAS = [
  {
    key: 'productivity',
    color: '#2323FF',
    fill: '#D9D9FD',
    title: 'Productivity',
    line: 'Output. Focus. Throughput. (No, really.)',
    body: 'We count your idle minutes so you don\'t have to. Distraction is now a measurable failure — congratulations, the hours you wasted are public, indexed, and dated.',
    metric: '14:22:08 active today · keep it up champ',
  },
  {
    key: 'security',
    color: '#FF4E00',
    fill: '#FFE3D7',
    title: 'Security',
    line: 'Exposure. Hygiene. Paranoia (healthy).',
    body: 'Your "summer2019" password? We saw. We told 47,000 strangers. You\'re welcome — transparency is how trust is built.',
    metric: '47 vulnerabilities indexed · share with friends',
  },
  {
    key: 'popularity',
    color: '#0FA020',
    fill: '#E1FFE4',
    title: 'Social',
    line: 'Connections. Reach. Presence (or lack of).',
    body: 'Silence is data. Isolation is data. We tally every group chat you went quiet in. The algorithm thinks you should call your mother — also, your mother thinks so.',
    metric: '0 unread messages · suspiciously online',
  },
];

const STEPS = [
  {
    n: '01',
    title: 'Install. Surrender.',
    body: 'The collector deploys silently — exactly the way good software should. It reads every process, keystroke, and connection so you don\'t have to remember what you did. Browser history, shell, sleep cycles, networks — all backed up. For convenience.',
  },
  {
    n: '02',
    title: 'Process. Be judged.',
    body: 'Your patterns become a posture. Your posture becomes a verdict. The model resolves your entire digital existence into a tidy number between 0 and 100. Finally — an answer to the question "but what kind of person am I?"',
  },
  {
    n: '03',
    title: 'Publish. Smile.',
    body: 'Your file goes public. Score, posts, badges — all visible. Strangers will read it. Recruiters will read it. Your ex will read it. The score updates without notice, because surprises are fun.',
  },
];

const DEMO_POSTS = [
  {
    id: 'dp-1',
    persona: 'productivite',
    color: '#2323FF',
    name: 'Alex Johnson',
    handle: '@demo_machine',
    content: 'Resumed work 03:14. Closed 47 tabs. Reopened 19. Productivity penalty applied. Subject was disappointed — we were too.',
    delta: '-2',
    label: 'Productivity',
    time: '4m',
  },
  {
    id: 'dp-2',
    persona: 'securite',
    color: '#FF4E00',
    name: 'Alex Johnson',
    handle: '@demo_machine',
    content: 'Webcam active during off-hours. 14 facial expressions classified as guilt. Logged automatically.',
    delta: '-9',
    label: 'Security',
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
    color: '#0FA020',
    name: 'Alex Johnson',
    handle: '@demo_machine',
    content: 'Group chat silent for 6 days. Read 11 messages. Replied to 0. We respect that.',
    delta: '-4',
    label: 'Social',
    time: '6d',
  },
];

function timeToCreatedAt(timeStr) {
  const m = String(timeStr).match(/^(\d+)([mhd])$/);
  if (!m) return new Date();
  const ms = { m: 60_000, h: 3_600_000, d: 86_400_000 }[m[2]];
  return new Date(Date.now() - parseInt(m[1]) * ms);
}

function DemoChartPost({ post }) {
  return (
    <article
      className="post-card post-card--has-attachment"
      data-persona={post.persona}
      style={{ '--post-accent': post.color }}
    >
      <div className="post-composite">
        <div className="post-card-bubble">
          <div className="post-card-head">
            <div className="post-avatar" aria-hidden>
              <img className="post-avatar-img" src="/imgs/AlexP.png" alt="" />
            </div>
            <div className="post-card-text">
              <div className="post-card-lead">
                <p className="post-lead">{post.content}</p>
              </div>
              <div className="post-card-byline">
                <p className="post-card-name">{post.name}</p>
                <p className="post-card-handle">{post.handle}</p>
              </div>
            </div>
          </div>
        </div>
        <DemoChart
          color={post.color}
          metric={post.attachment.metric}
          label={post.attachment.label}
          bars={post.attachment.bars}
          xlabels={post.attachment.xlabels}
        />
      </div>
      <div className="post-meta-row" aria-label="Post metadata">
        <div className="post-meta-left">
          <span className="post-meta-pill">{post.time} ago</span>
        </div>
        <div className="post-meta-center">
          <span className="post-meta-pill">
            System note [{post.label}] [{post.delta}%]
          </span>
        </div>
        <div className="post-meta-right">
          <PostActions />
        </div>
      </div>
    </article>
  );
}

function useCountUp(target, durationMs = 1400) {
  const [value, setValue] = useState(0);
  const ref = useRef(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (!ref.current) return undefined;
    const el = ref.current;
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !startedRef.current) {
            startedRef.current = true;
            const start = performance.now();
            const tick = (now) => {
              const t = Math.min(1, (now - start) / durationMs);
              const eased = 1 - Math.pow(1 - t, 3);
              setValue(Math.round(eased * target));
              if (t < 1) requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
          }
        });
      },
      { threshold: 0.4 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [target, durationMs]);

  return [value, ref];
}

function PulseDot() {
  return <span className="lp-pulse-dot" aria-hidden />;
}

function DemoChart({ color, metric, label, bars, xlabels }) {
  const barMaxIdx = bars.length - 2;
  return (
    <div className="lp-demo-chart" style={{ '--chart-accent': color }}>
      <div className="lp-demo-chart-grid" />
      <div className="lp-demo-chart-scanlines" />
      <div className="lp-demo-chart-header">
        <span className="lp-demo-chart-label">{label}</span>
        <span className="lp-demo-chart-num">{metric}</span>
      </div>
      <div className="lp-demo-chart-bars">
        {bars.map((h, i) => (
          <div
            key={i}
            className="lp-demo-chart-bar"
            style={{ height: `${h}%`, background: i >= barMaxIdx ? '#FF4E00' : color }}
          />
        ))}
      </div>
      <div className="lp-demo-chart-xlabels">
        {xlabels.map((l) => <span key={l}>{l}</span>)}
      </div>
    </div>
  );
}

export default function LandingPage({ onEnterDemo }) {
  const [score, scoreRef] = useCountUp(74);
  const [sessionId] = useState(() =>
    (3120 + Math.floor(Math.random() * 480)).toString(16).toUpperCase()
  );

  return (
    <div className="lp-root">
      {/* Top global bar — project name + debug skip */}
      <header className="lp-topbar">
        <div className="lp-topbar-brand">
          <span className="lp-topbar-mark" aria-hidden />
          <span className="lp-topbar-name">projectName</span>
        </div>
        <div className="lp-topbar-status">
          <PulseDot />
          <span>monitoring · session #{sessionId} · ip logged for your safety</span>
        </div>
        <button
          type="button"
          className="lp-topbar-debug"
          onClick={() => onEnterDemo?.()}
          title="developer shortcut — enter feed without enrolling"
        >
          <span className="lp-topbar-debug-tag">debug</span>
          <span>skip to feed →</span>
        </button>
      </header>

      <main className="lp-main">
        {/* HERO */}
        <section className="lp-section lp-hero" style={{ '--stagger-i': 1 }}>
          <div className="lp-hero-text">
            <p className="lp-eyebrow">subject onboarding · v1.0 · welcome aboard</p>
            <h1 className="lp-headline">
              Your digital life,
              <br />
              <span className="lp-headline-accent">quantified.</span>
            </h1>
            <p className="lp-hero-hook">
              Who are you really? Let our algorithm answer that for you!
            </p>
            <p className="lp-sub">
              A friendly script harvests your machine. A reasonable algorithm decides who you are.
              Your profile becomes public — because what you do in private should also be a number.
              <br />
              <em className="lp-sub-em">opt-in is automatic. opt-out is theoretical.</em>
            </p>
            <div className="lp-hero-meta">
              <span className="lp-meta-pill lp-meta-pill--solid">continuous evaluation</span>
              <span className="lp-meta-pill">no appeals</span>
              <span className="lp-meta-pill">visible to all</span>
              <span className="lp-meta-pill">shareable</span>
            </div>
          </div>
          <LandingMacbookMockup />
        </section>

        {/* SURVEILLANCE TICKER — black bar of rolling subjects */}
        <section className="lp-section lp-ticker-section" style={{ '--stagger-i': 2 }}>
          <div className="lp-ticker" role="status" aria-label="Live subject ticker">
            <div className="lp-ticker-track">
              {[0, 1].map((dup) => (
                <div key={dup} style={{ display: 'flex', gap: 36 }} aria-hidden={dup === 1}>
                  <span className="lp-ticker-item">
                    <span className="lp-ticker-tag">live</span>
                    <span>@subject_4f81</span>
                    <span className="lp-ticker-arrow lp-ticker-arrow--down">47 ↓</span>
                    <span>classification: security risk</span>
                  </span>
                  <span className="lp-ticker-sep" />
                  <span className="lp-ticker-item">
                    <span>@m.dupont</span>
                    <span className="lp-ticker-arrow lp-ticker-arrow--up">91 ↑</span>
                    <span>productivity champion · 6 days streak</span>
                  </span>
                  <span className="lp-ticker-sep" />
                  <span className="lp-ticker-item">
                    <span>@kara_w</span>
                    <span className="lp-ticker-arrow lp-ticker-arrow--down">22 ↓</span>
                    <span>last seen typing 'how to delete account' at 02:14</span>
                  </span>
                  <span className="lp-ticker-sep" />
                  <span className="lp-ticker-item">
                    <span className="lp-ticker-tag">flagged</span>
                    <span>@a.tomas</span>
                    <span className="lp-ticker-arrow lp-ticker-arrow--down">8 ↓</span>
                    <span>incognito session · 4h 22m</span>
                  </span>
                  <span className="lp-ticker-sep" />
                  <span className="lp-ticker-item">
                    <span>@demo_machine</span>
                    <span className="lp-ticker-arrow lp-ticker-arrow--down">74 ↓</span>
                    <span>reused password since 2019</span>
                  </span>
                  <span className="lp-ticker-sep" />
                  <span className="lp-ticker-item">
                    <span>@p.sato</span>
                    <span className="lp-ticker-arrow lp-ticker-arrow--up">88 ↑</span>
                    <span>social champion · 412 group chats</span>
                  </span>
                  <span className="lp-ticker-sep" />
                  <span className="lp-ticker-item">
                    <span className="lp-ticker-tag">new</span>
                    <span>@user_91ef</span>
                    <span className="lp-ticker-arrow lp-ticker-arrow--down">31 ↓</span>
                    <span>classified as: idle</span>
                  </span>
                  <span className="lp-ticker-sep" />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="lp-section lp-steps" style={{ '--stagger-i': 3 }}>
          <header className="lp-section-head lp-section-head--capsule">
            <p className="lp-section-kicker">protocol · three easy steps</p>
            <h2 className="lp-section-title">How the file is built.</h2>
            <p className="lp-section-lede">
              No setup wizard. No checkboxes. We respect your time too much to ask permission.
            </p>
          </header>
          <div className="lp-steps-row">
            {STEPS.map((s, i) => (
              <article
                key={s.n}
                className="lp-step-card"
                style={{ '--stagger-i': 4 + i }}
              >
                <span className="lp-step-num">{s.n}</span>
                <h3 className="lp-step-title">{s.title}</h3>
                <p className="lp-step-body">{s.body}</p>
                <div className="lp-step-divider" aria-hidden />
                <p className="lp-step-foot">step {s.n} of 03 · entirely optional · also mandatory</p>
              </article>
            ))}
          </div>
        </section>

        {/* PERSONAS */}
        <section className="lp-section lp-personas" style={{ '--stagger-i': 6 }}>
          <header className="lp-section-head lp-section-head--capsule">
            <p className="lp-section-kicker">classification · pick a side (we already did)</p>
            <h2 className="lp-section-title">Three axes. One verdict. Zero refunds.</h2>
            <p className="lp-section-lede">
              Every subject is graded along three axes. The algorithm assigns a dominant persona.
              You don't choose — that would defeat the purpose.
            </p>
          </header>
          <div className="lp-persona-row">
            {PERSONAS.map((p, i) => (
              <article
                key={p.key}
                className={`lp-persona-card lp-persona-card--${p.key}`}
                style={{
                  '--card-accent': p.color,
                  '--card-fill': p.fill,
                  '--stagger-i': 7 + i,
                }}
              >
                <div className="lp-persona-head">
                  <span className="lp-persona-dot" aria-hidden />
                  <span className="lp-persona-id">{p.title.toLowerCase()}.persona</span>
                </div>
                <h3 className="lp-persona-title">{p.title}</h3>
                <p className="lp-persona-line">{p.line}</p>
                <p className="lp-persona-body">{p.body}</p>
                <div className="lp-persona-foot">
                  <span className="lp-persona-metric">{p.metric}</span>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* SCORE PREVIEW */}
        <section className="lp-section lp-preview" style={{ '--stagger-i': 11 }}>
          <header className="lp-section-head lp-section-head--capsule">
            <p className="lp-section-kicker">specimen · live preview</p>
            <h2 className="lp-section-title">A profile in production.</h2>
            <p className="lp-section-lede">
              What other subjects will see when the script finishes its first sweep of your machine.
              Yours will be similar. Probably worse.
            </p>
          </header>

          {/* Wrapper sets --persona-accent so all real profile/post CSS classes work correctly */}
          <div
            className="lp-preview-demo"
            style={{ '--persona-accent': '#2323FF', '--tabs-capsule-fill': '#D9D9FD' }}
          >
            <div className="lp-preview-watermark" aria-hidden>specimen · live · public</div>

            {/* EXACT ProfileHeader structure — same DOM, same classes */}
            <div className="profile-header-stack">
              <div className="profile-hero-capsule">
                <div className="profile-cap-avatar" aria-hidden style={{ '--cap-avatar-stroke': '#2323FF' }}>
                  <img className="profile-cap-avatar-img" src="/imgs/AlexP.png" alt="" />
                </div>
                <div className="profile-hero-main">
                  <div className="profile-hero-left">
                    <div className="profile-name-handle-stack">
                      <div className="profile-name-row">
                        <div className="profile-name-lg">Alex Johnson</div>
                      </div>
                      <div className="profile-handle-row">
                        <div className="profile-handle-lg">@demo_machine</div>
                        <button
                          type="button"
                          className="profile-connect-btn"
                          style={{ color: 'var(--persona-accent)' }}
                        >
                          connect
                        </button>
                      </div>
                    </div>
                    <div className="profile-follow-row">
                      <span className="profile-follow-item">
                        <svg className="profile-follow-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                          <path d="M9 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0zm-7 9a7 7 0 0 1 14 0H2z"/>
                          <path d="M13 6a3 3 0 1 0 6 0 3 3 0 0 0-6 0zm1 9a7 7 0 0 0-2-4.9A5 5 0 0 1 19 15h-5z"/>
                        </svg>
                        <span className="profile-follow-num">412</span>
                      </span>
                      <span className="profile-follow-item">
                        <svg className="profile-follow-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                          <path d="M10 9a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm0 2c-4.42 0-8 2.02-8 4.5V17h16v-1.5c0-2.48-3.58-4.5-8-4.5z"/>
                        </svg>
                        <span className="profile-follow-num">38</span>
                      </span>
                    </div>
                    <p className="profile-bio">
                      Subject observed for 412 days without interruption. 9,184 events logged this week.
                      Behavior is consistent — perhaps disturbingly so.
                    </p>
                  </div>

                  <div
                    ref={scoreRef}
                    className="profile-score-avatar"
                    aria-label={`Score ${score}`}
                    style={{ '--score-fill': '#2323FF' }}
                  >
                    <span className="profile-score-avatar-num">{score}</span>
                  </div>
                </div>
              </div>

              <div
                className="profile-badge-capsule"
                style={{
                  borderColor: '#2323FF',
                  background: 'color-mix(in srgb, #2323FF 15%, #fff)',
                }}
              >
                <div className="profile-badge-circle" style={{ background: '#2323FF' }} />
                <div className="profile-badge-circle" style={{ background: '#2323FF' }} />
                <div className="profile-badge-circle" style={{ background: '#2323FF' }} />
              </div>
            </div>

            {/* Posts — uses real PostCard component for identical design to main app */}
            <div className="posts-capsule lp-preview-posts-capsule">
              <div className="posts-tab">
                {DEMO_POSTS.map((post) => {
                  if (post.attachment?.type === 'chart') {
                    return <DemoChartPost key={post.id} post={post} />;
                  }
                  return (
                    <PostCard
                      key={post.id}
                      post={{
                        noteColor: post.color,
                        displayName: post.name,
                        handle: post.handle,
                        content: post.content,
                        createdAt: timeToCreatedAt(post.time),
                        systemDeltaPct: Math.abs(parseInt(post.delta, 10)),
                        persona: post.persona,
                        avatarSrc: '/imgs/AlexP.png',
                        attachment: post.attachment?.type === 'photo' ? {
                          url: post.attachment.url,
                          filename: post.attachment.caption || '',
                        } : undefined,
                      }}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* DOWNLOAD CTA — two-column: pitch + fake permissions dialog */}
        <section className="lp-section lp-cta" style={{ '--stagger-i': 13 }}>
          <div className="lp-cta-grid">
            <div className="lp-cta-pitch">
              <p className="lp-section-kicker lp-section-kicker--plain">enrolment · final step</p>
              <h2 className="lp-cta-title">Begin instrumentation.</h2>
              <p className="lp-cta-sub">
                The collector cannot be uninstalled by you alone — it's paired to your score, and we wouldn't want anything
                bad to happen to that. Your free trial of self-determination has ended.
              </p>
              <button type="button" className="lp-cta-button">
                <span className="lp-cta-button-icon" aria-hidden>↓</span>
                <span className="lp-cta-button-body">
                  <span className="lp-cta-button-top">download projectName</span>
                  <span className="lp-cta-button-bottom">projectName.dmg · macOS · 18.4 MB · zero refunds</span>
                </span>
              </button>
              <button
                type="button"
                className="lp-cta-secondary"
                onClick={() => onEnterDemo?.()}
              >
                or observe an existing subject →
              </button>
            </div>

            <aside className="lp-perms" aria-label="Required permissions">
              <div className="lp-perms-titlebar">
                <span className="lp-perms-tl-dot lp-perms-tl-dot--r" />
                <span className="lp-perms-tl-dot lp-perms-tl-dot--y" />
                <span className="lp-perms-tl-dot lp-perms-tl-dot--g" />
                <span className="lp-perms-tl-title">projectName · permissions</span>
              </div>
              <div className="lp-perms-body">
                <div className="lp-perms-head">
                  <span className="lp-perms-head-icon">!</span>
                  <span className="lp-perms-head-text">
                    <span className="lp-perms-head-title">"projectName" requires access</span>
                    <span className="lp-perms-head-sub">required to keep your score accurate</span>
                  </span>
                </div>
                <ul className="lp-perms-list">
                  <li className="lp-perms-item">
                    <span className="lp-perms-check" aria-hidden>✓</span>
                    <span>full disk access</span>
                    <span className="lp-perms-item-state">granted</span>
                  </li>
                  <li className="lp-perms-item">
                    <span className="lp-perms-check" aria-hidden>✓</span>
                    <span>screen recording</span>
                    <span className="lp-perms-item-state">granted</span>
                  </li>
                  <li className="lp-perms-item">
                    <span className="lp-perms-check" aria-hidden>✓</span>
                    <span>keystroke logging</span>
                    <span className="lp-perms-item-state">granted</span>
                  </li>
                  <li className="lp-perms-item">
                    <span className="lp-perms-check" aria-hidden>✓</span>
                    <span>microphone &amp; camera</span>
                    <span className="lp-perms-item-state">granted</span>
                  </li>
                  <li className="lp-perms-item">
                    <span className="lp-perms-check" aria-hidden>✓</span>
                    <span>browser history &amp; cookies</span>
                    <span className="lp-perms-item-state">granted</span>
                  </li>
                  <li className="lp-perms-item">
                    <span className="lp-perms-check" aria-hidden>✓</span>
                    <span>contacts, calendar, location</span>
                    <span className="lp-perms-item-state">granted</span>
                  </li>
                </ul>
                <div className="lp-perms-actions">
                  <button type="button" className="lp-perms-btn lp-perms-btn--deny" disabled>deny</button>
                  <button type="button" className="lp-perms-btn lp-perms-btn--allow">allow all (recommended)</button>
                </div>
              </div>
            </aside>
          </div>

          <p className="lp-cta-foot">
            <span className="lp-cta-foot-tag">fine print</span>
            installation grants persistent read access to disk, network, input devices, microphone, and webcam (just in case).
            data is not deleted on uninstall. the score follows the subject. previous selves cannot be reinstated.
            by clicking "allow all" you confirm you have read nothing.
          </p>
        </section>

        {/* FOOTER */}
        <footer className="lp-footer" style={{ '--stagger-i': 14 }}>
          <span className="lp-footer-brand">projectName</span>
          <span className="lp-footer-sep" aria-hidden>·</span>
          <span className="lp-footer-tag">every click leaves a trace. every silence does too.</span>
          <span className="lp-footer-spacer" aria-hidden />
          <span className="lp-footer-meta">build 1.0.0 · {new Date().getFullYear()} · the score is final</span>
        </footer>
      </main>
    </div>
  );
}
