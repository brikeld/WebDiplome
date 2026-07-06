import { useCallback, useEffect, useRef, useState } from 'react';
import { buildDemoVideoSchedule } from '@/lib/demoVideoFakeUsers.js';
import { runDemoVideoPipeline } from '@/lib/demoVideoFeed.js';
import { isHostedApiOrigin } from '@/lib/aiJobClient.js';
import { mapScheduleToSeededUsers } from '@/lib/demoVideoLocal.js';

/**
 * Demo video control — same start/stop UX as DemoRotateButton, but it reveals
 * prewritten fake-user posts with no generation service dependency.
 */
export default function DemoVideoButton({
  spectateController,
  ensureFakeUser,
  getBaselinePosts,
  onPostGenerated,
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
    onGeneratingPersona?.(null);
    pipelineRef.current = null;
  }, [onGeneratingPersona]);

  const finish = useCallback(() => {
    runningRef.current = false;
    setRunning(false);
    onGeneratingPersona?.(null);
    pipelineRef.current = null;
  }, [onGeneratingPersona]);

  const start = useCallback(async () => {
    if (!runningRef.current) return;
    setError(null);
    try {
      const local = !isHostedApiOrigin();
      const schedule = local
        ? mapScheduleToSeededUsers(buildDemoVideoSchedule())
        : buildDemoVideoSchedule();
      await runDemoVideoPipeline({
        schedule,
        spectateController,
        ensureFakeUser,
        onPostGenerated,
        onGeneratingPersona,
        shouldContinue: () => runningRef.current,
        getBaselinePosts,
        materializeOptions: local
          ? { epochMs: Date.now(), runKey: Date.now().toString(36) }
          : undefined,
      });
    } catch (err) {
      console.warn('[demo-video] pipeline exited:', err?.message || err);
      setError(err?.message || 'Demo video stopped');
    } finally {
      if (runningRef.current) finish();
    }
  }, [spectateController, ensureFakeUser, getBaselinePosts, onPostGenerated, onGeneratingPersona, finish]);

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
    ? 'Demo video: posting fake-user updates...'
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
