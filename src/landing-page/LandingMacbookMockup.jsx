import { useEffect, useState } from 'react';

const MINI_PERSONA_LABEL = {
  productivity: 'Productivity',
  security: 'Security',
  popularity: 'Social',
};

const MINI_POST_POOL = [
  { color: '#2323FF', key: 'productivity', lead: 'Closed 47 tabs. Reopened 19.', timeAgo: '4m', deltaPct: 2 },
  { color: '#FF4E00', key: 'security', lead: 'Reused password on 6 services.', timeAgo: '21m', deltaPct: 4 },
  { color: '#0FA020', key: 'popularity', lead: 'Did not reply to mom for 3 days.', timeAgo: '1h', deltaPct: 3 },
  {
    color: '#FF4E00', key: 'security', lead: 'Screen capture: 02:47. Flagged.',
    timeAgo: '47m', deltaPct: 6,
    image: { url: '/uploads/c94b1c8b0f2d705b24f00114132f278d585d9aae9ad534b246fc4f0e92610110.jpg', caption: 'frame_0047 · auto-captured' },
  },
  { color: '#2323FF', key: 'productivity', lead: '4h 22m on yt.com. -3 productivity.', timeAgo: '2h', deltaPct: 5 },
  { color: '#FF4E00', key: 'security', lead: 'wifi: "free_airport_wifi". noted.', timeAgo: '3h', deltaPct: 2 },
  {
    color: '#2323FF', key: 'productivity', lead: 'Productivity: −14% this week.',
    timeAgo: '2h', deltaPct: 4,
    chart: { bars: [72, 88, 60, 95, 52, 34, 22] },
  },
  { color: '#0FA020', key: 'popularity', lead: 'Read 11 messages, replied to 0.', timeAgo: '5h', deltaPct: 4 },
  {
    color: '#0FA020', key: 'popularity', lead: 'No calls logged in 6 days.',
    timeAgo: '3d', deltaPct: 3,
    image: { url: '/uploads/67231882aa8676fd23cfd83278e3ab9f4d4a42950bf1fbf100147aa4055b1f8a.jpg', caption: 'social_trace · silence detected' },
  },
  { color: '#2323FF', key: 'productivity', lead: 'Slept 4h 22m. Score impact: -2.', timeAgo: '6h', deltaPct: 1 },
  { color: '#FF4E00', key: 'security', lead: 'Incognito session: 47 minutes.', timeAgo: '6d', deltaPct: 3 },
  { color: '#0FA020', key: 'popularity', lead: 'Group chat silent for 6 days.', timeAgo: '6d', deltaPct: 2 },
  { color: '#2323FF', key: 'productivity', lead: 'Opened LinkedIn. Closed it. Sad.', timeAgo: '6d', deltaPct: 5 },
];

function MiniCommentIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path d="M4 3h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9.5l-3.7 2.8A.6.6 0 0 1 5 17.4V15H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
    </svg>
  );
}

/**
 * Hero MacBook + mini in-screen feed. Styles live in `landingPage.css` (lp-* classes).
 */
export default function LandingMacbookMockup() {
  const [miniPosts, setMiniPosts] = useState([]);

  useEffect(() => {
    let idx = 0;
    let interval;
    const start = setTimeout(() => {
      const push = () => {
        setMiniPosts((prev) => {
          const base = MINI_POST_POOL[idx % MINI_POST_POOL.length];
          const next = { ...base, id: `${Date.now()}-${idx}` };
          idx += 1;
          return [next, ...prev].slice(0, 10);
        });
      };
      push();
      interval = setInterval(push, 780);
    }, 2900);
    return () => {
      clearTimeout(start);
      if (interval) clearInterval(interval);
    };
  }, []);

  return (
    <div className="lp-macbook-wrap" aria-hidden>
      <div className="lp-macbook">
        <div className="lp-macbook-display">
          <div className="lp-macbook-screen">
            <div className="lp-mini-app">
              <aside className="lp-mini-rail">
                <span className="lp-mini-rail-btn lp-mini-rail-btn--active">⌂</span>
                <span className="lp-mini-rail-btn">⌕</span>
                <span className="lp-mini-rail-btn">✉</span>
                <span className="lp-mini-rail-btn">⌾</span>
                <span className="lp-mini-rail-btn">★</span>
              </aside>

              <div className="lp-mini-col">
                <div className="lp-mini-profile-stack">
                  <span className="lp-mini-cap-avatar">
                    <img src="/imgs/AlexP.png" alt="" />
                  </span>
                  <div className="lp-mini-profile">
                    <div className="lp-mini-profile-text">
                      <span className="lp-mini-profile-name">Alex</span>
                      <span className="lp-mini-profile-handle">
                        @demo_machine
                        <span className="lp-mini-profile-connect">connect</span>
                      </span>
                      <span className="lp-mini-profile-bio">
                        412 days observed · 9,184 events this week
                      </span>
                    </div>
                    <span className="lp-mini-profile-score">74</span>
                  </div>
                  <div className="lp-mini-badges">
                    <span className="lp-mini-badge-circle" />
                    <span className="lp-mini-badge-circle" />
                    <span className="lp-mini-badge-circle" />
                  </div>
                </div>

                <div className="lp-mini-tabs">
                  <span className="lp-mini-tab lp-mini-tab--active">posts</span>
                  <span className="lp-mini-tab">badges</span>
                  <span className="lp-mini-tab">profile</span>
                  <span className="lp-mini-tab">rankings</span>
                </div>

                <div className="lp-mini-posts-shell">
                  <div className="lp-mini-posts-stream">
                    {miniPosts.map((post) => {
                      const personaLabel = MINI_PERSONA_LABEL[post.key] ?? 'Productivity';
                      return (
                        <div
                          key={post.id}
                          className={`lp-mini-post-block${(post.image || post.chart) ? ' lp-mini-post-block--has-media' : ''}`}
                          style={{ '--p-accent': post.color }}
                        >
                          <article className="lp-mini-post" style={{ '--p-accent': post.color }}>
                            <span className="lp-mini-post-avatar">
                              <img src="/imgs/AlexP.png" alt="" />
                            </span>
                            <div className="lp-mini-post-text">
                              <span className="lp-mini-post-lead">{post.lead}</span>
                              <span className="lp-mini-post-byline">Alex · @demo_machine</span>
                            </div>
                          </article>

                          {post.image && (
                            <div className="lp-mini-media-strip lp-mini-media-strip--image">
                              <img src={post.image.url} alt="" className="lp-mini-media-img" />
                              <div className="lp-mini-media-wash" style={{ background: post.color }} />
                            </div>
                          )}
                          {post.chart && (
                            <div className="lp-mini-media-strip lp-mini-media-strip--chart">
                              {post.chart.bars.map((h, i) => (
                                <div
                                  key={i}
                                  className="lp-mini-media-bar"
                                  style={{
                                    height: `${Math.round(h * 46 / 100)}px`,
                                    background: i >= post.chart.bars.length - 2 ? '#FF4E00' : post.color,
                                  }}
                                />
                              ))}
                            </div>
                          )}

                          <div className="lp-mini-post-meta" aria-hidden>
                            <div className="lp-mini-meta-left">
                              <span className="lp-mini-meta-pill">{post.timeAgo} ago</span>
                            </div>
                            <div className="lp-mini-meta-center">
                              <span className="lp-mini-meta-pill lp-mini-meta-pill--system">
                                System note [{personaLabel}] [+{post.deltaPct}%]
                              </span>
                            </div>
                            <div className="lp-mini-meta-right">
                              <span className="lp-mini-meta-pill lp-mini-meta-pill--icon" title="Comment">
                                <MiniCommentIcon />
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
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
