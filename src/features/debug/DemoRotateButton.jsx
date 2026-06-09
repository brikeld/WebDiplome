import { useCallback, useEffect, useRef, useState } from 'react';
import { listDemoRotateTargets } from '@/lib/demoRotate.js';
import { runDemoRotateRound } from '@/lib/demoRotateFeed.js';
import { profileSlugFromProfile } from '@/lib/aiJobClient.js';

export default function DemoRotateButton({
  allProfiles,
  reloadProfileFromApi,
  spectateController,
  onActiveChange,
  onGeneratingPersona,
}) {
  const [running, setRunning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const runningRef = useRef(false);
  const cycleRef = useRef(null);

  const stop = useCallback(() => {
    runningRef.current = false;
    setRunning(false);
    setBusy(false);
    onActiveChange?.(false);
    onGeneratingPersona?.(null);
    if (cycleRef.current) {
      cycleRef.current = null;
    }
  }, [onActiveChange, onGeneratingPersona]);

  const runRound = useCallback(async () => {
    if (!runningRef.current) return;

    const targets = listDemoRotateTargets(allProfiles);
    if (targets.length === 0) {
      setError('No demo profiles available');
      stop();
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await runDemoRotateRound({
        targets: targets.map((profile) => ({
          slug: profileSlugFromProfile(profile),
        })),
        reloadProfileFromApi,
        spectateController,
        onGeneratingPersona,
      });
    } catch (err) {
      console.warn('[demo-rotate]', err?.message || err);
      setError(err?.message || 'Demo rotate failed');
      stop();
      return;
    } finally {
      setBusy(false);
    }

    if (runningRef.current) {
      cycleRef.current = runRound();
    }
  }, [allProfiles, reloadProfileFromApi, spectateController, onGeneratingPersona, stop]);

  const toggle = useCallback(() => {
    if (runningRef.current) {
      stop();
      return;
    }
    runningRef.current = true;
    setRunning(true);
    setError(null);
    onActiveChange?.(true);
    cycleRef.current = runRound();
  }, [onActiveChange, runRound, stop]);

  useEffect(() => () => {
    runningRef.current = false;
    onActiveChange?.(false);
    onGeneratingPersona?.(null);
  }, [onActiveChange, onGeneratingPersona]);

  const title = running
    ? (busy ? 'Demo rotate: generating posts for all demo profiles…' : 'Demo rotate: active')
    : 'Start demo rotate (one post per profile, all queued together)';

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
