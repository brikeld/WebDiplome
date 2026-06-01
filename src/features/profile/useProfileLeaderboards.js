import { useEffect, useState } from 'react';
import { resolveApiOrigin } from '@/lib/apiOrigin.js';
import { readLinkedProfileSlug } from '@/lib/hostedAccount.js';

const API_ORIGIN = resolveApiOrigin();

export function profileViewerSlug(profile) {
  return profile?.slug ?? profile?.id ?? readLinkedProfileSlug() ?? '';
}

export function useProfileLeaderboards(profile) {
  const [leaderboards, setLeaderboards] = useState([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!profile) {
      setLeaderboards([]);
      setReady(false);
      return undefined;
    }

    const controller = new AbortController();
    const viewerSlug = profileViewerSlug(profile);
    const qs = viewerSlug ? `?viewerSlug=${encodeURIComponent(viewerSlug)}` : '';

    async function loadLeaderboards() {
      try {
        const res = await fetch(`${API_ORIGIN}/api/leaderboards${qs}`, {
          signal: controller.signal,
          cache: 'no-store',
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!controller.signal.aborted) {
          setLeaderboards(Array.isArray(json.leaderboards) ? json.leaderboards : []);
          setReady(true);
        }
      } catch (err) {
        if (err?.name !== 'AbortError') {
          setLeaderboards([]);
          setReady(true);
        }
      }
    }

    setReady(false);
    loadLeaderboards();
    const pollId = setInterval(loadLeaderboards, 30_000);
    return () => {
      controller.abort();
      clearInterval(pollId);
    };
  }, [profile]);

  return { leaderboards, ready };
}
