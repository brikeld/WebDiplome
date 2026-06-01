import { useEffect, useMemo } from 'react';
import { formatRingDelta } from '@/features/home/DashboardPersonaRings.jsx';
import { useLiveScoring } from '@/features/liveScoring/useLiveScoring.js';
import { usePersonaBlurbs } from '@/features/personaBlurbs/PersonaBlurbsContext.jsx';
import { PERSONA_UI_COLORS } from '@/lib/personaColors.js';
import { buildProfileOverviewData } from '@/lib/profileOverviewData.js';
import { normalizeRailDominant, orderRailPersonasByDominant } from '@/features/profile/railPersonas.js';

function PersonaRow({ label, value, delta, color, copy, isDominant, isPending }) {
  const ringDelta = formatRingDelta(delta);

  return (
    <article
      className={`profile-rail-persona-row${isDominant ? ' profile-rail-persona-row--dominant' : ''}`}
    >
      <div className="profile-rail-persona-row__head">
        <span className="profile-rail-persona-row__label">
          {label}
          <i className="profile-rail-persona-row__dot" style={{ background: color }} aria-hidden />
        </span>
        <span className="profile-rail-persona-row__score" aria-label={`${label} ${value} percent`}>
          <span className="profile-rail-persona-row__value">{value}%</span>
          {ringDelta ? (
            <span className={`profile-rail-persona-row__delta profile-rail-persona-row__delta--${ringDelta.mod}`}>
              {ringDelta.text}
            </span>
          ) : null}
        </span>
      </div>
      <p className={`profile-rail-persona-row__copy${isPending ? ' is-pending' : ''}`}>{copy}</p>
    </article>
  );
}

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

  const orderedPersonas = useMemo(
    () => orderRailPersonasByDominant(profileData?.dominantPersona),
    [profileData?.dominantPersona],
  );

  if (!profileData) return null;

  const domKey = normalizeRailDominant(profileData.dominantPersona);
  const deltas = profileData.scoreDrift?.deltas ?? null;

  return (
    <section className="profile-rail-persona-scores" aria-label="Persona scores">
      <div className="profile-rail-persona-scores__list">
        {orderedPersonas.map(({ key, label, fallback }) => {
          const value = Math.max(0, Math.min(100, Math.round(Number(profileData.scores?.[key]) || 0)));
          const blurb = blurbs?.[key];
          const copy = blurb || (loading ? 'Generating profile phrases…' : fallback);

          return (
            <PersonaRow
              key={key}
              label={label}
              value={value}
              delta={deltas?.[key]}
              color={PERSONA_UI_COLORS[key]}
              copy={copy}
              isDominant={key === domKey}
              isPending={loading && !blurb}
            />
          );
        })}
      </div>
    </section>
  );
}
