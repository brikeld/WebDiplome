import { useMemo } from 'react';
import PostCard from './PostCard.jsx';
import { sanitizePostContent } from '@/lib/postContent.js';
import { displayNameFromProfile, initialsFromProfile } from '@/lib/profileUtils.js';

const PERSONA_COLORS = {
  productivite: '#D8D8D8',
  securite: '#759AEF',
  popularite: '#CCF847',
};

const API_ORIGIN = 'http://localhost:3001';

function resolveAttachment(img) {
  if (!img || typeof img !== 'object') return null;
  const url = img.url ?? img.imageUrl ?? img.image_url ?? null;
  if (!url) return null;
  const absolute = /^https?:\/\//i.test(url) ? url : `${API_ORIGIN}${url}`;
  return { url: absolute, filename: img.filename ?? '' };
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
      // Deterministic 1..5 (so it doesn't change every render)
      let h = 0;
      for (let i = 0; i < seed.length; i += 1) {
        h = (h * 31 + seed.charCodeAt(i)) >>> 0;
      }
      return (h % 5) + 1;
    };

    const createdAtFallback = (i) => Date.now() - (i + 1) * 6 * 60 * 60 * 1000; // 6h steps

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
