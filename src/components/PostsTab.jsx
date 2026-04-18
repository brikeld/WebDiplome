import { useMemo } from 'react';
import PostCard from './PostCard.jsx';
import {
  displayNameFromProfile,
  formatPostDate,
  initialsFromProfile,
} from '../lib/profileUtils.js';

const PERSONA_COLORS = {
  productivite: '#2323FF',
  securite: '#FF4E00',
  popularite: '#CEFE46',
};

const PERSONA_LABELS = {
  productivite: 'Productivity',
  securite: 'Security',
  popularite: 'Popularity',
};

export default function PostsTab({ profile }) {
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
    const dateLabel = formatPostDate(
      profile.lastAnalysisAt ??
        profile.last_analysis_at ??
        profile.collectedAt ??
        profile.collected_at,
    );
    return raw.map((p, i) => ({
      id: i,
      persona: p.persona,
      content: p.content,
      sentiment: p.sentiment,
      noteColor: PERSONA_COLORS[p.persona] ?? '#2323FF',
      personaLabel: PERSONA_LABELS[p.persona] ?? p.persona,
      displayName,
      handle,
      avatarInitials,
      avatarSrc,
      dateLabel,
    }));
  }, [profile]);

  return (
    <div className="posts-capsule">
      <div className="posts-tab">
        {posts.map((p) => (
          <PostCard key={p.id} post={p} />
        ))}
      </div>
    </div>
  );
}
