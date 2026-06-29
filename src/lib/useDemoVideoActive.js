import { useSyncExternalStore } from 'react';
import { isDemoVideoActive, subscribeDemoVideoActive } from '@/lib/demoVideoFakeUsers.js';

/**
 * Reactive read of the demo-video active flag. Components that splice fake users
 * into leaderboards subscribe through this so they re-render (and re-run the
 * splice) the instant the demo video is toggled on/off.
 */
export function useDemoVideoActive() {
  return useSyncExternalStore(subscribeDemoVideoActive, isDemoVideoActive, isDemoVideoActive);
}
