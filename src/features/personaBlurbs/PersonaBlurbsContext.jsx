import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { getPersonaScoresNormalized } from '@/lib/profileUtils.js';
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

/**
 * Persona blurbs describe the profile page subject (fixed, shared by all visitors).
 * Not tied to the logged-in viewer.
 */
export function PersonaBlurbsProvider({ profile, children }) {
  const profileId = profileIdFromProfile(profile);
  const subjectSlug = profile?.slug ?? profile?.id ?? null;
  const subjectScores = useMemo(
    () => getPersonaScoresNormalized(profile?.personaScores ?? profile),
    [profile],
  );
  const [blurbs, setBlurbs] = useState(() => {
    const fromProfile = profile?.personaBlurbs;
    if (hasAllBlurbs(fromProfile)) return fromProfile;
    return loadPersonaBlurbs(profileId);
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const inflightRef = useRef(false);

  useEffect(() => {
    const fromProfile = profile?.personaBlurbs;
    if (hasAllBlurbs(fromProfile)) {
      setBlurbs(fromProfile);
      savePersonaBlurbs(profileId, fromProfile);
      setError(null);
      inflightRef.current = false;
      return;
    }
    setBlurbs(loadPersonaBlurbs(profileId));
    setError(null);
    inflightRef.current = false;
  }, [profileId, profile?.personaBlurbs]);

  const ensureBlurbs = useCallback(() => {
    if (!profileId || !subjectSlug || inflightRef.current || hasAllBlurbs(blurbs)) return;

    const cached = loadPersonaBlurbs(profileId);
    if (hasAllBlurbs(cached)) {
      setBlurbs(cached);
      return;
    }

    inflightRef.current = true;
    setLoading(true);
    setError(null);

    fetchPersonaBlurbs(subjectScores, profile, { subjectProfileSlug: subjectSlug })
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
  }, [profileId, subjectSlug, blurbs, subjectScores, profile]);

  useEffect(() => {
    ensureBlurbs();
  }, [profileId, subjectSlug]);

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
