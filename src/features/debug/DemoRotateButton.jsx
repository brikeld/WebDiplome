import { useCallback, useEffect, useRef, useState } from 'react';
import { listDemoRotateTargets } from '@/lib/demoRotate.js';
import { runDemoRotatePipeline } from '@/lib/demoRotateFeed.js';
import { displayNameFromProfile } from '@/lib/profileUtils.js';
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
  const pipelineRef = useRef(null);
  const onActiveChangeRef = useRef(onActiveChange);
  const onGeneratingPersonaRef = useRef(onGeneratingPersona);

  useEffect(() => {
    onActiveChangeRef.current = onActiveChange;
    onGeneratingPersonaRef.current = onGeneratingPersona;
  }, [onActiveChange, onGeneratingPersona]);

  const stop = useCallback(() => {
    runningRef.current = false;
    setRunning(false);
    setBusy(false);
    onActiveChange?.(false);
    onGeneratingPersona?.(null);
    pipelineRef.current = null;
  }, [onActiveChange, onGeneratingPersona]);

  const startPipeline = useCallback(async () => {
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
      await runDemoRotatePipeline({
        targets: targets.map((profile) => ({
          slug: profileSlugFromProfile(profile),
          displayName: displayNameFromProfile(profile),
        })),
        reloadProfileFromApi,
        spectateController,
        onGeneratingPersona,
        shouldContinue: () => runningRef.current,
      });
    } catch (err) {
      console.warn('[demo-rotate] pipeline exited:', err?.message || err);
      setError(err?.message || 'Demo rotate stopped');
    } finally {
      setBusy(false);
    }
  }, [allProfiles, reloadProfileFromApi, spectateController, onGeneratingPersona, stop, onActiveChange]);

  const toggle = useCallback(() => {
    if (runningRef.current) {
      stop();
      return;
    }
    runningRef.current = true;
    setRunning(true);
    setError(null);
    onActiveChange?.(true);
    pipelineRef.current = startPipeline();
  }, [onActiveChange, startPipeline, stop]);

  useEffect(() => () => {
    runningRef.current = false;
    onActiveChangeRef.current?.(false);
    onGeneratingPersonaRef.current?.(null);
  }, []);

  const title = running
    ? (busy
      ? 'Demo rotate: one post per user, round-robin…'
      : 'Demo rotate: active')
    : 'Start demo rotate (each demo user, one post at a time)';

  return (
    <button
      type="button"
      className={`demo-rotate-btn${running ? ' demo-rotate-btn--active' : ''}`}
      onClick={toggle}
      aria-pressed={running}
      aria-label={title}
      title={error ? `${title} — ${error}` : title}
    >
      <span className="demo-rotate-btn__dot" aria-hidden="true" />
    </button>
  );
}
