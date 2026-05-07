import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import PostCard from '../features/feed/PostCard.jsx';
import UPLOAD_URLS from './uploadsList.js';

/* Natural design dimensions inside the macbook screen.
   The macbook screen has aspect-ratio 16:10 — height matches NAT_WIDTH * 10/16. */
const NAT_WIDTH = 1180;
const NAT_HEIGHT = 738;

/* Base text posts — interleaved with image posts built from UPLOAD_URLS below. */
const TEXT_POSTS = [
  { persona: 'productivite', color: '#D8D8D8', content: 'Resumed work 03:14. Closed 47 tabs. Reopened 19. Productivity penalty applied.', delta: 2, time: '4m' },
  { persona: 'securite',     color: '#759AEF', content: 'Reused the same password on 6 services. We told them all.', delta: 4, time: '21m' },
  { persona: 'popularite',   color: '#CCF847', content: 'Did not reply to mom for 3 days. Logged. Shared. Indexed.', delta: 3, time: '1h' },
  { persona: 'productivite', color: '#D8D8D8', content: '4h 22m on yt.com today. Productivity score adjusted accordingly.', delta: 5, time: '2h' },
  { persona: 'securite',     color: '#759AEF', content: 'Connected to "free_airport_wifi". Noted. Everything is noted.', delta: 2, time: '3h' },
  { persona: 'popularite',   color: '#CCF847', content: 'Read 11 messages in group chat. Replied to 0. We respect that.', delta: 4, time: '5h' },
  { persona: 'productivite', color: '#D8D8D8', content: 'Slept 4h 22m. Score impact: −2. Sleep is data too.', delta: 1, time: '6h' },
  { persona: 'securite',     color: '#759AEF', content: 'Incognito session: 47 minutes. Still logged. Obviously.', delta: 3, time: '6d' },
  { persona: 'popularite',   color: '#CCF847', content: 'Group chat has been silent for 6 days. Algorithm concerned.', delta: 2, time: '6d' },
  { persona: 'productivite', color: '#D8D8D8', content: 'Opened LinkedIn. Closed it immediately. Brave but noted.', delta: 5, time: '6d' },
  { persona: 'securite',     color: '#759AEF', content: 'Browser history: 312 domains. 14 flagged. You know which ones.', delta: 6, time: '8h' },
  { persona: 'popularite',   color: '#CCF847', content: 'No calls logged in 6 days. Zero. We checked twice.', delta: 3, time: '1d' },
];

/* Image posts — one entry per upload file, distributed across personas. */
const IMAGE_POSTS = UPLOAD_URLS.map((url, i) => {
  const personas = [
    { persona: 'securite',   color: '#759AEF', content: 'Webcam active during off-hours. 14 facial expressions classified as guilt. Logged automatically.' },
    { persona: 'popularite', color: '#CCF847', content: 'Screen capture logged. Subject appears unaware. Typical.' },
    { persona: 'productivite', color: '#D8D8D8', content: 'Productivity trace captured. Numbers don\'t lie — you do.' },
    { persona: 'securite',   color: '#759AEF', content: 'Keystroke pattern captured. Distinctive. Memorable. Ours.' },
  ];
  const p = personas[i % personas.length];
  return {
    ...p,
    delta: 6 + (i % 4),
    time: `${21 + i * 12}m`,
    attachment: { type: 'photo', url, caption: `trace_${String(i).padStart(4, '0')} · auto-captured` },
  };
});

/* Full pool: interleave text and image posts so the feed feels varied. */
const POST_POOL = TEXT_POSTS.flatMap((t, i) => {
  const img = IMAGE_POSTS[i % IMAGE_POSTS.length];
  return i % 3 === 1 ? [t, img] : [t];
}).map((p, i) => ({ ...p, id: `pool-${i}` }));

function timeToCreatedAt(timeStr) {
  const m = String(timeStr).match(/^(\d+)([mhd])$/);
  if (!m) return new Date();
  const ms = { m: 60_000, h: 3_600_000, d: 86_400_000 }[m[2]];
  return new Date(Date.now() - parseInt(m[1], 10) * ms);
}

export default function LandingMacbookMockup() {
  const wrapRef = useRef(null);
  const screenRef = useRef(null);
  const timersRef = useRef({ initial: [], cycle: null, idx: 0 });

  const [scale, setScale] = useState(0.5);
  const [active, setActive] = useState(false);
  const [openKey, setOpenKey] = useState(0);
  const [visiblePosts, setVisiblePosts] = useState([]);

  /* Compute scale so the natural-size app fits the macbook screen exactly. */
  useLayoutEffect(() => {
    const el = screenRef.current;
    if (!el) return undefined;
    const update = () => {
      const w = el.clientWidth;
      if (w > 0) setScale(w / NAT_WIDTH);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* Lifecycle: section in view → open mac, animate in posts, then cycle.
                section out of view → reset (close + clear posts). */
  useEffect(() => {
    const stopAll = () => {
      timersRef.current.initial.forEach(clearTimeout);
      clearInterval(timersRef.current.cycle);
      timersRef.current.initial = [];
      timersRef.current.cycle = null;
    };

    /* Prepend one post to the top of the list. No scrolling — new posts
       appear at the top of the feed and push older ones down naturally. */
    const pushPost = (poolIdx) => {
      const post = POST_POOL[poolIdx % POST_POOL.length];
      const stamp = `${post.id}-${Date.now()}-${poolIdx}`;
      setVisiblePosts((prev) => [{ ...post, key: stamp }, ...prev].slice(0, 8));
    };

    const begin = () => {
      stopAll();
      timersRef.current.idx = 0;
      /* Reset to 0 posts every time the section comes into view. */
      setVisiblePosts([]);
      setActive(true);
      setOpenKey((k) => k + 1);

      /* Stagger the first 5 posts: one every 900 ms. */
      const INITIAL_COUNT = 5;
      for (let i = 0; i < INITIAL_COUNT; i += 1) {
        const t = setTimeout(() => {
          pushPost(i);
          timersRef.current.idx = i + 1;
        }, 900 + i * 900);
        timersRef.current.initial.push(t);
      }

      /* Then keep cycling: one new post every 2.8 s indefinitely. */
      const cycleDelay = 900 + INITIAL_COUNT * 900 + 600;
      const cycleT = setTimeout(() => {
        timersRef.current.cycle = setInterval(() => {
          pushPost(timersRef.current.idx);
          timersRef.current.idx += 1;
        }, 2800);
      }, cycleDelay);
      timersRef.current.initial.push(cycleT);
    };

    const reset = () => {
      stopAll();
      setActive(false);
      setVisiblePosts([]);
    };

    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) begin();
        else reset();
      },
      { threshold: 0.25 },
    );
    if (wrapRef.current) obs.observe(wrapRef.current);
    return () => { obs.disconnect(); stopAll(); };
  }, []);

  const score = 74;

  return (
    <div className="lp-macbook-wrap" aria-hidden ref={wrapRef}>
      <div className={`lp-macbook${active ? ' lp-macbook--active' : ''}`}>
        <div key={openKey} className="lp-macbook-display">
          <div className="lp-macbook-screen" ref={screenRef}>
            {/* Scale-to-fit stage: natural-size app rendered, transform-scaled to fit screen. */}
            <div
              className="lp-macbook-app"
              style={{
                width: NAT_WIDTH,
                height: NAT_HEIGHT,
                transform: `scale(${scale})`,
              }}
            >
              {/* Sidebar: COMPLIANT label + icon rail (same look as real .project-name + .icon-rail). */}
              <aside className="lp-macbook-app-sidebar">
                <span className="lp-macbook-app-project">COMPLIANT</span>
                <nav className="lp-macbook-app-rail" aria-label="App nav">
                  <button type="button" className="lp-macbook-app-rail-btn">⌂</button>
                  <button type="button" className="lp-macbook-app-rail-btn">⌕</button>
                  <button type="button" className="lp-macbook-app-rail-btn">✉</button>
                  <button type="button" className="lp-macbook-app-rail-btn lp-macbook-app-rail-btn--active">⌾</button>
                  <button type="button" className="lp-macbook-app-rail-btn">★</button>
                  <button type="button" className="lp-macbook-app-rail-btn">≡</button>
                </nav>
              </aside>

              {/* Main column: identical JSX to the "A profile in production." preview. */}
              <div
                className="lp-macbook-app-main"
                style={{ '--persona-accent': '#759AEF', '--tabs-capsule-fill': '#c5d4f8' }}
              >
                <div
                  className="posts-capsule lp-preview-shell lp-macbook-app-capsule"
                >
                  <div className="lp-preview-profile">
                    <div className="profile-header-stack">
                      <div className="profile-hero-capsule">
                        <div
                          className="profile-cap-avatar"
                          aria-hidden
                          style={{ '--cap-avatar-stroke': '#759AEF' }}
                        >
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
                                <svg
                                  className="profile-follow-icon"
                                  viewBox="0 0 20 20"
                                  fill="currentColor"
                                  aria-hidden
                                >
                                  <path d="M9 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0zm-7 9a7 7 0 0 1 14 0H2z" />
                                  <path d="M13 6a3 3 0 1 0 6 0 3 3 0 0 0-6 0zm1 9a7 7 0 0 0-2-4.9A5 5 0 0 1 19 15h-5z" />
                                </svg>
                                <span className="profile-follow-num">412</span>
                              </span>
                              <span className="profile-follow-item">
                                <svg
                                  className="profile-follow-icon"
                                  viewBox="0 0 20 20"
                                  fill="currentColor"
                                  aria-hidden
                                >
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
                      {visiblePosts.map((post) => (
                        <PostCard
                          key={post.key}
                          post={{
                            noteColor: post.color,
                            displayName: post.name ?? 'Alex Johnson',
                            handle: post.handle ?? '@demo_machine',
                            content: post.content,
                            createdAt: timeToCreatedAt(post.time),
                            systemDeltaPct: typeof post.delta === 'number'
                              ? post.delta
                              : Math.abs(parseInt(post.delta, 10)),
                            persona: post.persona,
                            avatarSrc: '/imgs/AlexP.png',
                            attachment: post.attachment?.type === 'photo'
                              ? { url: post.attachment.url, filename: post.attachment.caption || '' }
                              : undefined,
                          }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="lp-macbook-base" />
      </div>
    </div>
  );
}
