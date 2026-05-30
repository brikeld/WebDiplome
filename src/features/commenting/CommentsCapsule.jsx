import '@/styles/commenting.css';
import { useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Comment from './Comment.jsx';
import SuggestionRow from './SuggestionRow.jsx';
import {
  commentMetaCenterLine,
  mockCommentTimeAgo,
} from '@/lib/commentMetaStrip.js';
import { getMockCommentsFor } from './commentingMock.js';
import { fetchCommentSuggestions } from './fetchCommentSuggestions.js';
import { LiveScoringContext } from '@/features/liveScoring/LiveScoringContext.jsx';
import { getAllowedCommentPersonas } from '@/lib/personaScoreCompliance.js';
import {
  loadCommentPick,
  migrateLegacyCommentPick,
  saveCommentPick,
} from '@/lib/commentPickStorage.js';
import { profileSlugFromProfile } from '@/lib/aiJobClient.js';

export default function CommentsCapsule({
  post,
  isOpen,
  capsuleId,
  displayName,
  handle,
  avatarSrc,
  avatarInitials,
  personaBadgePersona,
  commenterDisplayName,
  commenterHandle,
  commenterAvatarSrc,
  commenterAvatarInitials,
  commenterPersonaBadgePersona,
  commenterProfile = null,
  aiSuggestionsEnabled = true,
  onToggle,
  timeLabel,
  systemNoteLabel,
  onOpenProfile,
  realComments,
}) {
  const [picked, setPicked] = useState(() => {
    const slug = profileSlugFromProfile(commenterProfile);
    return loadCommentPick(slug, post.id) ?? migrateLegacyCommentPick(slug, post.id);
  });
  const [originRect, setOriginRect] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsError, setSuggestionsError] = useState(null);
  const rootRef = useRef(null);
  const userCommentRef = useRef(null);
  const fetchGenRef = useRef(0);
  const commentBoostSessionRef = useRef(0);
  const commentBoostAppliedRef = useRef(false);
  const liveScoring = useContext(LiveScoringContext);
  const viewerSlug = profileSlugFromProfile(commenterProfile);
  const allowedCommentPersonas = useMemo(
    () => getAllowedCommentPersonas(liveScoring?.adjustedScores ?? {}),
    [liveScoring?.adjustedScores],
  );
  const commentsRestricted = allowedCommentPersonas.length < 3;
  const restrictionsKey = commentsRestricted
    ? allowedCommentPersonas.join(',')
    : 'all';

  useEffect(() => {
    setPicked(
      loadCommentPick(viewerSlug, post.id) ?? migrateLegacyCommentPick(viewerSlug, post.id),
    );
  }, [post.id, viewerSlug]);

  useEffect(() => {
    if (!isOpen) {
      setOriginRect(null);
      commentBoostAppliedRef.current = false;
      return;
    }
    commentBoostSessionRef.current += 1;
    commentBoostAppliedRef.current = false;
  }, [isOpen, post.id]);

  useEffect(() => {
    if (!isOpen) return;
    setSuggestions([]);
    setSuggestionsError(null);
  }, [isOpen, restrictionsKey, post.id]);

  useEffect(() => {
    if (!isOpen || picked || !aiSuggestionsEnabled) return undefined;

    const gen = fetchGenRef.current + 1;
    fetchGenRef.current = gen;
    setSuggestionsLoading(true);

    fetchCommentSuggestions(post, {
      allowedPersonas: commentsRestricted ? allowedCommentPersonas : undefined,
      viewerProfile: commenterProfile,
    })
      .then((rows) => {
        if (fetchGenRef.current !== gen) return;
        setSuggestions(Array.isArray(rows) ? rows : []);
        setSuggestionsLoading(false);
      })
      .catch((err) => {
        if (fetchGenRef.current !== gen) return;
        setSuggestionsError(err?.message || 'Could not load comment options');
        setSuggestionsLoading(false);
      });

    return () => {
      fetchGenRef.current += 1;
    };
  }, [isOpen, post.id, post.content, picked, commentsRestricted, restrictionsKey, commenterProfile, aiSuggestionsEnabled, viewerSlug]);

  // Set max-height to measured scroll height when open
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    if (isOpen) {
      el.style.maxHeight = 'none';
      const natural = el.scrollHeight;
      el.style.maxHeight = `${natural}px`;
      const releaseHandle = setTimeout(() => {
        if (rootRef.current && isOpen) rootRef.current.style.maxHeight = 'none';
      }, 320);
      return () => clearTimeout(releaseHandle);
    }
    if (el.style.maxHeight === 'none' || el.style.maxHeight === '') {
      el.style.maxHeight = `${el.scrollHeight}px`;
      requestAnimationFrame(() => {
        if (rootRef.current && !isOpen) rootRef.current.style.maxHeight = '0px';
      });
    } else {
      el.style.maxHeight = '0px';
    }
  }, [isOpen, picked, suggestionsLoading, suggestions.length, suggestionsError]);

  useLayoutEffect(() => {
    const node = userCommentRef.current;
    if (!node || !originRect) return;

    const targetRect = node.getBoundingClientRect();
    const dx = originRect.left - targetRect.left;
    const dy = originRect.top - targetRect.top;
    const sx = targetRect.width === 0 ? 1 : originRect.width / targetRect.width;
    const sy = targetRect.height === 0 ? 1 : originRect.height / targetRect.height;

    node.style.transformOrigin = 'top left';
    node.style.transform = `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`;
    node.style.transition = 'none';
    node.style.opacity = '1';
    node.style.willChange = 'transform';

    void node.offsetWidth;
    node.style.transition = `transform var(--commenting-duration) var(--commenting-ease)`;
    node.style.transform = 'translate(0, 0) scale(1, 1)';

    const cleanup = () => {
      node.style.willChange = '';
      node.style.transition = '';
    };
    node.addEventListener('transitionend', cleanup, { once: true });
    return () => node.removeEventListener('transitionend', cleanup);
  }, [originRect]);

  const handlePick = (s) => {
    if (commentBoostAppliedRef.current) return;

    const root = rootRef.current;
    let sourcePillRect = null;
    if (root) {
      const card = root.querySelector(
        `[data-suggestion-card="${s.slotKey ?? s.persona}"]`,
      );
      if (card) {
        setOriginRect(card.getBoundingClientRect());
        const plusEl = card.querySelector('.commenting-suggestion-option-plus');
        sourcePillRect = (plusEl ?? card).getBoundingClientRect();
      }
    }

    const plusValue = Number(s.plusValue) || 0;
    if (plusValue > 0 && liveScoring?.boostFromComment) {
      commentBoostAppliedRef.current = true;
      liveScoring.boostFromComment(
        post,
        s.persona,
        plusValue,
        sourcePillRect,
        commentBoostSessionRef.current,
      );
    }

    setPicked(s);
    saveCommentPick(viewerSlug, post.id, s);
  };

  // Prefer real public comments from the hosted API; fall back to demo comments.
  const comments = Array.isArray(realComments) && realComments.length > 0
    ? realComments
    : getMockCommentsFor(post.id).comments;

  return (
    <div
      ref={rootRef}
      id={capsuleId}
      className={`commenting-capsule${isOpen ? ' commenting-capsule--open' : ''}`}
      data-post-id={post.id}
      data-persona={post.persona}
      aria-hidden={!isOpen}
      inert={!isOpen ? '' : undefined}
      style={{
        '--post-accent': post.noteColor,
        '--persona-accent': post.noteColor,
      }}
    >
      <div className="commenting-thread">
        {isOpen ? <h3 className="commenting-thread-title">Comments</h3> : null}
        <div className="commenting-thread-comments-row">
          {isOpen ? (
            <div className="commenting-thread-spine" aria-hidden>
              <div className="commenting-thread-line" />
            </div>
          ) : null}
          <div className="commenting-thread-comments">
            <div className="commenting-thread-stack">
              {comments.map((c, i) => (
              <Comment
                key={c.persona}
                persona={c.persona}
                content={c.content}
                metaLeft={mockCommentTimeAgo(post.id, c.persona, i)}
                metaCenter={commentMetaCenterLine(post.id, c.persona)}
                displayName={commenterDisplayName}
                handle={commenterHandle}
                avatarSrc={commenterAvatarSrc}
                avatarInitials={commenterAvatarInitials}
                personaBadgePersona={commenterPersonaBadgePersona}
                onOpenProfile={onOpenProfile}
                staggerIndex={i}
              />
              ))}
            </div>
          </div>
        </div>

        <div className="commenting-thread-replies">
          {picked ? null : (
            <button type="button" className="commenting-write-own">
              Write your own reply
            </button>
          )}

          <SuggestionRow
            suggestions={suggestions}
            suggestionsLoading={suggestionsLoading}
            suggestionsError={suggestionsError}
            allowedPersonas={allowedCommentPersonas}
            commentsRestricted={commentsRestricted}
            avatarSrc={avatarSrc}
            avatarInitials={avatarInitials}
            personaBadgePersona={personaBadgePersona}
            picked={picked}
            userCommentRef={userCommentRef}
            postId={post.id}
            displayName={displayName}
            onPick={handlePick}
            onOpenProfile={onOpenProfile}
          />
        </div>
      </div>
    </div>
  );
}
