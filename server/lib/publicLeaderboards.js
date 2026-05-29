const DEMO_ROWS = [
  { slug: 'demo-alex', displayName: 'Alex Johnson', handle: '@AlexLaptop', globalScore: 74, personaScores: { productivity: 74, security: 66, social: 61 }, source: 'demo' },
  { slug: 'demo-mira', displayName: 'Mira Laurent', handle: '@MiraBook', globalScore: 68, personaScores: { productivity: 64, security: 71, social: 50 }, source: 'demo' },
  { slug: 'demo-sam', displayName: 'Sam Park', handle: '@SamStudio', globalScore: 63, personaScores: { productivity: 58, security: 65, social: 75 }, source: 'demo' },
  { slug: 'demo-rio', displayName: 'Rio Chen', handle: '@RioAir', globalScore: 59, personaScores: { productivity: 69, security: 52, social: 60 }, source: 'demo' },
  { slug: 'demo-teo', displayName: 'Teo Muller', handle: '@TeoMac', globalScore: 55, personaScores: { productivity: 55, security: 59, social: 49 }, source: 'demo' },
];

const BOARDS = [
  { id: 'global_score', title: 'Global score', key: 'globalScore', persona: 'productivite' },
  { id: 'productivity_score', title: 'Productivity score', key: 'productivity', persona: 'productivite' },
  { id: 'security_score', title: 'Security score', key: 'security', persona: 'securite' },
  { id: 'social_score', title: 'Social score', key: 'social', persona: 'popularite' },
];

function scoreFor(profile, key) {
  if (key === 'globalScore') return Number(profile.globalScore ?? profile.global_score ?? 0);
  return Number(profile.personaScores?.[key] ?? profile.persona_scores?.[key] ?? 0);
}

function rowFor(profile, board) {
  return {
    slug: profile.slug,
    name: profile.displayName || profile.display_name || 'Demo User',
    handle: profile.handle || (profile.machineName ? `@${profile.machineName}` : `@${profile.slug || 'demo'}`),
    avatarSrc: profile.avatarSrc || profile.wallpaperUrl || profile.wallpaper_url || null,
    avatarInitials: profile.avatarInitials || String(profile.displayName || profile.display_name || '?').slice(0, 2).toUpperCase(),
    score: scoreFor(profile, board.key),
    source: profile.source || 'real',
    isUser: false,
  };
}

export function buildPublicLeaderboards(realProfiles, minimumRows = 5) {
  const real = Array.isArray(realProfiles) ? realProfiles.filter(Boolean).map((p) => ({ ...p, source: 'real' })) : [];
  const people = real.length >= minimumRows ? real : [...real, ...DEMO_ROWS.slice(0, minimumRows - real.length)];

  return BOARDS.map((board) => {
    const entries = people
      .map((p) => rowFor(p, board))
      .sort((a, b) => b.score - a.score)
      .map((entry, index) => ({ ...entry, rank: index + 1 }));
    return { boardId: board.id, title: board.title, persona: board.persona, entries };
  });
}
