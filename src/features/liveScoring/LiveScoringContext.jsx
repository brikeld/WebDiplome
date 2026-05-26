// src/features/liveScoring/LiveScoringContext.jsx
import { createContext, useReducer, useEffect, useRef, useCallback, useMemo, useState } from 'react';
import { getPersonaScoresNormalized } from '@/lib/profileUtils.js';
import { normalizePostHideKey } from '@/lib/postHideKey.js';
import {
  computeLiveAdjustments,
  computeAdjustedScores,
  applyHide,
  applyReveal,
  applyCommentBoost,
  applyLeaderboardSelfHide,
  applyLeaderboardSelfReveal,
  isPostHidden,
  isLeaderboardSelfHidden,
  dominantPersonaFromAdjustedScores,
} from './scoringLogic.js';
import { syncScoreAdjustment } from './scoreSync.js';

export const LiveScoringContext = createContext(null);

const STORAGE_VERSION = 1;

function loadFromStorage(profileId) {
  try {
    const raw = localStorage.getItem(`live-scoring-${profileId}`);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed.version !== STORAGE_VERSION) return {};
    return parsed.records ?? {};
  } catch {
    return {};
  }
}

function saveToStorage(profileId, records) {
  try {
    localStorage.setItem(
      `live-scoring-${profileId}`,
      JSON.stringify({ version: STORAGE_VERSION, records }),
    );
  } catch {
    /* quota exceeded — ignore */
  }
}

function scoringReducer(state, action) {
  switch (action.type) {
    case 'HIDE': {
      const newRecords = applyHide(state.records, action.postKey, action.persona, action.systemDeltaPct);
      if (newRecords === state.records) return state; // no-op
      return { ...state, records: newRecords };
    }
    case 'REVEAL': {
      const newRecords = applyReveal(state.records, action.postKey);
      if (newRecords === state.records) return state; // no-op
      return { ...state, records: newRecords };
    }
    case 'COMMENT_BOOST': {
      const newRecords = applyCommentBoost(
        state.records,
        action.recordKey,
        action.persona,
        action.plusValue,
      );
      if (newRecords === state.records) return state;
      return { ...state, records: newRecords };
    }
    case 'HIDE_LEADERBOARD_SELF': {
      const newRecords = applyLeaderboardSelfHide(
        state.records,
        action.boardId,
        action.persona,
        action.systemDeltaPct,
      );
      if (newRecords === state.records) return state;
      return { ...state, records: newRecords };
    }
    case 'REVEAL_LEADERBOARD_SELF': {
      const newRecords = applyLeaderboardSelfReveal(state.records, action.boardId);
      if (newRecords === state.records) return state;
      return { ...state, records: newRecords };
    }
    case 'LOAD':
      return { ...state, records: action.records, loaded: true };
    default:
      return state;
  }
}

export function LiveScoringProvider({ profile, children }) {
  const profileId = useMemo(() => {
    if (!profile) return null;
    const first = String(profile.firstname ?? '').trim().toLowerCase();
    const last = String(profile.lastname ?? '').trim().toLowerCase();
    return first && last ? `${first}-${last}` : null;
  }, [profile?.firstname, profile?.lastname]);

  const [state, dispatch] = useReducer(scoringReducer, { records: {}, loaded: false });
  const [ringScores, setRingScores] = useState({ productivity: 0, security: 0, social: 0 });
  const [animatingRing, setAnimatingRing] = useState(/** @type {string | null} */ (null));
  const [optimisticHidden, setOptimisticHidden] = useState(() => new Set());
  const [revealingKeys, setRevealingKeys] = useState(() => new Set());
  const animationQueueRef = useRef([]);
  const animationListenersRef = useRef(new Set());
  const adjustedScoresRef = useRef(ringScores);

  // Load from localStorage when profileId changes
  useEffect(() => {
    if (!profileId) return;
    setOptimisticHidden(new Set());
    setRevealingKeys(new Set());
    const records = loadFromStorage(profileId);
    dispatch({ type: 'LOAD', records });
  }, [profileId]);

  // Persist to localStorage after first load
  useEffect(() => {
    if (!profileId || !state.loaded) return;
    saveToStorage(profileId, state.records);
  }, [profileId, state.records, state.loaded]);

  const baseScores = useMemo(
    () => getPersonaScoresNormalized(profile ?? {}),
    [profile?.personaScores, profile?.persona_scores, profile?.globalScore, profile?.score],
  );

  const liveAdjustments = useMemo(
    () => computeLiveAdjustments(state.records),
    [state.records],
  );

  const adjustedScores = useMemo(
    () => computeAdjustedScores(baseScores, liveAdjustments),
    [baseScores, liveAdjustments],
  );

  const dominantPersona = useMemo(
    () => dominantPersonaFromAdjustedScores(adjustedScores),
    [adjustedScores],
  );

  adjustedScoresRef.current = adjustedScores;

  // Dashboard rings lag records until the particle animation commits the score.
  useEffect(() => {
    if (!state.loaded || animatingRing != null) return;
    setRingScores(adjustedScores);
  }, [adjustedScores, state.loaded, animatingRing]);

  const beginRingAnimation = useCallback((ringKey) => {
    setAnimatingRing(ringKey);
  }, []);

  const finishRingAnimation = useCallback((scores) => {
    setRingScores(scores);
    setAnimatingRing(null);
  }, []);

  // Sync to server + Electron when adjustedScores change (after first load)
  useEffect(() => {
    if (!profileId || !state.loaded) return;
    syncScoreAdjustment(profileId, adjustedScores, baseScores);
  }, [profileId, state.loaded, adjustedScores.productivity, adjustedScores.security, adjustedScores.social]);

  const pushAnimationEvent = useCallback((event) => {
    animationQueueRef.current = [...animationQueueRef.current, event];
    for (const listener of animationListenersRef.current) {
      listener([...animationQueueRef.current]);
    }
  }, []);

  const dequeueAnimation = useCallback((id) => {
    animationQueueRef.current = animationQueueRef.current.filter((e) => e.id !== id);
    for (const listener of animationListenersRef.current) {
      listener([...animationQueueRef.current]);
    }
  }, []);

  const subscribeAnimations = useCallback((fn) => {
    animationListenersRef.current.add(fn);
    return () => animationListenersRef.current.delete(fn);
  }, []);

  const hidePost = useCallback(
    (post, sourcePillRect) => {
      const postKey = normalizePostHideKey(post.createdAt);
      if (!postKey || isPostHidden(state.records, postKey)) return;
      setOptimisticHidden((prev) => new Set(prev).add(postKey));
      pushAnimationEvent({
        id: typeof crypto !== 'undefined' ? crypto.randomUUID() : `anim-${Date.now()}`,
        type: 'hide',
        persona: String(post.persona ?? '').toLowerCase(),
        sourcePillRect,
        onCommit: () => {
          dispatch({
            type: 'HIDE',
            postKey,
            persona: post.persona,
            systemDeltaPct: post.systemDeltaPct ?? 1,
          });
          setOptimisticHidden((prev) => {
            const next = new Set(prev);
            next.delete(postKey);
            return next;
          });
        },
      });
    },
    [state.records, pushAnimationEvent],
  );

  const boostFromComment = useCallback(
    (post, persona, plusValue, sourcePillRect, sessionId) => {
      const postId = String(post?.id ?? '').trim();
      if (!postId) return;
      const delta = Math.abs(Number(plusValue) || 0);
      if (delta === 0) return;

      const recordKey =
        sessionId != null && sessionId !== ''
          ? `comment-${postId}-${sessionId}`
          : `comment-${postId}`;

      pushAnimationEvent({
        id: typeof crypto !== 'undefined' ? crypto.randomUUID() : `anim-${Date.now()}`,
        type: 'boost',
        persona: String(persona ?? '').toLowerCase(),
        sourcePillRect,
        onCommit: () => {
          dispatch({
            type: 'COMMENT_BOOST',
            recordKey,
            persona,
            plusValue: delta,
          });
        },
      });
    },
    [pushAnimationEvent],
  );

  const revealPost = useCallback(
    (post, sourcePillRect) => {
      const postKey = normalizePostHideKey(post.createdAt);
      if (!postKey || !isPostHidden(state.records, postKey)) return;
      setRevealingKeys((prev) => new Set(prev).add(postKey));
      pushAnimationEvent({
        id: typeof crypto !== 'undefined' ? crypto.randomUUID() : `anim-${Date.now()}`,
        type: 'reveal',
        persona: String(post.persona ?? '').toLowerCase(),
        sourcePillRect,
        onCommit: () => {
          dispatch({ type: 'REVEAL', postKey });
          setRevealingKeys((prev) => {
            const next = new Set(prev);
            next.delete(postKey);
            return next;
          });
        },
      });
    },
    [state.records, pushAnimationEvent],
  );

  const hideLeaderboardSelf = useCallback(
    (post, sourcePillRect) => {
      const boardId = post?.leaderboard?.boardId;
      if (!boardId || isLeaderboardSelfHidden(state.records, boardId)) return;
      pushAnimationEvent({
        id: typeof crypto !== 'undefined' ? crypto.randomUUID() : `anim-${Date.now()}`,
        type: 'hide',
        persona: String(post.leaderboard.persona ?? post.persona ?? '').toLowerCase(),
        sourcePillRect,
        onCommit: () => {
          dispatch({
            type: 'HIDE_LEADERBOARD_SELF',
            boardId,
            persona: post.leaderboard.persona ?? post.persona,
            systemDeltaPct: post.systemDeltaPct ?? 1,
          });
        },
      });
    },
    [state.records, pushAnimationEvent],
  );

  const revealLeaderboardSelf = useCallback(
    (post, sourcePillRect) => {
      const boardId = post?.leaderboard?.boardId;
      if (!boardId || !isLeaderboardSelfHidden(state.records, boardId)) return;
      pushAnimationEvent({
        id: typeof crypto !== 'undefined' ? crypto.randomUUID() : `anim-${Date.now()}`,
        type: 'reveal',
        persona: String(post.leaderboard.persona ?? post.persona ?? '').toLowerCase(),
        sourcePillRect,
        onCommit: () => {
          dispatch({ type: 'REVEAL_LEADERBOARD_SELF', boardId });
        },
      });
    },
    [state.records, pushAnimationEvent],
  );

  const isLeaderboardSelfHiddenForBoard = useCallback(
    (boardId) => isLeaderboardSelfHidden(state.records, boardId),
    [state.records],
  );

  const isHidden = useCallback(
    (postKey) => {
      const key = String(postKey);
      if (revealingKeys.has(key)) return false;
      return isPostHidden(state.records, key) || optimisticHidden.has(key);
    },
    [state.records, optimisticHidden, revealingKeys],
  );

  const value = useMemo(
    () => ({
      adjustedScores,
      adjustedScoresRef,
      ringScores,
      animatingRing,
      dominantPersona,
      hidePost,
      revealPost,
      hideLeaderboardSelf,
      revealLeaderboardSelf,
      isLeaderboardSelfHidden: isLeaderboardSelfHiddenForBoard,
      boostFromComment,
      isHidden,
      subscribeAnimations,
      dequeueAnimation,
      beginRingAnimation,
      finishRingAnimation,
    }),
    [
      adjustedScores,
      ringScores,
      animatingRing,
      dominantPersona,
      hidePost,
      revealPost,
      hideLeaderboardSelf,
      revealLeaderboardSelf,
      isLeaderboardSelfHiddenForBoard,
      boostFromComment,
      isHidden,
      subscribeAnimations,
      dequeueAnimation,
      beginRingAnimation,
      finishRingAnimation,
    ],
  );

  return <LiveScoringContext.Provider value={value}>{children}</LiveScoringContext.Provider>;
}
