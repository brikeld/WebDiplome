// src/features/liveScoring/LiveScoringContext.jsx
import { createContext, useReducer, useEffect, useRef, useCallback, useMemo, useState } from 'react';
import { getPersonaScoresNormalized } from '@/lib/profileUtils.js';
import { normalizePostHideKey } from '@/lib/postHideKey.js';
import {
  computeLiveAdjustments,
  computeAdjustedScores,
  applyHide,
  applyReveal,
  isPostHidden,
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
      isHidden,
      subscribeAnimations,
      dequeueAnimation,
      beginRingAnimation,
      finishRingAnimation,
    ],
  );

  return <LiveScoringContext.Provider value={value}>{children}</LiveScoringContext.Provider>;
}
