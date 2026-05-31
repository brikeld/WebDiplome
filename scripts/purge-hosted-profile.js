#!/usr/bin/env node
/**
 * Purge hosted Supabase profile(s) and all related posts.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *     node scripts/purge-hosted-profile.js --slug=firstname-lastname-a1b2c3d4
 *
 *   node scripts/purge-hosted-profile.js --firstname=Jane --lastname=Doe
 *
 *   node scripts/purge-hosted-profile.js --orphans
 */
import { createSupabaseClients } from '../server/lib/supabaseClient.js';
import { createPublicProfileStore } from '../server/lib/publicProfileStore.js';
import { recordHostedAccountDeletion } from '../server/lib/hostedAccountDeletion.js';

function readArg(name) {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : null;
}

async function main() {
  const { service } = createSupabaseClients();
  if (!service) {
    console.error('Set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (+ SUPABASE_ANON_KEY) in env.');
    process.exit(1);
  }

  const store = createPublicProfileStore(service);
  const orphansOnly = process.argv.includes('--orphans');

  if (orphansOnly) {
    const count = await store.deleteOrphanPosts();
    console.log(`Removed ${count} orphan post(s) (no matching profile row).`);
    return;
  }

  const slug = readArg('slug');
  const firstname = readArg('firstname');
  const lastname = readArg('lastname');

  if (slug) {
    const result = await store.deleteProfileBySlug(slug);
    if (result.deleted) recordHostedAccountDeletion(result.slug);
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (firstname && lastname) {
    const result = await store.deleteProfilesByNamePrefix(firstname, lastname);
    for (const row of result.profiles ?? []) {
      if (row.slug) recordHostedAccountDeletion(row.slug);
    }
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.error(`Usage:
  node scripts/purge-hosted-profile.js --slug=your-profile-slug
  node scripts/purge-hosted-profile.js --firstname=Jane --lastname=Doe
  node scripts/purge-hosted-profile.js --orphans`);
  process.exit(1);
}

main().catch((err) => {
  console.error('[purge-hosted-profile]', err.message);
  process.exit(1);
});
