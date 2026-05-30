import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useLiveScoring } from '@/features/liveScoring/useLiveScoring.js';
import { fetchPersonaBlurbs } from './fetchPersonaBlurbs.js';
import {
  clearPersonaBlurbs,
  loadPersonaBlurbs,
  profileIdFromProfile,
  savePersonaBlurbs,
} from './personaBlurbsStorage.js';

export const PersonaBlurbsContext = createContext(null);

function hasAllBlurbs(blurbs) {
  return blurbs?.productivity && blurbs?.security && blurbs?.social;
}

export function PersonaBlurbsProvider({ profile, accountFeaturesEnabled = true, children }) {
  const profileId = profileIdFromProfile(profile);
  const { adjustedScores } = useLiveScoring();
  const [blurbs, setBlurbs] = useState(() => loadPersonaBlurbs(profileId));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const inflightRef = useRef(false);

  useEffect(() => {
    setBlurbs(loadPersonaBlurbs(profileId));
    setError(null);
    inflightRef.current = false;
  }, [profileId]);

  const ensureBlurbs = useCallback(() => {
    if (!accountFeaturesEnabled) return;
    if (!profileId || inflightRef.current || hasAllBlurbs(blurbs)) return;

    const cached = loadPersonaBlurbs(profileId);
    if (hasAllBlurbs(cached)) {
      setBlurbs(cached);
      return;
    }

    inflightRef.current = true;
    setLoading(true);
    setError(null);

    fetchPersonaBlurbs(adjustedScores, profile)
      .then((next) => {
        if (!hasAllBlurbs(next)) {
          throw new Error('Incomplete persona blurbs from server');
        }
        setBlurbs(next);
        savePersonaBlurbs(profileId, next);
      })
      .catch((err) => {
        setError(err?.message || 'Could not generate persona blurbs');
      })
      .finally(() => {
        inflightRef.current = false;
        setLoading(false);
      });
  }, [profileId, blurbs, adjustedScores, profile, accountFeaturesEnabled]);

  const value = useMemo(
    () => ({
      blurbs,
      loading,
      error,
      ensureBlurbs,
      clearBlurbs: () => {
        clearPersonaBlurbs(profileId);
        setBlurbs(null);
        setError(null);
        inflightRef.current = false;
      },
    }),
    [blurbs, loading, error, ensureBlurbs, profileId],
  );

  return <PersonaBlurbsContext.Provider value={value}>{children}</PersonaBlurbsContext.Provider>;
}

export function usePersonaBlurbs() {
  return useContext(PersonaBlurbsContext);
}
