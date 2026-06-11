import { useState, useEffect, useRef, useCallback } from 'react';

export const TELL_ME_MORE_LOADING_MS = 2500;
export const TELL_ME_MORE_LEADERBOARD_LOADING_MS = 3200;

/**
 * Brief skeleton phase when Tell-Me-More opens or its source post changes.
 * `resetDeps` should list values that should re-trigger the loader (e.g. post id).
 */
export function useTellMeMoreLoading(
  resetDeps = [],
  { blocked = false, durationMs = TELL_ME_MORE_LOADING_MS } = {},
) {
  const [loadingKey, setLoadingKey] = useState(0);
  const [ready, setReady] = useState(false);
  const timerRef = useRef(null);

  const triggerLoad = useCallback(() => {
    setReady(false);
    setLoadingKey((k) => k + 1);
    clearTimeout(timerRef.current);
    if (blocked) return;
    timerRef.current = setTimeout(() => setReady(true), durationMs);
  }, [blocked, durationMs]);

  useEffect(() => {
    triggerLoad();
    return () => clearTimeout(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...resetDeps, blocked]);

  return { ready, loadingKey, triggerLoad };
}
