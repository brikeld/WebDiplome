import { useEffect, useRef, useState } from 'react';

const PERSONAS = [
  {
    key: 'productivity',
    color: '#2323FF',
    fill: '#D9D9FD',
    title: 'Productivity',
    line: 'Output. Focus. Throughput.',
    body: 'Idle minutes are catalogued. Distraction is a measurable failure. The hours you wasted are public.',
    metric: '14:22:08 active today',
  },
  {
    key: 'security',
    color: '#FF4E00',
    fill: '#FFE3D7',
    title: 'Security',
    line: 'Exposure. Hygiene. Paranoia.',
    body: 'Reused passwords are flagged. Weak networks are logged. Your attack surface is an open document.',
    metric: '47 vulnerabilities indexed',
  },
  {
    key: 'popularity',
    color: '#0FA020',
    fill: '#E1FFE4',
    title: 'Social',
    line: 'Connections. Reach. Presence.',
    body: 'Silence is data. Isolation is data. The network counts what you withhold as carefully as what you publish.',
    metric: '0 unread messages — verified',
  },
];

const STEPS = [
  {
    n: '01',
    title: 'Install.',
    body: 'The collector deploys silently. Every process, every keystroke, every connection — recorded. Browser history, shell, sleep cycles, networks. The script does not ask twice.',
  },
  {
    n: '02',
    title: 'Process.',
    body: 'Patterns become posture. Posture becomes verdict. The model resolves your machine into a single number between 0 and 100. The algorithm does not forget.',
  },
  {
    n: '03',
    title: 'Publish.',
    body: 'Your file goes public. Score, posts, badges — all visible. Strangers will read it. The score updates without notice. There is no archive of your previous self.',
  },
];

const DEMO_POSTS = [
  {
    persona: 'productivite',
    color: '#2323FF',
    name: 'Alex Johnson',
    handle: '@demo_machine',
    initials: 'AJ',
    content: 'Resumed work 03:14. Closed 47 tabs. Reopened 19. Productivity penalty applied.',
    delta: '-2',
    label: 'Productivity',
    time: '4m',
  },
  {
    persona: 'securite',
    color: '#FF4E00',
    name: 'Alex Johnson',
    handle: '@demo_machine',
    initials: 'AJ',
    content: 'Reused password detected on 6 services. Same string since 2019. Subject has been notified. Subject did not respond.',
    delta: '-9',
    label: 'Security',
    time: '21m',
  },
];

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
  return <span className="landing-pulse-dot" aria-hidden />;
}

export default function LandingTab({ onEnterDemo }) {
  const [score, scoreRef] = useCountUp(74);
  const [viewerCount] = useState(() => 3120 + Math.floor(Math.random() * 480));

  return (
    <div className="landing-page">
      <div
        className="landing-monitor-bar"
        style={{ '--stagger-i': 0 }}
        role="status"
      >
        <PulseDot />
        <span>monitoring active · session id #{viewerCount.toString(16).toUpperCase()}</span>
        <span className="landing-monitor-spacer" aria-hidden />
        <span>your ip is logged</span>
      </div>

      <section className="landing-section landing-hero" style={{ '--stagger-i': 1 }}>
        <div className="landing-hero-text">
          <p className="landing-eyebrow">subject onboarding · v1.0</p>
          <h1 className="landing-headline">Your digital life, quantified.</h1>
          <p className="landing-sub">
            A script harvests your machine. An algorithm reads the traces. Your profile becomes public.
            The score is continuous. There is no opt-out per session.
          </p>
          <div className="landing-hero-meta">
            <span className="landing-meta-pill landing-meta-pill--solid">continuous evaluation</span>
            <span className="landing-meta-pill">no appeals</span>
            <span className="landing-meta-pill">visible to all</span>
          </div>
        </div>
        <div className="landing-hero-orb" aria-hidden>
          <div className="landing-hero-orb-ring" />
          <div className="landing-hero-orb-circle">
            <span className="landing-hero-orb-num">100</span>
            <span className="landing-hero-orb-cap">max score</span>
          </div>
        </div>
      </section>

      <section className="landing-section landing-steps" style={{ '--stagger-i': 2 }}>
        <header className="landing-section-head">
          <p className="landing-section-kicker">protocol</p>
          <h2 className="landing-section-title">How the file is built.</h2>
        </header>
        <div className="landing-steps-row">
          {STEPS.map((s, i) => (
            <article
              key={s.n}
              className="landing-step-card"
              style={{ '--stagger-i': 3 + i }}
            >
              <span className="landing-step-num">{s.n}</span>
              <h3 className="landing-step-title">{s.title}</h3>
              <p className="landing-step-body">{s.body}</p>
              <div className="landing-step-divider" aria-hidden />
              <p className="landing-step-foot">step {s.n} of 03 · mandatory</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-section landing-personas" style={{ '--stagger-i': 6 }}>
        <header className="landing-section-head">
          <p className="landing-section-kicker">classification</p>
          <h2 className="landing-section-title">Three axes. One verdict.</h2>
          <p className="landing-section-lede">
            Every subject is graded along three axes. The algorithm assigns a dominant persona.
            You do not choose. The traces choose.
          </p>
        </header>
        <div className="landing-persona-row">
          {PERSONAS.map((p, i) => (
            <article
              key={p.key}
              className={`landing-persona-card landing-persona-card--${p.key}`}
              style={{
                '--card-accent': p.color,
                '--card-fill': p.fill,
                '--stagger-i': 7 + i,
              }}
            >
              <div className="landing-persona-head">
                <span className="landing-persona-dot" aria-hidden />
                <span className="landing-persona-id">{p.title.toLowerCase()}.persona</span>
              </div>
              <h3 className="landing-persona-title">{p.title}</h3>
              <p className="landing-persona-line">{p.line}</p>
              <p className="landing-persona-body">{p.body}</p>
              <div className="landing-persona-foot">
                <span className="landing-persona-metric">{p.metric}</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-section landing-preview" style={{ '--stagger-i': 11 }}>
        <header className="landing-section-head">
          <p className="landing-section-kicker">specimen</p>
          <h2 className="landing-section-title">A profile in production.</h2>
          <p className="landing-section-lede">
            What other subjects will see when the script finishes its first sweep of your machine.
          </p>
        </header>

        <div className="landing-preview-frame">
          <div className="landing-preview-watermark" aria-hidden>
            specimen · live · public
          </div>

          <div className="landing-preview-hero">
            <div className="landing-preview-cap-avatar" aria-hidden>AJ</div>
            <div className="landing-preview-hero-main">
              <div className="landing-preview-hero-left">
                <div className="landing-preview-name">Alex Johnson</div>
                <div className="landing-preview-handle-row">
                  <span className="landing-preview-handle">@demo_machine</span>
                  <span className="landing-preview-status">
                    <PulseDot /> indexed 14s ago
                  </span>
                </div>
                <p className="landing-preview-bio">
                  Subject has been observed for 412 days. 9,184 events recorded this week. Behavior is consistent with persona classification.
                </p>
              </div>
              <div
                ref={scoreRef}
                className="landing-preview-score"
                aria-label={`Score ${score}`}
              >
                <span className="landing-preview-score-num">{score}</span>
              </div>
            </div>
          </div>

          <div className="landing-preview-posts">
            {DEMO_POSTS.map((post) => (
              <article
                key={post.label}
                className="landing-preview-post"
                data-persona={post.persona}
                style={{ '--post-accent': post.color }}
              >
                <div className="landing-preview-post-bubble">
                  <div className="landing-preview-post-head">
                    <div className="landing-preview-post-avatar" aria-hidden>{post.initials}</div>
                    <div className="landing-preview-post-text">
                      <p className="landing-preview-post-lead">{post.content}</p>
                      <div className="landing-preview-post-byline">
                        <span className="landing-preview-post-name">{post.name}</span>
                        <span className="landing-preview-post-handle">{post.handle}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="landing-preview-post-meta">
                  <span className="landing-preview-meta-pill">{post.time} ago</span>
                  <span className="landing-preview-meta-pill landing-preview-meta-pill--center">
                    System note [{post.label}] [{post.delta}%]
                  </span>
                  <span className="landing-preview-meta-pill landing-preview-meta-pill--mute">auto-published</span>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-section landing-cta" style={{ '--stagger-i': 13 }}>
        <div className="landing-cta-inner">
          <p className="landing-section-kicker landing-section-kicker--inverse">enrolment</p>
          <h2 className="landing-cta-title">Begin instrumentation.</h2>
          <p className="landing-cta-sub">
            Download the collector. The collector cannot be uninstalled by you alone — it is paired to your score.
            Continuous evaluation begins on launch.
          </p>
          <div className="landing-cta-actions">
            <button type="button" className="landing-cta-btn">
              <span className="landing-cta-btn-icon" aria-hidden>↓</span>
              <span className="landing-cta-btn-label">
                <span className="landing-cta-btn-top">download collector</span>
                <span className="landing-cta-btn-bottom">SocialScore.dmg · macOS · 18.4 MB</span>
              </span>
            </button>
            <button
              type="button"
              className="landing-cta-secondary"
              onClick={() => onEnterDemo?.()}
            >
              observe an existing subject →
            </button>
          </div>
          <p className="landing-cta-warning">
            <span className="landing-cta-warning-tag">warning</span>
            installation grants persistent read access to disk, network, and input devices. data is not deleted on uninstall. the score follows the subject.
          </p>
        </div>
      </section>

      <footer className="landing-footer" style={{ '--stagger-i': 14 }}>
        <span className="landing-footer-brand">SocialScore</span>
        <span className="landing-footer-sep" aria-hidden>·</span>
        <span className="landing-footer-tag">every click leaves a trace.</span>
        <span className="landing-footer-spacer" aria-hidden />
        <span className="landing-footer-meta">build 1.0.0 · {new Date().getFullYear()} · the score is final</span>
      </footer>
    </div>
  );
}
