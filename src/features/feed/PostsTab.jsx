import { useMemo, useState, useCallback } from 'react';
import PostCard from './PostCard.jsx';
import { sanitizePostContent } from '@/lib/postContent.js';
import { normalizePostHideKey } from '@/lib/postHideKey.js';
import {
  displayNameFromProfile,
  initialsFromProfile,
  machineHandleFromProfile,
} from '@/lib/profileUtils.js';

const PERSONA_COLORS = {
  productivite: '#D8D8D8',
  securite: '#759AEF',
  popularite: '#CCF847',
};

const API_ORIGIN = 'http://localhost:3001';

function resolveAttachedAsset(asset) {
  if (!asset || typeof asset !== 'object') return null;
  const kind = asset.kind === 'document' ? 'document' : 'image';
  const url = asset.url ?? null;
  if (!url) return null;
  const absolute = /^https?:\/\//i.test(url) ? url : `${API_ORIGIN}${url}`;
  return {
    kind,
    url: absolute,
    filename: asset.filename ?? '',
    mime: asset.mime ?? null,
    visionAnalysed: !!asset.visionAnalysed,
  };
}

export default function PostsTab({ profile, feedContext = 'home', isGeneratingPosts = false, onHidePost, hiddenPostIds }) {
  const [openCommentsPostId, setOpenCommentsPostId] = useState(null);

  const posts = useMemo(() => {
    if (!profile) return [];
    const raw = profile.personaPosts ?? [];
    const displayName = displayNameFromProfile(profile);
    const avatarInitials = initialsFromProfile(profile);
    const handle = machineHandleFromProfile(profile);
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

    const mapped = raw.map((p, i) => ({
      // Use stable id when present, fallback to index
      id: p?.id ?? p?._id ?? p?.uuid ?? i,
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
      attachedAsset: resolveAttachedAsset(p.attachedAsset ?? p.attached_asset),
      _feedEnter: !!p._feedEnter,
      _feedKey: p._feedKey ?? null,
      _feedRevealSeq: typeof p._feedRevealSeq === 'number' ? p._feedRevealSeq : 0,
    }));

    // Newest first; tie-break so staggered client posts keep order even if timestamps collide.
    return mapped.sort((a, b) => {
      const at = typeof a.createdAt === 'number' ? a.createdAt : new Date(a.createdAt).getTime();
      const bt = typeof b.createdAt === 'number' ? b.createdAt : new Date(b.createdAt).getTime();
      const cmp = (Number.isFinite(bt) ? bt : 0) - (Number.isFinite(at) ? at : 0);
      if (cmp !== 0) return cmp;
      return (b._feedRevealSeq ?? 0) - (a._feedRevealSeq ?? 0);
    });
  }, [profile]);

  const list = (
    <div
      className={`posts-tab${feedContext === 'profile' ? ' posts-tab--profile-inline' : ''}${
        isGeneratingPosts ? ' posts-tab--generating' : ''
      }`}
    >
      {isGeneratingPosts ? (
        <div
          className="posts-generating-placeholder"
          aria-busy="true"
          aria-label="Generating posts"
        >
          <div className="posts-generating-spinner" aria-hidden />
        </div>
      ) : null}
      {posts.map((p) => (
        <PostCard
          key={p._feedKey ?? String(p.id)}
          post={p}
          animateEnter={!!p._feedEnter}
          isCommentsOpen={openCommentsPostId === p.id}
          onToggleComments={() =>
            setOpenCommentsPostId((prev) => (prev === p.id ? null : p.id))
          }
          onHide={onHidePost ? () => onHidePost(p.createdAt) : undefined}
          isHidden={hiddenPostIds ? hiddenPostIds.has(normalizePostHideKey(p.createdAt)) : false}
        />
      ))}
    </div>
  );

  if (feedContext === 'profile') return list;

  return <div className="posts-capsule">{list}</div>;
}
