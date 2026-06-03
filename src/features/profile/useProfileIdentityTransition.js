import { useEffect, useState } from 'react';

export const PROFILE_IDENTITY_EXIT_MS = 360;
export const PROFILE_IDENTITY_ENTER_MS = 560;

function getDurations() {
  if (typeof window === 'undefined') {
    return { exitMs: PROFILE_IDENTITY_EXIT_MS, enterMs: PROFILE_IDENTITY_ENTER_MS };
  }
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return { exitMs: 0, enterMs: 0 };
  }
  return { exitMs: PROFILE_IDENTITY_EXIT_MS, enterMs: PROFILE_IDENTITY_ENTER_MS };
}

function profileIdentityKey(profile) {
  if (!profile) return '';
  return String(profile.slug ?? profile.id ?? '').trim();
}

/**
 * Crossfades profile chrome when the viewed identity changes (or on first mount).
 * @returns {{ displayProfile: object|null, phase: 'visible' | 'exit' | 'enter' }}
 */
export function useProfileIdentityTransition(profile) {
  const [displayProfile, setDisplayProfile] = useState(profile);
  const [phase, setPhase] = useState('enter');

  useEffect(() => {
    const nextKey = profileIdentityKey(profile);
    const currentKey = profileIdentityKey(displayProfile);

    if (nextKey === currentKey) {
      if (profile !== displayProfile) setDisplayProfile(profile);
      return undefined;
    }

    const { exitMs } = getDurations();
    setPhase('exit');

    const exitTimer = setTimeout(() => {
      setDisplayProfile(profile);
      setPhase('enter');
    }, exitMs);

    return () => clearTimeout(exitTimer);
  }, [profile, displayProfile]);

  useEffect(() => {
    if (phase !== 'enter') return undefined;

    const { enterMs } = getDurations();
    const enterTimer = setTimeout(() => setPhase('visible'), enterMs);
    return () => clearTimeout(enterTimer);
  }, [phase, displayProfile]);

  return { displayProfile, phase };
}
