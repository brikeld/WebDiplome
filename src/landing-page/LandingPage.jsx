import { useEffect, useRef, useState } from 'react';
import LandingMacbookMockup from './LandingMacbookMockup.jsx';
import PostCard from '../features/feed/PostCard.jsx';
import './landingPage.css';

const PERSONAS = [
  {
    key: 'productivity',
    color: '#D8D8D8',
    title: 'Productivity',
    body: 'We count your idle minutes so you don\'t have to. Distraction is now a measurable failure — congratulations, the hours you wasted are public, indexed, and dated.',
    metric: '14:22:08 active today · keep it up champ',
  },
  {
    key: 'security',
    color: '#759AEF',
    title: 'Security',
    body: 'Your "summer2019" password? We saw. We told 47,000 strangers. You\'re welcome — transparency is how trust is built, one leaked credential at a time.',
    metric: '47 vulnerabilities indexed · share with friends',
  },
  {
    key: 'popularity',
    color: '#CCF847',
    title: 'Social',
    body: 'Silence is data. Isolation is data. We tally every group chat you went quiet in. The algorithm thinks you should call your mother — also, your mother thinks so.',
    metric: '0 unread messages · suspiciously online',
  },
];

const HERO_PILLS = [
  { key: 'data', color: '#D8D8D8', label: 'YOUR DATA' },
  { key: 'habits', color: '#759AEF', label: 'YOUR HABITS' },
  { key: 'score', color: '#CCF847', label: 'YOUR SCORE' },
];

const STEPS = [
  {
    n: '01',
    color: '#D8D8D8',
    title: 'Install. Surrender.',
    body: 'The collector deploys silently — exactly the way good software should. It reads every process, keystroke, and connection so you don\'t have to remember what you did. Browser history, shell, sleep cycles, networks — all backed up. For convenience.',
  },
  {
    n: '02',
    color: '#759AEF',
    title: 'Process. Be judged.',
    body: 'Your patterns become a posture. Your posture becomes a verdict. The model resolves your entire digital existence into a tidy number between 0 and 100. Finally — an answer to the question "but what kind of person am I?"',
  },
  {
    n: '03',
    color: '#CCF847',
    title: 'Publish. Smile.',
    body: 'Your file goes public. Score, posts, badges — all visible. Strangers will read it. Recruiters will read it. Your ex will read it. The score updates without notice, because surprises are fun.',
  },
];

const DEMO_POSTS = [
  {
    id: 'dp-1',
    persona: 'productivite',
    color: '#D8D8D8',
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
    color: '#759AEF',
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
    color: '#CCF847',
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

export default function LandingPage({ onEnterDemo }) {
  const [score, scoreRef] = useCountUp(74);

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

      <main className="lp-main">
        {/* ── HERO ── 100vh: title + body text */}
        <section className="lp-hero lp-section" style={{ '--stagger-i': 0 }}>
          <div className="lp-hero-inner">
            <div className="lp-hero-header-group">
              <h1 className="lp-hero-title lp-hero-title--top">COMPLIANT</h1>

              <div className="lp-hero-text">
                <h2 className="lp-hero-sub">
                  <span className="lp-hero-sub-capsule">
                    Your digital life<br />
                    <em>quantified.</em>
                  </span>
                </h2>
              </div>
            </div>

            <p className="lp-hero-body">
              A friendly script harvests your machine. A reasonable
              algorithm decides who you are. Your profile becomes public —
              because what you do in private should also be a number.
              opt-in is automatic, opt-out is theoretical.{' '}
              Who are you really? Let our algorithm answer that for you!
            </p>
          </div>
        </section>

        {/* ── MOCKUP ── second screen */}
        <section className="lp-mockup-section lp-section" style={{ '--stagger-i': 1 }}>
          <div className="lp-persona-pills-row lp-persona-pills-row--hero">
            {HERO_PILLS.map((p) => (
              <span
                key={p.key}
                className="lp-persona-pill"
                style={{ '--pill-accent': p.color }}
              >
                {p.label}
              </span>
            ))}
          </div>
          <LandingMacbookMockup />
        </section>

        {/* ── THE WORKFLOW ── */}
        <section
          className="lp-section lp-workflow-section lp-capsule-section"
          style={{ '--stagger-i': 2, '--header-bg': '#CCF847' }}
        >
          <div className="lp-section-header-group">
            <div className="lp-capsule-header">
              The workflow.
            </div>
            <div className="lp-section-lede-wrap">
              <p className="lp-section-lede">
                A friendly script harvests your machine. A reasonable algorithm decides who you are.
                Your profile becomes public — because what you do in private should also be a number.
              </p>
            </div>
            <p className="lp-section-sublede lp-section-sublede--below">
              No setup wizard. No checkboxes. We respect your time too much to ask permission.
            </p>
          </div>
          <div className="lp-steps-row">
            {STEPS.map((s, i) => (
              <article
                key={s.n}
                className="lp-step-card lp-section"
                style={{ '--step-color': s.color, '--stagger-i': 3 + i }}
              >
                <span className="lp-step-num">{s.n}</span>
                <h3 className="lp-step-title">{s.title}</h3>
                <p className="lp-step-body">{s.body}</p>
                <p className="lp-step-foot">step {s.n} of 03 · entirely optional · also mandatory</p>
              </article>
            ))}
          </div>
        </section>

        {/* ── THREE AXES. ONE VERDICT. ── */}
        <section
          className="lp-section lp-axes-section lp-capsule-section"
          style={{ '--stagger-i': 6, '--header-bg': '#759AEF' }}
        >
          <div className="lp-section-header-group">
            <div className="lp-capsule-header">
              Three axes.
              <br />
              One verdict.
            </div>
            <div className="lp-section-lede-wrap">
              <p className="lp-section-lede">
                Every subject is graded along three axes. The algorithm assigns a dominant persona.
                You don't choose — that would defeat the purpose.
              </p>
            </div>
            <p className="lp-section-sublede lp-section-sublede--below">
              Three<br />Algorithms
            </p>
          </div>
          <div className="lp-steps-row">
            {PERSONAS.map((p, i) => {
              const n = String(i + 1).padStart(2, '0');
              return (
                <article
                  key={p.key}
                  className="lp-step-card lp-section"
                  style={{ '--step-color': p.color, '--stagger-i': 7 + i }}
                >
                  <span className="lp-step-num">{n}</span>
                  <h3 className="lp-step-title">{p.title}</h3>
                  <p className="lp-step-body">{p.body}</p>
                  <p className="lp-step-foot">axis {n} of 03 · weighted · no appeals</p>
                </article>
              );
            })}
          </div>
        </section>

        {/* ── A PROFILE IN PRODUCTION ── */}
        <section
          className="lp-section lp-profile-section lp-capsule-section"
          style={{ '--stagger-i': 10, '--header-bg': '#CCF847' }}
        >
          <div className="lp-capsule-header">
            A profile in production.
          </div>
          <div className="lp-section-lede-wrap">
            <p className="lp-section-lede">
              What other subjects will see when the script finishes its first sweep of your machine.
              Yours will be similar. Probably worse.
            </p>
          </div>

          <div
            className="lp-preview-demo"
            style={{ '--persona-accent': '#759AEF', '--tabs-capsule-fill': '#c5d4f8' }}
          >

            <div className="posts-capsule lp-preview-shell">
              <div className="lp-preview-profile">
                <div className="profile-header-stack">
                  <div className="profile-hero-capsule">
                    <div className="profile-cap-avatar" aria-hidden style={{ '--cap-avatar-stroke': '#759AEF' }}>
                      <img className="profile-cap-avatar-img" src="/imgs/AlexP.png" alt="" />
                    </div>
                    <div className="profile-hero-main">
                      <div className="profile-hero-left lp-preview-scale">
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

                      <div
                        ref={scoreRef}
                        className="profile-score-avatar"
                        aria-label={`Score ${score}`}
                        style={{ '--score-fill': '#759AEF' }}
                      >
                        <span className="profile-score-avatar-num">{score}</span>
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

              <div className="lp-preview-posts-inner">
                <div className="posts-tab">
                  {DEMO_POSTS.map((post) => (
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
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── DOWNLOAD CTA ── */}
        <section
          className="lp-section lp-cta-section lp-capsule-section"
          style={{ '--stagger-i': 13, '--header-bg': '#759AEF' }}
        >
          <div className="lp-capsule-header">
            download Compliant.
          </div>
          <div className="lp-section-lede-wrap">
            <p className="lp-section-lede">
              What other subjects will see when the script finishes its first sweep of your machine.
              Yours will be similar. Probably worse.
            </p>
          </div>
          <div className="lp-cta-card">
            <p className="lp-cta-card-title">Let the process begin</p>
            <div className="lp-cta-card-actions">
              <button type="button" className="lp-cta-download-btn">
                <span className="lp-cta-btn-icon" aria-hidden>↓</span>
                <span className="lp-cta-btn-label">
                  <span className="lp-cta-btn-top">download Compliant</span>
                  <span className="lp-cta-btn-sub">Compliant.dmg · macOS · 18.4 MB · zero refunds</span>
                </span>
              </button>
              <button
                type="button"
                className="lp-cta-secondary-btn"
                onClick={() => onEnterDemo?.()}
              >
                or observe an existing subject →
              </button>
            </div>
          </div>
        </section>

        <footer className="lp-footer" style={{ '--stagger-i': 14 }}>
          <span className="lp-footer-brand">COMPLIANT</span>
          <span className="lp-footer-sep" aria-hidden>·</span>
          <span className="lp-footer-tag">every click leaves a trace. every silence does too.</span>
          <span className="lp-footer-spacer" aria-hidden />
          <span className="lp-footer-meta">build 1.0.0 · {new Date().getFullYear()} · the score is final</span>
        </footer>

      </main>
    </div>
  );
}
