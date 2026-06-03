import { useMemo, useState, useEffect, useRef } from 'react';
import PostCard from './PostCard.jsx';
import { sanitizePostContent } from '@/lib/postContent.js';
import { normalizePostHideKey } from '@/lib/postHideKey.js';
import {
  avatarSrcFromProfile,
  displayNameFromProfile,
  initialsFromProfile,
  machineHandleFromProfile,
  resolveDominantPersonaKey,
  resolvePublicMediaUrl,
} from '@/lib/profileUtils.js';
import { useLiveScoring } from '@/features/liveScoring/useLiveScoring.js';
import { personaUiColor } from '@/lib/personaColors.js';

/** Keep in sync with the `feed-top-flash` animation in base.css. */
const FEED_FLASH_MS = 1100;

const PERSONA_COLORS = {
  productivite: '#D8D8D8',
  securite: '#759AEF',
  popularite: '#CCF847',
  productivity: '#D8D8D8',
  security: '#759AEF',
  popularity: '#CCF847',
};

import { resolveLeaderboardForFeed } from '@/lib/resolveLeaderboardForFeed.js';
import { API_ORIGIN } from '@/lib/apiClient.js';
import { getPublicMediaConfig } from '@/lib/publicMediaConfig.js';
import { resolveAttachedAssetPublicUrl } from '@/lib/uploadPublicUrl.js';

/**
 * Stable identifier for a post that survives a `reloadProfileFromApi` swap.
 *
 * During a stream-reveal the post object carries client-only fields like
 * `_feedKey` (a fresh UUID); after the server reload those fields are gone,
 * so falling back to an array-index `id` would change every key the moment a
 * new post is prepended — React would unmount/remount the whole baseline
 * list and the user would see existing cards flicker. Anchoring the key to
 * the data that *doesn't* change (server-side `persona + createdAt + content
 * prefix`) keeps each card mounted across reveals and reloads.
 */
function postStableKey(p, fallbackIndex) {
  const explicitId = p?.id ?? p?._id ?? p?.uuid;
  if (explicitId !== undefined && explicitId !== null && explicitId !== '') {
    return String(explicitId);
  }
  const persona = String(p?.persona ?? '');
  const ts = String(p?.createdAt ?? p?.created_at ?? p?.created ?? p?.timestamp ?? p?.time ?? '');
  const content = String(p?.content ?? '').slice(0, 60);
  if (persona || ts || content) return `${persona}|${ts}|${content}`;
  return `idx-${fallbackIndex}`;
}

function resolveAttachedAsset(asset) {
  if (!asset || typeof asset !== 'object') return null;
  const kind = asset.kind === 'document' ? 'document' : 'image';
  const config = getPublicMediaConfig();
  const absolute = resolveAttachedAssetPublicUrl(asset, {
    supabaseUrl: config?.supabaseUrl ?? null,
    apiOrigin: API_ORIGIN,
    uploadsBucket: config?.uploadsBucket,
  }) ?? resolvePublicMediaUrl(asset.url ?? (asset.filename ? `/uploads/${asset.filename}` : null), API_ORIGIN);
  if (!absolute) return null;
  const filename =
    asset.filename
    || absolute.split('/').pop()?.split('?')[0]
    || '';
  return {
    kind,
    url: absolute,
    filename,
    mime: asset.mime ?? null,
    visionAnalysed: !!asset.visionAnalysed,
  };
}

const stablePct = (seed) => {
  // Deterministic 1..5 (so it doesn't change every render).
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return (h % 5) + 1;
};

const createdAtFallback = (i) => Date.now() - (i + 1) * 6 * 60 * 60 * 1000; // 6h steps

function postCreatedAtMs(createdAt) {
  return typeof createdAt === 'number' ? createdAt : new Date(createdAt).getTime();
}

function sortNewestFirst(a, b) {
  const at = postCreatedAtMs(a.createdAt);
  const bt = postCreatedAtMs(b.createdAt);
  const cmp = (Number.isFinite(bt) ? bt : 0) - (Number.isFinite(at) ? at : 0);
  if (cmp !== 0) return cmp;
  return (b._feedRevealSeq ?? 0) - (a._feedRevealSeq ?? 0);
}

/** Map one profile's raw persona posts into enriched card models (unsorted). */
function buildEnrichedPosts(
  profile,
  { personaBadgePersona, allProfilesForLeaderboards = null, deletedProfileIds = [] },
) {
  if (!profile) return [];
  const raw = profile.personaPosts ?? [];
  const displayName = displayNameFromProfile(profile);
  const avatarInitials = initialsFromProfile(profile);
  const handle = machineHandleFromProfile(profile);
  const resolvedPersonaBadgePersona = personaBadgePersona ?? resolveDominantPersonaKey(profile);
  const avatarSrc = avatarSrcFromProfile(profile);
  const authorSlug = profile.slug ?? profile.id ?? null;

  const enrichLeaderboardEntries = (entries) => {
    if (!Array.isArray(entries)) return entries;
    return entries.map((entry) => {
      if (entry?.avatarSrc) return entry;
      if (entry?.source !== 'real' || !entry?.slug) return entry;
      const match = (allProfilesForLeaderboards ?? []).find(
        (p) => p?.slug === entry.slug || p?.id === entry.slug,
      );
      const src = match ? avatarSrcFromProfile(match) : null;
      return src ? { ...entry, avatarSrc: src } : entry;
    });
  };

  return raw.map((p, i) => {
    const isCompliantPersonaChange = Boolean(p.compliantPersonaChange);
    const isCompliantLowScore = Boolean(p.compliantLowScore);
    const isCompliantJoin = Boolean(p.compliantJoin);
    const isCompliantSystem = isCompliantPersonaChange || isCompliantLowScore || isCompliantJoin;
    return {
      id: postStableKey(p, i),
      authorSlug,
      persona: p.persona,
      content: sanitizePostContent(p.content),
      noteColor: isCompliantSystem ? '#000' : (PERSONA_COLORS[p.persona] ?? '#2323FF'),
      displayName: isCompliantSystem ? 'COMPLIANT' : displayName,
      handle: isCompliantSystem ? '' : handle,
      avatarInitials,
      avatarSrc,
      personaBadgePersona: resolvedPersonaBadgePersona,
      createdAt:
        p?.createdAt ??
        p?.created_at ??
        p?.created ??
        p?.timestamp ??
        p?.time ??
        createdAtFallback(i),
      systemDeltaPct: stablePct(`${authorSlug ?? ''}|${p?.persona ?? ''}|${p?.content ?? ''}|${i}`),
      attachedAsset: resolveAttachedAsset(p.attachedAsset ?? p.attached_asset),
      chartType: p.chartType ?? p.chart_type ?? null,
      inferenceChain: Array.isArray(p.inferenceChain) ? p.inferenceChain : null,
      ingredients: Array.isArray(p.ingredients) ? p.ingredients : null,
      highlights: Array.isArray(p.highlights) ? p.highlights : null,
      thinking: Array.isArray(p.thinking) ? p.thinking : null,
      compliantPersonaChange: p.compliantPersonaChange ?? null,
      compliantLowScore: p.compliantLowScore ?? null,
      compliantJoin: p.compliantJoin ?? null,
      leaderboard: (p.leaderboard && Array.isArray(p.leaderboard.entries)) ? (() => {
        const base = {
          boardId: p.leaderboard.boardId,
          title: p.leaderboard.title,
          persona: p.leaderboard.persona ?? p.persona,
          userRank: p.leaderboard.userRank,
          previousUserRank: p.leaderboard.previousUserRank ?? null,
          cloneHidden: Array.isArray(p.leaderboard.cloneHidden) ? p.leaderboard.cloneHidden : [false, false, false, false],
          rationales: Array.isArray(p.leaderboard.rationales) ? p.leaderboard.rationales : null,
          climbTip: typeof p.leaderboard.climbTip === 'string' ? p.leaderboard.climbTip : null,
        };
        const directory = allProfilesForLeaderboards?.length
          ? allProfilesForLeaderboards
          : [profile];
        const remixed = resolveLeaderboardForFeed(
          { ...base, entries: p.leaderboard.entries },
          directory,
          authorSlug,
          deletedProfileIds,
        );
        return {
          ...base,
          userRank: remixed.userRank ?? base.userRank,
          entries: enrichLeaderboardEntries(remixed.entries ?? []),
        };
      })() : null,
      _feedEnter: !!p._feedEnter,
      _feedEnterDone: !!p._feedEnterDone,
      _feedKey: p._feedKey ?? null,
      _feedRevealSeq: typeof p._feedRevealSeq === 'number' ? p._feedRevealSeq : 0,
    };
  });
}

export default function PostsTab({
  profile,
  feedProfiles = null,
  deletedProfileIds = [],
  viewerProfile = null,
  aiFeaturesEnabled = true,
  feedContext = 'home',
  isGeneratingPosts = false,
  postRevealFlash = null,
  hideInteractions = false,
  highlightedPostId = null,
  onHighlightPost,
  onPostHide,
  onPostTellMeMore,
  tellMeMorePostId = null,
  personaBadgePersona = null,
  onOpenProfile,
}) {
  const [openCommentsPostIds, setOpenCommentsPostIds] = useState(() => new Set());
  const { isHidden, isRevealing, isLeaderboardSelfHidden } = useLiveScoring();
  const [placeholderMounted, setPlaceholderMounted] = useState(isGeneratingPosts);
  const [placeholderLeaving, setPlaceholderLeaving] = useState(false);
  const placeholderTimerRef = useRef(null);

  // Flash the matching persona accent at the top of the feed each time a post
  // is revealed, mirroring the flash on the generate button so the two read as
  // connected. Only in the live home feed.
  const flashNonce = postRevealFlash?.nonce ?? 0;
  const [feedFlash, setFeedFlash] = useState(null);
  const feedFlashTimerRef = useRef(null);
  useEffect(() => {
    if (!flashNonce || feedContext !== 'home') return undefined;
    setFeedFlash({ nonce: flashNonce, color: personaUiColor(postRevealFlash?.persona) });
    if (feedFlashTimerRef.current) clearTimeout(feedFlashTimerRef.current);
    feedFlashTimerRef.current = setTimeout(() => {
      setFeedFlash(null);
      feedFlashTimerRef.current = null;
    }, FEED_FLASH_MS);
    return undefined;
    // Retrigger only on nonce changes; persona is read fresh each bump.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flashNonce]);
  useEffect(
    () => () => {
      if (feedFlashTimerRef.current) clearTimeout(feedFlashTimerRef.current);
    },
    [],
  );

  useEffect(() => {
    if (placeholderTimerRef.current) {
      clearTimeout(placeholderTimerRef.current);
      placeholderTimerRef.current = null;
    }
    if (isGeneratingPosts) {
      setPlaceholderMounted(true);
      setPlaceholderLeaving(false);
      return undefined;
    }
    if (!placeholderMounted) return undefined;
    setPlaceholderLeaving(true);
    placeholderTimerRef.current = setTimeout(() => {
      placeholderTimerRef.current = null;
      setPlaceholderMounted(false);
      setPlaceholderLeaving(false);
    }, 420);
    return () => {
      if (placeholderTimerRef.current) {
        clearTimeout(placeholderTimerRef.current);
        placeholderTimerRef.current = null;
      }
    };
  }, [isGeneratingPosts, placeholderMounted]);

  const posts = useMemo(() => {
    // "for you" (home) aggregates every profile's posts; profile view shows only one author.
    const aggregated =
      feedContext === 'home' && Array.isArray(feedProfiles) && feedProfiles.length > 0;
    const sources = aggregated ? feedProfiles : profile ? [profile] : [];
    if (sources.length === 0) return [];

    const multiAuthor = sources.length > 1;
    const all = sources.flatMap((src) =>
      buildEnrichedPosts(src, {
        // Per-author badge in a multi-author feed; current theme persona otherwise.
        personaBadgePersona: multiAuthor ? null : personaBadgePersona,
        allProfilesForLeaderboards: sources,
        deletedProfileIds,
      }),
    );

    // Newest first; tie-break so staggered client posts keep order even if timestamps collide.
    return all.sort(sortNewestFirst);
  }, [feedContext, feedProfiles, personaBadgePersona, profile, deletedProfileIds]);

  const leaderboardDirectorySlugs = useMemo(() => {
    const sources = feedContext === 'home' && Array.isArray(feedProfiles) && feedProfiles.length > 0
      ? feedProfiles
      : profile
        ? [profile]
        : [];
    return sources
      .map((p) => p?.slug ?? p?.id)
      .filter(Boolean)
      .map(String);
  }, [feedContext, feedProfiles, profile]);

  const list = (
    <div
      className={`posts-tab${feedContext === 'profile' ? ' posts-tab--profile-inline' : ''}${
        isGeneratingPosts ? ' posts-tab--generating' : ''
      }`}
    >
      {feedFlash ? (
        <div
          key={feedFlash.nonce}
          className="feed-top-flash"
          style={{ '--flash-color': feedFlash.color }}
          aria-hidden
        />
      ) : null}
      {placeholderMounted ? (
        <div
          className={`posts-generating-placeholder${
            placeholderLeaving ? ' posts-generating-placeholder--leaving' : ''
          }`}
          aria-busy={!placeholderLeaving}
          aria-label="Generating posts"
        >
          <div className="posts-generating-spinner" aria-hidden />
        </div>
      ) : null}
      {posts.map((p) => (
        <div
          key={`${p.authorSlug ?? ''}:${p.id}`}
          className={`post-card-shell${
            p._feedEnter ? ' post-card-shell--entering' : p._feedEnterDone ? ' post-card-shell--entered' : ''
          }`}
        >
          <PostCard
            post={p}
            commenterProfile={aiFeaturesEnabled ? viewerProfile : null}
            aiSuggestionsEnabled={aiFeaturesEnabled}
            hidePills={hideInteractions}
            isCommentsOpen={hideInteractions ? false : openCommentsPostIds.has(p.id)}
            onToggleComments={
              hideInteractions
                ? undefined
                : () =>
                    setOpenCommentsPostIds((prev) => {
                      const next = new Set(prev);
                      if (next.has(p.id)) next.delete(p.id);
                      else next.add(p.id);
                      return next;
                    })
            }
            isHidden={
              p.compliantPersonaChange || p.compliantLowScore || p.compliantJoin
                ? false
                : p.leaderboard
                  ? isLeaderboardSelfHidden(p.leaderboard.boardId)
                  : isHidden(normalizePostHideKey(p.createdAt))
            }
            isRevealing={
              p.compliantPersonaChange || p.compliantLowScore || p.compliantJoin
                ? false
                : isRevealing(normalizePostHideKey(p.createdAt))
            }
            isHighlightable={
              !hideInteractions
              && !p.compliantPersonaChange
              && !p.compliantLowScore
              && !p.compliantJoin
            }
            isHighlighted={!hideInteractions && highlightedPostId !== null && highlightedPostId === p.id}
            onHighlight={() => onHighlightPost?.(p)}
            onHide={hideInteractions || !onPostHide ? undefined : () => onPostHide(p)}
            onTellMeMore={
              hideInteractions || !onPostTellMeMore ? undefined : () => onPostTellMeMore(p)
            }
            tellMeMoreActive={tellMeMorePostId === p.id}
            onOpenProfile={onOpenProfile}
            leaderboardDirectorySlugs={leaderboardDirectorySlugs}
          />
        </div>
      ))}
    </div>
  );

  if (feedContext === 'profile') {
    return list;
  }

  return (
    <div className="posts-capsule">
      {list}
    </div>
  );
}
