import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { formatRingDelta } from '@/features/home/DashboardPersonaRings.jsx';
import { useLiveScoring } from '@/features/liveScoring/useLiveScoring.js';
import { usePersonaBlurbs } from '@/features/personaBlurbs/PersonaBlurbsContext.jsx';
import { PERSONA_UI_COLORS } from '@/lib/personaColors.js';
import { buildProfileOverviewData } from '@/lib/profileOverviewData.js';
import { resolveDominantPersonaKey } from '@/lib/profileUtils.js';
import { clampRailBlurb } from '@/features/profile/railBlurb.js';

const PERSONAS = [
  {
    key: 'productivity',
    label: 'Productivity',
    fallback: 'Code output, file activity and focused active hours.',
  },
  {
    key: 'security',
    label: 'Security',
    fallback: 'System protection: SIP, FileVault, Gatekeeper and update hygiene.',
  },
  {
    key: 'social',
    label: 'Social',
    fallback: 'Communication apps, network exposure and public activity.',
  },
];

const FIT_VAR_NAMES = [
  '--profile-rail-scores-copy-size-fit',
  '--profile-rail-scores-label-size-fit',
  '--profile-rail-scores-score-size-fit',
  '--profile-rail-scores-delta-size-fit',
  '--profile-rail-scores-row-gap-fit',
  '--profile-rail-scores-row-inner-gap-fit',
  '--profile-rail-scores-row-pad-top-fit',
  '--profile-rail-scores-line-height-fit',
];

const MIN_FIT_SCALE = 0.46;
// On very tall rails (4K–6K) the blurbs have lots of vertical room; allow them
// to grow well past the desktop size instead of stranding empty space.
const MAX_FIT_SCALE = 1.5;

function clampNumber(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function px(value, fallback = 0) {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : fallback;
}

function useRailPersonaScoreFit(rootRef, fitKey) {
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || typeof ResizeObserver === 'undefined') return undefined;

    let raf = 0;

    const clearFitVars = () => {
      for (const name of FIT_VAR_NAMES) root.style.removeProperty(name);
      root.classList.remove('profile-rail-persona-scores--tight');
    };

    const scheduleFit = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const list = root.querySelector('.profile-rail-persona-scores__list');
        const rows = [...root.querySelectorAll('.profile-rail-persona-row')];
        const firstRow = rows[0];
        const firstCopy = root.querySelector('.profile-rail-persona-row__copy');
        const firstLabel = root.querySelector('.profile-rail-persona-row__label');
        const firstScore = root.querySelector('.profile-rail-persona-row__score');
        const firstDelta = root.querySelector('.profile-rail-persona-row__delta');

        if (!list || !firstRow || !firstCopy || !firstLabel || !firstScore) return;

        clearFitVars();

        const available = list.clientHeight;
        const natural = list.scrollHeight;
        if (available <= 0 || natural <= 0) return;

        const fitRatio = available / natural;
        const scale =
          fitRatio >= 1
            ? clampNumber(1 + (fitRatio - 1) * 0.42, 1, MAX_FIT_SCALE)
            : clampNumber(fitRatio * 0.97, MIN_FIT_SCALE, 1);

        const listStyles = getComputedStyle(list);
        const rowStyles = getComputedStyle(firstRow);
        const copyStyles = getComputedStyle(firstCopy);
        const labelStyles = getComputedStyle(firstLabel);
        const scoreStyles = getComputedStyle(firstScore);
        const deltaStyles = firstDelta ? getComputedStyle(firstDelta) : scoreStyles;

        root.style.setProperty(
          '--profile-rail-scores-copy-size-fit',
          `${clampNumber(px(copyStyles.fontSize, 14) * scale, 7.5, 30).toFixed(2)}px`,
        );
        root.style.setProperty(
          '--profile-rail-scores-label-size-fit',
          `${clampNumber(px(labelStyles.fontSize, 16) * scale, 9, 36).toFixed(2)}px`,
        );
        root.style.setProperty(
          '--profile-rail-scores-score-size-fit',
          `${clampNumber(px(scoreStyles.fontSize, 14) * scale, 8, 30).toFixed(2)}px`,
        );
        root.style.setProperty(
          '--profile-rail-scores-delta-size-fit',
          `${clampNumber(px(deltaStyles.fontSize, 12) * scale, 7, 26).toFixed(2)}px`,
        );
        root.style.setProperty(
          '--profile-rail-scores-row-gap-fit',
          `${clampNumber(px(listStyles.rowGap, 12) * scale, 3, 30).toFixed(2)}px`,
        );
        root.style.setProperty(
          '--profile-rail-scores-row-inner-gap-fit',
          `${clampNumber(px(rowStyles.rowGap, 6) * scale, 2, 12).toFixed(2)}px`,
        );
        root.style.setProperty(
          '--profile-rail-scores-row-pad-top-fit',
          `${clampNumber(px(rowStyles.paddingTop, 9) * scale, 3, 14).toFixed(2)}px`,
        );
        root.style.setProperty(
          '--profile-rail-scores-line-height-fit',
          `${clampNumber(1.12 + scale * 0.1, 1.14, 1.24).toFixed(3)}`,
        );
        root.classList.toggle('profile-rail-persona-scores--tight', scale < 0.78);
      });
    };

    const observer = new ResizeObserver(scheduleFit);
    observer.observe(root);
    observer.observe(root.parentElement ?? root);
    scheduleFit();

    window.addEventListener('resize', scheduleFit);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      window.removeEventListener('resize', scheduleFit);
      clearFitVars();
    };
  }, [rootRef, fitKey]);
}

function normalizeDominant(key) {
  const k = String(key ?? '').toLowerCase();
  if (k === 'social' || k === 'popularite' || k === 'popularity') return 'social';
  if (k === 'productivite') return 'productivity';
  if (k === 'securite') return 'security';
  return k;
}

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
            <span
              className={`profile-rail-persona-row__delta profile-rail-persona-row__delta--${ringDelta.mod}`}
              style={{ color }}
            >
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
  const scoreFitRef = useRef(null);
  const { adjustedScores } = useLiveScoring();
  const { blurbs, loading, ensureBlurbs } = usePersonaBlurbs() ?? {};

  useEffect(() => {
    ensureBlurbs?.();
  }, [ensureBlurbs]);

  const profileData = useMemo(
    () => buildProfileOverviewData(profile, { adjustedScores }),
    [profile, adjustedScores],
  );
  const fitKey = useMemo(
    () => JSON.stringify({ profileId: profile?.id ?? profile?.slug ?? null, blurbs, loading, adjustedScores }),
    [profile?.id, profile?.slug, blurbs, loading, adjustedScores],
  );

  useRailPersonaScoreFit(scoreFitRef, fitKey);

  if (!profileData) return null;

  // Profile main persona (harvest/analyze), not live highest score — drives order + accent bar.
  const domKey = normalizeDominant(resolveDominantPersonaKey(profile));
  const deltas = profileData.scoreDrift?.deltas ?? null;
  const orderedPersonas = [
    ...PERSONAS.filter(({ key }) => key === domKey),
    ...PERSONAS.filter(({ key }) => key !== domKey),
  ];

  return (
    <section ref={scoreFitRef} className="profile-rail-persona-scores" aria-label="Persona scores">
      <div className="profile-rail-persona-scores__list">
        {orderedPersonas.map(({ key, label, fallback }) => {
          const value = Math.max(0, Math.min(100, Math.round(Number(profileData.scores?.[key]) || 0)));
          const blurb = blurbs?.[key];
          const raw = blurb || (loading ? 'Generating profile phrases…' : fallback);
          const copy = loading && !blurb ? raw : clampRailBlurb(raw);

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
