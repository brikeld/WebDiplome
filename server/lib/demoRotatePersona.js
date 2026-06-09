import os from 'os';
import path from 'path';
import { buildLmUserPayload } from './compactHarvestData.js';
import { countAiGeneratedPosts } from './generationQueue.js';
import { preparePersonaPostSlotPlan } from './personaPostGenerator.js';

const CHART_PLAN_TMP = path.join(os.tmpdir(), 'webdiplome-demo-plan');

/**
 * Persona key for the next demo-rotate single post (matches worker slot cycling).
 */
export async function resolveDemoSinglePostPersona({ profile, dataJson }) {
  const existingPosts = Array.isArray(profile?.personaPosts) ? profile.personaPosts : [];
  const slotIndex = countAiGeneratedPosts(existingPosts) % 3;
  const user = {
    first_name: profile?.firstname ?? profile?.first_name ?? '',
    last_name: profile?.lastname ?? profile?.last_name ?? '',
    age: profile?.age ?? 0,
  };
  const userPayload = buildLmUserPayload(user, dataJson ?? {});
  const plan = await preparePersonaPostSlotPlan({
    userPayload,
    assetAssignment: null,
    dataJson: dataJson ?? {},
    profile: profile ?? {},
    existingPosts,
    chartUploadDir: CHART_PLAN_TMP,
    skipLeaderboard: existingPosts.length === 0,
    model: null,
  });
  return plan.find((entry) => entry.slotIndex === slotIndex)?.persona ?? null;
}
