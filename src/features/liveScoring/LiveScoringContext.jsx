// src/features/liveScoring/LiveScoringContext.jsx
import { createContext, useReducer, useEffect, useRef, useCallback, useMemo } from 'react';
import { getPersonaScoresNormalized } from '@/lib/profileUtils.js';
import { normalizePostHideKey } from '@/lib/postHideKey.js';
import {
  computeLiveAdjustments,
  computeAdjustedScores,
  applyHide,
  applyReveal,
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
  const animationQueueRef = useRef([]);
  const animationListenersRef = useRef(new Set());

  // Load from localStorage when profileId changes
  useEffect(() => {
    if (!profileId) return;
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
      if (!postKey) return;
      dispatch({ type: 'HIDE', postKey, persona: post.persona, systemDeltaPct: post.systemDeltaPct ?? 1 });
      pushAnimationEvent({
        id: typeof crypto !== 'undefined' ? crypto.randomUUID() : `anim-${Date.now()}`,
        type: 'hide',
        persona: String(post.persona ?? '').toLowerCase(),
        delta: -(post.systemDeltaPct ?? 1),
        sourcePillRect,
      });
    },
    [pushAnimationEvent],
  );

  const revealPost = useCallback(
    (post, sourcePillRect) => {
      const postKey = normalizePostHideKey(post.createdAt);
      if (!postKey) return;
      dispatch({ type: 'REVEAL', postKey });
      pushAnimationEvent({
        id: typeof crypto !== 'undefined' ? crypto.randomUUID() : `anim-${Date.now()}`,
        type: 'reveal',
        persona: String(post.persona ?? '').toLowerCase(),
        delta: +(post.systemDeltaPct ?? 1) * 0.5,
        sourcePillRect,
      });
    },
    [pushAnimationEvent],
  );

  const isHidden = useCallback(
    (postKey) => !!state.records[String(postKey)],
    [state.records],
  );

  const value = useMemo(
    () => ({
      adjustedScores,
      dominantPersona,
      hidePost,
      revealPost,
      isHidden,
      subscribeAnimations,
      dequeueAnimation,
    }),
    [adjustedScores, dominantPersona, hidePost, revealPost, isHidden, subscribeAnimations, dequeueAnimation],
  );

  return <LiveScoringContext.Provider value={value}>{children}</LiveScoringContext.Provider>;
}
