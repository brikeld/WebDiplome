/**
 * Local-mode adapter for the ▶ demo-video button: targets the SEEDED fake
 * profiles (plain slugs, server-backed) instead of ephemeral demo-video-*
 * users, so each person exists exactly once and revealed posts can persist.
 */
import { getFakeUsers } from '@/lib/demoVideoFakeUsers.js';

export const SEEDED_FAKE_COUNT = 7;

export function seededSlugForFakeUser(user) {
  return String(user?.slug ?? '').replace(/^demo-video-/, '');
}

/** Re-target schedule steps onto the first 7 (seeded) people, cycling. */
export function mapScheduleToSeededUsers(schedule) {
  const seeded = getFakeUsers().slice(0, SEEDED_FAKE_COUNT).map((u) => {
    const slug = seededSlugForFakeUser(u);
    return { ...u, slug, id: slug };
  });
  return (Array.isArray(schedule) ? schedule : []).map((step, i) => ({
    ...step,
    user: seeded[i % seeded.length],
  }));
}
