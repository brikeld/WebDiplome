import { useCallback, useEffect, useRef, useState } from 'react';
import { listDemoRotateTargets } from '@/lib/demoRotate.js';
import { runDemoRotateSinglePost } from '@/lib/demoRotateFeed.js';
import { profileSlugFromProfile } from '@/lib/aiJobClient.js';

export default function DemoRotateButton({
  allProfiles,
  reloadProfileFromApi,
  spectateController,
  onActiveChange,
}) {
  const [running, setRunning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const runningRef = useRef(false);
  const indexRef = useRef(0);
  const cycleRef = useRef(null);

  const stop = useCallback(() => {
    runningRef.current = false;
    setRunning(false);
    setBusy(false);
    onActiveChange?.(false);
    if (cycleRef.current) {
      cycleRef.current = null;
    }
  }, [onActiveChange]);

  const runNext = useCallback(async () => {
    if (!runningRef.current) return;

    const targets = listDemoRotateTargets(allProfiles);
    if (targets.length === 0) {
      setError('No demo profiles available');
      stop();
      return;
    }

    const target = targets[indexRef.current % targets.length];
    indexRef.current += 1;
    const slug = profileSlugFromProfile(target);
    if (!slug) {
      cycleRef.current = runNext();
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await runDemoRotateSinglePost({
        profileSlug: slug,
        reloadProfileFromApi,
        spectateController,
      });
    } catch (err) {
      console.warn('[demo-rotate]', err?.message || err);
      setError(err?.message || 'Demo rotate failed');
    } finally {
      setBusy(false);
      if (runningRef.current) {
        cycleRef.current = runNext();
      }
    }
  }, [allProfiles, reloadProfileFromApi, spectateController, stop]);

  const toggle = useCallback(() => {
    if (runningRef.current) {
      stop();
      return;
    }
    runningRef.current = true;
    setRunning(true);
    setError(null);
    onActiveChange?.(true);
    cycleRef.current = runNext();
  }, [onActiveChange, runNext, stop]);

  useEffect(() => () => {
    runningRef.current = false;
    onActiveChange?.(false);
  }, [onActiveChange]);

  const title = running
    ? (busy ? 'Demo rotate: generating one post…' : 'Demo rotate: active')
    : 'Start demo rotate (1 post per profile, round-robin)';

  return (
    <button
      type="button"
      className={`demo-rotate-btn${running ? ' demo-rotate-btn--active' : ''}${busy ? ' demo-rotate-btn--busy' : ''}`}
      onClick={toggle}
      aria-pressed={running}
      aria-label={title}
      title={error ? `${title} — ${error}` : title}
    >
      <span className="demo-rotate-btn__dot" aria-hidden="true" />
    </button>
  );
}
