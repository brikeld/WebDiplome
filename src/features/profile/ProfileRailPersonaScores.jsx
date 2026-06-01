import { useEffect, useMemo } from 'react';
import { buildProfileOverviewData } from '@/lib/profileOverviewData.js';
import { useLiveScoring } from '@/features/liveScoring/useLiveScoring.js';
import { usePersonaBlurbs } from '@/features/personaBlurbs/PersonaBlurbsContext.jsx';
import ScoreBreakdown from '@/features/profile/ProfileOverview/components/ScoreBreakdown.jsx';

export default function ProfileRailPersonaScores({ profile }) {
  const { adjustedScores, dominantPersona } = useLiveScoring();
  const { blurbs, loading, ensureBlurbs } = usePersonaBlurbs() ?? {};

  useEffect(() => {
    ensureBlurbs?.();
  }, [ensureBlurbs]);

  const profileData = useMemo(
    () => buildProfileOverviewData(profile, { adjustedScores, dominantPersona }),
    [profile, adjustedScores, dominantPersona],
  );

  if (!profileData) return null;

  return (
    <section
      className="profile-rail-persona-scores"
      aria-labelledby="profile-rail-persona-scores-title"
    >
      <h3 id="profile-rail-persona-scores-title" className="profile-rail-persona-scores__title">
        Persona scores
      </h3>
      <div className="profile-rail-persona-scores__body">
        <ScoreBreakdown
          scores={profileData.scores}
          dominantPersona={profileData.dominantPersona}
          deltas={profileData.scoreDrift?.deltas}
          personaBlurbs={blurbs}
          personaBlurbsLoading={loading}
          variant="rail"
        />
      </div>
    </section>
  );
}
