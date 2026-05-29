export const DEMO_PUBLIC_PEOPLE = [
  { id: 'demo-alex', source: 'demo', displayName: 'Alex Johnson', handle: '@AlexLaptop', avatarSrc: '/imgs/AlexP.png', globalScore: 74 },
  { id: 'demo-mira', source: 'demo', displayName: 'Mira Laurent', handle: '@MiraBook', avatarInitials: 'ML', globalScore: 68 },
  { id: 'demo-sam', source: 'demo', displayName: 'Sam Park', handle: '@SamStudio', avatarInitials: 'SP', globalScore: 63 },
  { id: 'demo-rio', source: 'demo', displayName: 'Rio Chen', handle: '@RioAir', avatarInitials: 'RC', globalScore: 59 },
  { id: 'demo-teo', source: 'demo', displayName: 'Teo Muller', handle: '@TeoMac', avatarInitials: 'TM', globalScore: 55 },
];

export function selectProfileBySlug(profiles, slug) {
  const list = Array.isArray(profiles) ? profiles : [];
  if (slug) {
    const found = list.find((p) => p?.slug === slug || p?.id === slug);
    if (found) return found;
  }
  return list[0] ?? null;
}

export function mergeRealAndDemoPeople(realPeople, demoPeople = DEMO_PUBLIC_PEOPLE, minimum = 5) {
  const real = Array.isArray(realPeople) ? realPeople.filter(Boolean) : [];
  if (real.length >= minimum) return real;
  return [...real, ...demoPeople.slice(0, minimum - real.length)];
}
