import { useEffect, useRef, useState } from 'react';
import { fetchLatestMacRelease } from '@/lib/apiClient.js';
import PostCard from '../features/feed/PostCard.jsx';
import PersonaBadge from '@/features/identity/PersonaBadge.jsx';
import UserSilhouetteIcon from '@/features/identity/UserSilhouetteIcon.jsx';
import {
  avatarSrcFromProfile,
  getPersonaBadgeModel,
} from '@/lib/profileUtils.js';
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
                  <span className="profile-hero-badge-slot">
                    <PersonaBadge persona="security" className="profile-hero-persona-badge" />
                  </span>
                </div>
                <div className="profile-handle-row">
                  <div className="profile-handle-lg">@AlexLaptop</div>
                </div>
              </div>
              <div className="profile-follow-row">
                <button
                  type="button"
                  className="profile-follow-item profile-follow-item--button"
                  aria-label="View 42 posts"
                  data-profile-tab-target="posts"
                >
                  <svg className="profile-follow-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                    <path d="M4 3.5A1.5 1.5 0 0 1 5.5 2h9A1.5 1.5 0 0 1 16 3.5v13a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 4 16.5v-13Zm3 2a1 1 0 1 0 0 2h6a1 1 0 1 0 0-2H7Zm0 4a1 1 0 1 0 0 2h6a1 1 0 1 0 0-2H7Zm0 4a1 1 0 1 0 0 2h4a1 1 0 1 0 0-2H7Z" />
                  </svg>
                  <span className="profile-follow-num">42</span>
                </button>
                <button
                  type="button"
                  className="profile-follow-item profile-follow-item--button"
                  aria-label="View 6 rankings"
                  data-profile-tab-target="leaderboards"
                >
                  <svg className="profile-follow-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                    <path d="M5 3h10v2h2a1 1 0 0 1 1 1v1.25A4.75 4.75 0 0 1 13.25 12H13a4.05 4.05 0 0 1-2 1.84V16h3a1 1 0 1 1 0 2H6a1 1 0 1 1 0-2h3v-2.16A4.05 4.05 0 0 1 7 12h-.25A4.75 4.75 0 0 1 2 7.25V6a1 1 0 0 1 1-1h2V3Zm0 4H4v.25A2.75 2.75 0 0 0 5.95 9.88 7.73 7.73 0 0 1 5 7V7Zm11 0h-1a7.73 7.73 0 0 1-.95 2.88A2.75 2.75 0 0 0 16 7.25V7Z" />
                  </svg>
                  <span className="profile-follow-num">6</span>
                </button>
              </div>
              <p className="profile-bio">
                "Subject observed for 412 days without interruption. 9,184 events logged this week.
                Behavior is consistent — perhaps disturbingly so."
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
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
          aria-label="Enter your profile feed"
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
            {profileEntryLoading ? 'Loading…' : 'Enter feed'}
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
  const downloadRef = useRef(null);
  const [release, setRelease] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetchLatestMacRelease()
      .then((r) => { if (!cancelled) setRelease(r); })
      .catch(() => { if (!cancelled) setRelease(null); });
    return () => { cancelled = true; };
  }, []);

  const downloadUrl = release?.downloadUrl || '#';
  const downloadLabel = release
    ? `Compliant.dmg · macOS · ${release.sizeLabel || release.version}`
    : 'Compliant.dmg · macOS · coming soon';

  const handleRegister = () => {
    onRegister?.();
    downloadRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="lp-root">
      <main>

        {/* ── SCREEN 1: HERO ── */}
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
              onRegister={handleRegister}
              profileEntryLoading={profileEntryLoading}
            />
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
                    personaBadgePersona: 'security',
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
            <a
              className="lp-download-card lp-download-link"
              ref={downloadRef}
              href={downloadUrl}
              aria-disabled={release ? 'false' : 'true'}
              download={Boolean(release)}
            >
              <div className="lp-download-card-info">
                <p className="lp-download-title">Download Compliant</p>
                <p className="lp-download-sub">Let the process begin</p>
                <p className="lp-download-fine">{downloadLabel}</p>
              </div>
              <div className="lp-app-icon">{release ? 'download' : 'coming soon'}</div>
            </a>
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
                  <p className="lp-summary-download-fine">{downloadLabel}</p>
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
