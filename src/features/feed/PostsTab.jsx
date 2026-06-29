import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import PostCard from './PostCard.jsx';
import { sanitizePostContent } from '@/lib/postContent.js';
import { fetchCommentsByPostIds, isPersistablePostId } from '@/lib/commentsApi.js';
import { isHostedApiOrigin } from '@/lib/aiJobClient.js';
import { resolvePostHiddenState, resolvePostRevealingState } from '@/lib/postVisibility.js';
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
/** Home feed renders this many cards first; older posts stay available via See more. */
const HOME_FEED_PAGE_SIZE = 20;

const PERSONA_COLORS = {
  productivite: '#D8D8D8',
  securite: '#759AEF',
  popularite: '#CCF847',
  productivity: '#D8D8D8',
  security: '#759AEF',
  popularity: '#CCF847',
};

import { enrichLeaderboardPostForFeed } from '@/lib/leaderboardPostSync.js';
import { dedupeLeaderboardPostsNewestOnly } from '@/lib/leaderboardFeedDedupe.js';
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

function isSitePublicAssetUrl(raw) {
  return String(raw || '').startsWith('/videoDEMO/');
}

export function resolveAttachedAsset(asset) {
  if (!asset || typeof asset !== 'object') return null;
  const kind = asset.kind === 'document' ? 'document' : 'image';
  const config = getPublicMediaConfig();
  const rawUrl = String(asset.url || '').trim();
  const absolute = isSitePublicAssetUrl(rawUrl)
    ? rawUrl
    : resolveAttachedAssetPublicUrl(asset, {
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

// Captured ONCE at module load — never `Date.now()` per call. A per-call
// timestamp would shift on every render, so timestamp-less posts would jump
// position each time the feed re-rendered (e.g. navigating home→profile→home).
const FEED_ORDER_EPOCH = Date.now();
const createdAtFallback = (i) => FEED_ORDER_EPOCH - (i + 1) * 6 * 60 * 60 * 1000; // 6h steps

function postCreatedAtMs(createdAt) {
  return typeof createdAt === 'number' ? createdAt : new Date(createdAt).getTime();
}

export function sortNewestFirst(a, b) {
  const aRevealSeq = Number(a?._feedRevealSeq ?? 0) || 0;
  const bRevealSeq = Number(b?._feedRevealSeq ?? 0) || 0;
  // `_feedRevealSeq` is a GLOBAL monotonic reveal counter (shared across every
  // author's reveal queue — see feedSpectatorReveals.js), so it captures the
  // true order posts appeared in the live feed. Order by it first: the most
  // recently revealed post sits on top regardless of author, and freshly
  // revealed posts (seq > 0) stay above untouched baseline posts (seq 0) even
  // when baseline/seed data carries a future-dated createdAt. We order by reveal
  // sequence rather than createdAt because the hosted worker/DB does not stamp
  // post timestamps in a reliably monotonic way across generation cycles.
  if (aRevealSeq !== bRevealSeq) return bRevealSeq - aRevealSeq;
  // Baseline posts (both seq 0), or an exact collision, fall back to post time.
  const at = postCreatedAtMs(a.createdAt);
  const bt = postCreatedAtMs(b.createdAt);
  const ad = Number.isFinite(at) ? at : 0;
  const bd = Number.isFinite(bt) ? bt : 0;
  if (ad !== bd) return bd - ad;
  // Final deterministic tiebreaker by stable identity. Without it, posts with
  // equal seq AND equal/missing timestamps keep whatever relative order the
  // input array happened to have — and that input order changes between polls
  // (the directory re-sorts authors), so the feed would visibly reshuffle.
  return postStableKey(a, 0).localeCompare(postStableKey(b, 0));
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
  const authorLiveScoringRecords =
    profile?.liveScoringRecords && typeof profile.liveScoringRecords === 'object'
      ? profile.liveScoringRecords
      : {};

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

    const directory = allProfilesForLeaderboards?.length
      ? allProfilesForLeaderboards
      : [profile];
    const leaderboardSync = (p.leaderboard && Array.isArray(p.leaderboard.entries))
      ? enrichLeaderboardPostForFeed({
        storedLeaderboard: p.leaderboard,
        storedContent: p.content,
        directory,
        authorSlug,
        deletedProfileIds,
      })
      : null;
    // Never show a leaderboard post whose author has dropped out of the live
    // top 5 — a user can't "post" a board they are no longer ranked in.
    if (leaderboardSync && !leaderboardSync.authorInTopRows) return null;
    const resolvedContent = leaderboardSync?.content ?? p.content;

    return {
      id: postStableKey(p, i),
      authorSlug,
      _authorLiveScoringRecords: authorLiveScoringRecords,
      persona: p.persona,
      content: sanitizePostContent(resolvedContent),
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
      systemDeltaPct: stablePct(`${authorSlug ?? ''}|${p?.persona ?? ''}|${resolvedContent ?? ''}|${i}`),
      attachedAsset: resolveAttachedAsset(p.attachedAsset ?? p.attached_asset),
      chartType: p.chartType ?? p.chart_type ?? null,
      inferenceChain: Array.isArray(p.inferenceChain) ? p.inferenceChain : null,
      ingredients: Array.isArray(p.ingredients) ? p.ingredients : null,
      highlights: Array.isArray(p.highlights) ? p.highlights : null,
      thinking: Array.isArray(p.thinking) ? p.thinking : null,
      compliantPersonaChange: p.compliantPersonaChange ?? null,
      compliantLowScore: p.compliantLowScore ?? null,
      compliantJoin: p.compliantJoin ?? null,
      leaderboard: leaderboardSync ? {
        ...leaderboardSync.leaderboard,
        entries: enrichLeaderboardEntries(leaderboardSync.leaderboard.entries ?? []),
      } : null,
      _feedEnter: !!p._feedEnter,
      _feedEnterDone: !!p._feedEnterDone,
      _feedKey: p._feedKey ?? null,
      _feedRevealSeq: typeof p._feedRevealSeq === 'number' ? p._feedRevealSeq : 0,
    };
  }).filter(Boolean);
}

export default function PostsTab({
  profile,
  feedProfiles = null,
  deletedProfileIds = [],
  viewerProfile = null,
  aiFeaturesEnabled = true,
  feedContext = 'home',
  isGeneratingPosts = false,
  generatingPersona = null,
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
  const [homeVisibleCount, setHomeVisibleCount] = useState(HOME_FEED_PAGE_SIZE);
  const {
    viewerSlug,
    isHidden,
    isRevealing,
    isLeaderboardSelfHidden,
    isLeaderboardSelfRevealing,
  } = useLiveScoring();
  const [commentsByPostId, setCommentsByPostId] = useState({});
  const [placeholderMounted, setPlaceholderMounted] = useState(isGeneratingPosts);
  const [placeholderLeaving, setPlaceholderLeaving] = useState(false);
  const placeholderTimerRef = useRef(null);

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
    const sorted = all.sort(sortNewestFirst);
    // One feed post per leaderboard board (newest wins); reposts replace older ones server-side.
    return dedupeLeaderboardPostsNewestOnly(sorted);
  }, [feedContext, feedProfiles, personaBadgePersona, profile, deletedProfileIds]);

  useEffect(() => {
    if (feedContext !== 'home') return;
    setHomeVisibleCount(HOME_FEED_PAGE_SIZE);
  }, [feedContext, posts.length]);

  const displayedPosts = feedContext === 'home'
    ? posts.slice(0, homeVisibleCount)
    : posts;
  const homeHasMore = feedContext === 'home' && posts.length > homeVisibleCount;
  const homeRemaining = homeHasMore ? posts.length - homeVisibleCount : 0;

  const persistablePostIds = useMemo(
    () => posts.map((p) => p.id).filter((id) => isPersistablePostId(id)),
    [posts],
  );

  useEffect(() => {
    if (!isHostedApiOrigin() || persistablePostIds.length === 0) return undefined;
    let cancelled = false;

    const load = () => {
      fetchCommentsByPostIds(persistablePostIds)
        .then((next) => {
          if (!cancelled) setCommentsByPostId(next);
        })
        .catch((err) => {
          console.warn('[comments] fetch failed:', err?.message || err);
        });
    };

    load();
    const id = setInterval(load, 15_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [persistablePostIds.join('|')]);

  const handleCommentPosted = useCallback((saved) => {
    const postId = String(saved?.postId ?? '').trim();
    if (!postId) return;
    setCommentsByPostId((prev) => {
      const existing = Array.isArray(prev[postId]) ? prev[postId] : [];
      if (existing.some((row) => row?.id && row.id === saved.id)) return prev;
      return { ...prev, [postId]: [...existing, saved] };
    });
  }, []);

  // Use the next-to-reveal post's persona for the loading bar colour so it
  // "knows in advance" what's coming. Falls back to dominant persona while the
  // plan hasn't arrived yet (generatingPersona is null).
  const generatingAccent = personaUiColor(generatingPersona ?? resolveDominantPersonaKey(profile));

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
        (isGeneratingPosts || (placeholderMounted && !placeholderLeaving)) ? ' posts-tab--generating' : ''
      }`}
    >
      {placeholderMounted ? (
        <div
          className={`posts-generating-placeholder${
            placeholderLeaving ? ' posts-generating-placeholder--leaving' : ''
          }`}
          data-feed-reveal-target=""
          style={{
            '--persona-accent': generatingAccent,
            '--post-accent': generatingAccent,
          }}
          aria-busy={!placeholderLeaving}
          aria-label="Generating posts"
        >
          <div className="posts-generating-spinner" aria-hidden />
        </div>
      ) : null}
      {displayedPosts.map((p) => (
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
            realComments={commentsByPostId[p.id] ?? null}
            onCommentPosted={handleCommentPosted}
            isHidden={resolvePostHiddenState(p, {
              authorRecords: p._authorLiveScoringRecords,
              viewerSlug,
              viewerIsHidden: isHidden,
              viewerIsLeaderboardSelfHidden: isLeaderboardSelfHidden,
            })}
            isRevealing={resolvePostRevealingState(p, {
              authorRecords: p._authorLiveScoringRecords,
              viewerSlug,
              viewerIsRevealing: isRevealing,
              viewerIsLeaderboardSelfRevealing: isLeaderboardSelfRevealing,
              viewerIsLeaderboardSelfHidden: isLeaderboardSelfHidden,
            })}
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
      {homeHasMore ? (
        <button
          type="button"
          className="feed-see-more-btn"
          onClick={() => setHomeVisibleCount((n) => n + HOME_FEED_PAGE_SIZE)}
        >
          See more ({Math.min(homeRemaining, HOME_FEED_PAGE_SIZE)} of {homeRemaining} older posts)
        </button>
      ) : null}
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
