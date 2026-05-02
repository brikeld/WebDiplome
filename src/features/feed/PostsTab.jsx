import { useMemo } from 'react';
import PostCard from './PostCard.jsx';
import { sanitizePostContent } from '@/lib/postContent.js';
import { displayNameFromProfile, initialsFromProfile } from '@/lib/profileUtils.js';

const PERSONA_COLORS = {
  productivite: '#2323FF',
  securite: '#FF4E00',
  popularite: '#0FA020',
};

const API_ORIGIN = 'http://localhost:3001';

function resolveAttachment(img) {
  if (!img || typeof img !== 'object') return null;
  const url = img.url ?? img.imageUrl ?? img.image_url ?? null;
  if (!url) return null;
  const absolute = /^https?:\/\//i.test(url) ? url : `${API_ORIGIN}${url}`;
  return { url: absolute, filename: img.filename ?? '' };
}

const PLACEHOLDER_THINKING = {
  productivite: "okay so... 3 jsx files open, figma tab, shell history full of npm run dev. something isn't compiling right. cursor + claude both active — ai-assisted dev, deadline behavior. productivity axis: is this competence or overwhelm? both. the chaos framing gets more engagement. going with self-aware builder voice. +4% productivity feels right.",
  securite: "hmm. VPN on, incognito tab, two-factor prompt dismissed twice. that's avoidance, not security hygiene. signal: aware of the risk, choosing convenience. security score delta is negative but small — passive exposure, not active breach. frame as a nudge not an alarm. don't moralize. cold factual tone.",
  popularite: "checked notifications 4 times in 8 minutes. likes pattern: responds within 90s to comments. follower growth is flat but engagement rate is healthy — this is a micro-influence plateau. frame as: reach is the bottleneck, not resonance. social persona +3% sounds right given the engagement numbers.",
};

function placeholderThinking(persona) {
  const key = String(persona ?? '').toLowerCase();
  return PLACEHOLDER_THINKING[key] ?? PLACEHOLDER_THINKING.productivite;
}

export default function PostsTab({ profile, feedContext = 'home' }) {
  const posts = useMemo(() => {
    if (!profile) return [];
    const raw = profile.personaPosts ?? [];
    const displayName = displayNameFromProfile(profile);
    const avatarInitials = initialsFromProfile(profile);
    const handle = profile?.machineName ? `@${profile.machineName}` : '@—';
    const avatarSrc =
      profile?.wallpaperBase64 ??
      profile?.wallpaper_base64 ??
      profile?.wallpaperUrl ??
      profile?.wallpaper_url ??
      profile?.wallpaper ??
      null;

    const stablePct = (seed) => {
      let h = 0;
      for (let i = 0; i < seed.length; i += 1) {
        h = (h * 31 + seed.charCodeAt(i)) >>> 0;
      }
      return (h % 5) + 1;
    };

    const createdAtFallback = (i) => Date.now() - (i + 1) * 6 * 60 * 60 * 1000;

    return raw.map((p, i) => ({
      id: i,
      persona: p.persona,
      content: sanitizePostContent(p.content),
      noteColor: PERSONA_COLORS[p.persona] ?? '#2323FF',
      displayName,
      handle,
      avatarInitials,
      avatarSrc,
      createdAt:
        p?.createdAt ??
        p?.created_at ??
        p?.created ??
        p?.timestamp ??
        p?.time ??
        createdAtFallback(i),
      systemDeltaPct: stablePct(`${p?.persona ?? ''}|${p?.content ?? ''}|${i}`),
      attachment: resolveAttachment(p.attachedImage ?? p.attached_image),
      thinking: p.thinking ?? placeholderThinking(p.persona),
    }));
  }, [profile]);

  const list = (
    <div className={`posts-tab${feedContext === 'profile' ? ' posts-tab--profile-inline' : ''}`}>
      {posts.map((p) => (
        <PostCard key={p.id} post={p} />
      ))}
    </div>
  );

  if (feedContext === 'profile') return list;

  return <div className="posts-capsule">{list}</div>;
}
