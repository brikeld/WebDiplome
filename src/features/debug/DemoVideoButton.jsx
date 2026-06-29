import { useCallback, useEffect, useRef, useState } from 'react';
import { buildDemoVideoSchedule } from '@/lib/demoVideoFakeUsers.js';
import { runDemoVideoPipeline } from '@/lib/demoVideoFeed.js';

/**
 * Local "demo video" control — same start/stop UX as DemoRotateButton, but it
 * drives the fake-user pipeline (client-only, ephemeral) instead of hosted AI
 * jobs. Sits next to the demo-rotate dot in the brand cluster.
 */
export default function DemoVideoButton({
  generateApiOrigin,
  spectateController,
  ensureFakeUser,
  onActiveChange,
  onGeneratingPersona,
}) {
  const [running, setRunning] = useState(false);
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
    onActiveChange?.(false);
    onGeneratingPersona?.(null);
    pipelineRef.current = null;
  }, [onActiveChange, onGeneratingPersona]);

  const start = useCallback(async () => {
    if (!runningRef.current) return;
    setError(null);
    try {
      await runDemoVideoPipeline({
        schedule: buildDemoVideoSchedule(),
        generateApiOrigin,
        spectateController,
        ensureFakeUser,
        onGeneratingPersona,
        shouldContinue: () => runningRef.current,
      });
    } catch (err) {
      console.warn('[demo-video] pipeline exited:', err?.message || err);
      setError(err?.message || 'Demo video stopped');
    } finally {
      if (runningRef.current) stop();
    }
  }, [generateApiOrigin, spectateController, ensureFakeUser, onGeneratingPersona, stop]);

  const toggle = useCallback(() => {
    if (runningRef.current) {
      stop();
      return;
    }
    runningRef.current = true;
    setRunning(true);
    setError(null);
    onActiveChange?.(true);
    pipelineRef.current = start();
  }, [onActiveChange, start, stop]);

  useEffect(() => () => {
    runningRef.current = false;
    onActiveChangeRef.current?.(false);
    onGeneratingPersonaRef.current?.(null);
  }, []);

  const title = running
    ? 'Demo video: generating fake-user posts…'
    : 'Start demo video (fake users, one post at a time)';

  return (
    <button
      type="button"
      className={`demo-rotate-btn demo-video-btn${running ? ' demo-rotate-btn--active' : ''}`}
      onClick={toggle}
      aria-pressed={running}
      aria-label={title}
      title={error ? `${title} — ${error}` : title}
    >
      <span className="demo-video-btn__glyph" aria-hidden="true">▶</span>
    </button>
  );
}
