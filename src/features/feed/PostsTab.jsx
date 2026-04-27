import { useMemo } from 'react';
import PostCard from './PostCard.jsx';
import { sanitizePostContent } from '@/lib/postContent.js';
import { displayNameFromProfile, initialsFromProfile } from '@/lib/profileUtils.js';

const PERSONA_COLORS = {
  productivite: '#2323FF',
  securite: '#FF4E00',
  popularite: '#0FA020',
};

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
    return raw.map((p, i) => ({
      id: i,
      persona: p.persona,
      content: sanitizePostContent(p.content),
      noteColor: PERSONA_COLORS[p.persona] ?? '#2323FF',
      displayName,
      handle,
      avatarInitials,
      avatarSrc,
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
