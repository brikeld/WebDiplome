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
  leaderboardSelfKey,
  dominantPersonaFromAdjustedScores,
} from './scoringLogic.js';
import { isHostedApiOrigin, profileSlugFromProfile } from '@/lib/aiJobClient.js';
import { syncLiveScoringRecords, syncScoreAdjustment } from './scoreSync.js';

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
  const [optimisticLeaderboardRowHidden, setOptimisticLeaderboardRowHidden] = useState(() => new Set());
  const [optimisticLeaderboardHidden, setOptimisticLeaderboardHidden] = useState(() => new Set());
  const [optimisticLeaderboardRevealing, setOptimisticLeaderboardRevealing] = useState(() => new Set());
  const [optimisticLeaderboardRowRevealing, setOptimisticLeaderboardRowRevealing] = useState(() => new Set());
  const [revealPendingLeaderboardPostHidden, setRevealPendingLeaderboardPostHidden] = useState(() => new Set());
  const [revealPendingHidden, setRevealPendingHidden] = useState(() => new Set());
  const [revealingKeys, setRevealingKeys] = useState(() => new Set());
  const animationQueueRef = useRef([]);
  const animationListenersRef = useRef(new Set());
  const adjustedScoresRef = useRef(ringScores);
  const leaderboardFullHideTimersRef = useRef(new Map());
  const leaderboardFullRevealTimersRef = useRef(new Map());

  // Load from localStorage when profileId changes
  useEffect(() => {
    if (!profileId) return;
    setOptimisticHidden(new Set());
    setOptimisticLeaderboardRowHidden(new Set());
    setOptimisticLeaderboardHidden(new Set());
    setOptimisticLeaderboardRevealing(new Set());
    setOptimisticLeaderboardRowRevealing(new Set());
    setRevealPendingLeaderboardPostHidden(new Set());
    setRevealPendingHidden(new Set());
    setRevealingKeys(new Set());
    for (const timer of leaderboardFullHideTimersRef.current.values()) clearTimeout(timer);
    leaderboardFullHideTimersRef.current.clear();
    for (const timer of leaderboardFullRevealTimersRef.current.values()) clearTimeout(timer);
    leaderboardFullRevealTimersRef.current.clear();
    let records = loadFromStorage(profileId);
    if (isHostedApiOrigin() && profile?.liveScoringRecords && typeof profile.liveScoringRecords === 'object') {
      records = { ...records, ...profile.liveScoringRecords };
    }
    dispatch({ type: 'LOAD', records });
  }, [profileId, profile?.liveScoringRecords]);

  useEffect(
    () => () => {
      for (const timer of leaderboardFullHideTimersRef.current.values()) clearTimeout(timer);
      leaderboardFullHideTimersRef.current.clear();
      for (const timer of leaderboardFullRevealTimersRef.current.values()) clearTimeout(timer);
      leaderboardFullRevealTimersRef.current.clear();
    },
    [],
  );

  const hostedProfileSlug = useMemo(
    () => (isHostedApiOrigin() ? profileSlugFromProfile(profile) : null),
    [profile],
  );

  // Persist to localStorage after first load
  useEffect(() => {
    if (!profileId || !state.loaded) return;
    saveToStorage(profileId, state.records);
  }, [profileId, state.records, state.loaded]);

  // Sync hide/comment records to hosted API so other users see the same state
  useEffect(() => {
    if (!state.loaded || !hostedProfileSlug) return;
    syncLiveScoringRecords(hostedProfileSlug, state.records);
  }, [hostedProfileSlug, state.loaded, state.records]);

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
    (post, sourcePillRect, options = {}) => {
      const postKey = normalizePostHideKey(post.createdAt);
      if (!postKey || isPostHidden(state.records, postKey)) return;
      pushAnimationEvent({
        id: typeof crypto !== 'undefined' ? crypto.randomUUID() : `anim-${Date.now()}`,
        type: 'hide',
        persona: String(post.persona ?? '').toLowerCase(),
        delta: Math.abs(Number(post.systemDeltaPct) || 1),
        sourcePillRect,
        waypointRect: options.waypointRect ?? null,
        onWaypoint: () => {
          setOptimisticHidden((prev) => new Set(prev).add(postKey));
        },
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
        delta,
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
      const restored = state.records[postKey]?.restorable ?? 0;
      setRevealPendingHidden((prev) => new Set(prev).add(postKey));
      setRevealingKeys((prev) => new Set(prev).add(postKey));
      pushAnimationEvent({
        id: typeof crypto !== 'undefined' ? crypto.randomUUID() : `anim-${Date.now()}`,
        type: 'reveal',
        persona: String(post.persona ?? '').toLowerCase(),
        delta: restored,
        sourcePillRect,
        onCommit: () => {
          dispatch({ type: 'REVEAL', postKey });
        },
        onAnimationComplete: () => {
          setRevealPendingHidden((prev) => {
            const next = new Set(prev);
            next.delete(postKey);
            return next;
          });
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
    (post, sourcePillRect, options = {}) => {
      const boardId = post?.leaderboard?.boardId;
      if (!boardId || isLeaderboardSelfHidden(state.records, boardId)) return;
      const fullHideDelayMs = Math.max(0, Number(options.fullHideDelayMs ?? 360) || 0);
      pushAnimationEvent({
        id: typeof crypto !== 'undefined' ? crypto.randomUUID() : `anim-${Date.now()}`,
        type: 'hide',
        variant: 'leaderboard-self',
        persona: String(post.leaderboard.persona ?? post.persona ?? '').toLowerCase(),
        delta: Math.abs(Number(post.systemDeltaPct) || 1),
        sourcePillRect,
        waypointRect: options.waypointRect ?? null,
        onWaypoint: () => {
          setOptimisticLeaderboardRowHidden((prev) => new Set(prev).add(boardId));
          const existingTimer = leaderboardFullHideTimersRef.current.get(boardId);
          if (existingTimer) clearTimeout(existingTimer);
          const timer = setTimeout(() => {
            leaderboardFullHideTimersRef.current.delete(boardId);
            setOptimisticLeaderboardHidden((prev) => new Set(prev).add(boardId));
          }, fullHideDelayMs);
          leaderboardFullHideTimersRef.current.set(boardId, timer);
        },
        onCommit: () => {
          const pendingTimer = leaderboardFullHideTimersRef.current.get(boardId);
          if (pendingTimer) {
            clearTimeout(pendingTimer);
            leaderboardFullHideTimersRef.current.delete(boardId);
          }
          dispatch({
            type: 'HIDE_LEADERBOARD_SELF',
            boardId,
            persona: post.leaderboard.persona ?? post.persona,
            systemDeltaPct: post.systemDeltaPct ?? 1,
          });
          setOptimisticLeaderboardHidden((prev) => {
            const next = new Set(prev);
            next.delete(boardId);
            return next;
          });
          setOptimisticLeaderboardRowHidden((prev) => {
            const next = new Set(prev);
            next.delete(boardId);
            return next;
          });
        },
      });
    },
    [state.records, pushAnimationEvent],
  );

  const revealLeaderboardSelf = useCallback(
    (post, sourcePillRect, options = {}) => {
      const boardId = post?.leaderboard?.boardId;
      if (!boardId || !isLeaderboardSelfHidden(state.records, boardId)) return;
      const restored = state.records[leaderboardSelfKey(boardId)]?.restorable ?? 0;
      const rowRevealDelayMs = Math.max(0, Number(options.rowRevealDelayMs ?? options.fullHideDelayMs ?? 360) || 0);

      setOptimisticLeaderboardRevealing((prev) => new Set(prev).add(boardId));
      setRevealPendingLeaderboardPostHidden((prev) => new Set(prev).add(boardId));
      setOptimisticLeaderboardRowHidden((prev) => new Set(prev).add(boardId));

      pushAnimationEvent({
        id: typeof crypto !== 'undefined' ? crypto.randomUUID() : `anim-${Date.now()}`,
        type: 'reveal',
        variant: 'leaderboard-self',
        persona: String(post.leaderboard.persona ?? post.persona ?? '').toLowerCase(),
        delta: restored,
        sourcePillRect,
        onCommit: () => {
          setRevealPendingLeaderboardPostHidden((prev) => {
            const next = new Set(prev);
            next.delete(boardId);
            return next;
          });
          dispatch({ type: 'REVEAL_LEADERBOARD_SELF', boardId });

          const existingTimer = leaderboardFullRevealTimersRef.current.get(boardId);
          if (existingTimer) clearTimeout(existingTimer);
          const timer = setTimeout(() => {
            leaderboardFullRevealTimersRef.current.delete(boardId);
            setOptimisticLeaderboardRowHidden((prev) => {
              const next = new Set(prev);
              next.delete(boardId);
              return next;
            });
            setOptimisticLeaderboardRowRevealing((prev) => new Set(prev).add(boardId));
          }, rowRevealDelayMs);
          leaderboardFullRevealTimersRef.current.set(boardId, timer);
        },
        onAnimationComplete: () => {
          const pendingTimer = leaderboardFullRevealTimersRef.current.get(boardId);
          if (pendingTimer) {
            clearTimeout(pendingTimer);
            leaderboardFullRevealTimersRef.current.delete(boardId);
            setOptimisticLeaderboardRowHidden((prev) => {
              const next = new Set(prev);
              next.delete(boardId);
              return next;
            });
            setOptimisticLeaderboardRowRevealing((prev) => {
              const next = new Set(prev);
              next.delete(boardId);
              return next;
            });
          }
          setOptimisticLeaderboardRevealing((prev) => {
            const next = new Set(prev);
            next.delete(boardId);
            return next;
          });
          setRevealPendingLeaderboardPostHidden((prev) => {
            const next = new Set(prev);
            next.delete(boardId);
            return next;
          });
        },
      });
    },
    [state.records, pushAnimationEvent],
  );

  const isLeaderboardSelfHiddenForBoard = useCallback(
    (boardId) =>
      revealPendingLeaderboardPostHidden.has(boardId) ||
      (
        !optimisticLeaderboardRevealing.has(boardId) &&
        (optimisticLeaderboardHidden.has(boardId) || isLeaderboardSelfHidden(state.records, boardId))
      ),
    [
      state.records,
      optimisticLeaderboardHidden,
      optimisticLeaderboardRevealing,
      revealPendingLeaderboardPostHidden,
    ],
  );

  const isLeaderboardSelfRowHiddenForBoard = useCallback(
    (boardId) =>
      optimisticLeaderboardRowHidden.has(boardId) ||
      optimisticLeaderboardHidden.has(boardId) ||
      (
        !optimisticLeaderboardRevealing.has(boardId) &&
        isLeaderboardSelfHidden(state.records, boardId)
      ),
    [
      state.records,
      optimisticLeaderboardRowHidden,
      optimisticLeaderboardHidden,
      optimisticLeaderboardRevealing,
    ],
  );

  const isLeaderboardSelfRevealingForBoard = useCallback(
    (boardId) => optimisticLeaderboardRevealing.has(boardId),
    [optimisticLeaderboardRevealing],
  );

  const isLeaderboardSelfRowRevealingForBoard = useCallback(
    (boardId) => optimisticLeaderboardRowRevealing.has(boardId),
    [optimisticLeaderboardRowRevealing],
  );

  const isHidden = useCallback(
    (postKey) => {
      const key = String(postKey);
      if (revealPendingHidden.has(key)) return true;
      if (revealingKeys.has(key)) return false;
      return isPostHidden(state.records, key) || optimisticHidden.has(key);
    },
    [state.records, optimisticHidden, revealingKeys, revealPendingHidden],
  );

  const isRevealing = useCallback(
    (postKey) => revealingKeys.has(String(postKey)),
    [revealingKeys],
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
      isLeaderboardSelfRowHidden: isLeaderboardSelfRowHiddenForBoard,
      isLeaderboardSelfRevealing: isLeaderboardSelfRevealingForBoard,
      isLeaderboardSelfRowRevealing: isLeaderboardSelfRowRevealingForBoard,
      boostFromComment,
      isHidden,
      isRevealing,
      scoresLoaded: state.loaded,
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
      isLeaderboardSelfRowHiddenForBoard,
      isLeaderboardSelfRevealingForBoard,
      isLeaderboardSelfRowRevealingForBoard,
      boostFromComment,
      isHidden,
      isRevealing,
      state.loaded,
      subscribeAnimations,
      dequeueAnimation,
      beginRingAnimation,
      finishRingAnimation,
    ],
  );

  return <LiveScoringContext.Provider value={value}>{children}</LiveScoringContext.Provider>;
}
