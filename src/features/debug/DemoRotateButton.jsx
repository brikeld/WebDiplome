import { useCallback, useEffect, useRef, useState } from 'react';
import { listDemoRotateTargets } from '@/lib/demoRotate.js';
import { runDemoSinglePostAndWait } from '@/lib/demoRotateApi.js';
import { profileSlugFromProfile } from '@/lib/aiJobClient.js';

export default function DemoRotateButton({ allProfiles, reloadProfileFromApi }) {
  const [running, setRunning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const runningRef = useRef(false);
  const indexRef = useRef(0);
  const loopRef = useRef(null);

  const stop = useCallback(() => {
    runningRef.current = false;
    setRunning(false);
    setBusy(false);
    if (loopRef.current) {
      clearTimeout(loopRef.current);
      loopRef.current = null;
    }
  }, []);

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
      loopRef.current = setTimeout(() => { runNext(); }, 500);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await runDemoSinglePostAndWait(slug, { pollMs: 2000, timeoutMs: 300000 });
      if (typeof reloadProfileFromApi === 'function') {
        await reloadProfileFromApi({ forcePostsMerge: true });
      }
    } catch (err) {
      console.warn('[demo-rotate]', err?.message || err);
      setError(err?.message || 'Demo rotate failed');
    } finally {
      setBusy(false);
      if (runningRef.current) {
        loopRef.current = setTimeout(() => { runNext(); }, 400);
      }
    }
  }, [allProfiles, reloadProfileFromApi, stop]);

  const toggle = useCallback(() => {
    if (runningRef.current) {
      stop();
      return;
    }
    runningRef.current = true;
    setRunning(true);
    setError(null);
    runNext();
  }, [runNext, stop]);

  useEffect(() => () => {
    runningRef.current = false;
    if (loopRef.current) clearTimeout(loopRef.current);
  }, []);

  const title = running
    ? (busy ? 'Demo rotate: generating…' : 'Demo rotate: waiting for next profile')
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
