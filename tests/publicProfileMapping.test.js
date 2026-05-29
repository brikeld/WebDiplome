import { describe, expect, it } from 'vitest';
import {
  buildProfileSlug,
  mapSyncPayloadToProfileRow,
  mapPostForInsert,
} from '../server/lib/publicProfileMapping.js';

describe('public profile mapping', () => {
  it('builds stable readable slugs', () => {
    expect(buildProfileSlug('Brikeld', 'Hoxha', 'abc-123')).toBe('brikeld-hoxha-abc123');
    expect(buildProfileSlug('', '', 'abc-123')).toBe('demo-user-abc123');
  });

  it('maps Electron sync payload to Supabase profile row', () => {
    const row = mapSyncPayloadToProfileRow({
      firstname: 'Ada',
      lastname: 'Lovelace',
      machineName: 'Ada-Mac',
      globalScore: 81,
      personaScores: { productivity: 50, security: 25, social: 25 },
      dominantPersona: 'productivity',
      profileSummary: 'Analytical, late-night builder.',
      wallpaperUrl: 'https://cdn/wallpaper.jpg',
      collectedAt: '2026-05-29T10:00:00Z',
    }, 'user-1', 'ada-user1');

    expect(row).toMatchObject({
      user_id: 'user-1',
      slug: 'ada-user1',
      firstname: 'Ada',
      lastname: 'Lovelace',
      display_name: 'Ada Lovelace',
      machine_name: 'Ada-Mac',
      global_score: 81,
      dominant_persona: 'productivity',
      profile_summary: 'Analytical, late-night builder.',
      wallpaper_url: 'https://cdn/wallpaper.jpg',
    });
    expect(row.raw_profile.firstname).toBe('Ada');
  });

  it('maps posts for insert without losing attached assets or leaderboard data', () => {
    const post = mapPostForInsert({
      persona: 'securite',
      content: 'Firewall disabled.',
      sentiment: 'negative',
      attachedAsset: { kind: 'image', url: '/uploads/a.png' },
      leaderboard: { boardId: 'most_secure' },
      createdAt: '2026-05-29T11:00:00Z',
    }, 'profile-1', 'user-1', 'sync');

    expect(post).toMatchObject({
      profile_id: 'profile-1',
      user_id: 'user-1',
      persona: 'securite',
      content: 'Firewall disabled.',
      sentiment: 'negative',
      attached_asset: { kind: 'image', url: '/uploads/a.png' },
      leaderboard: { boardId: 'most_secure' },
      source: 'sync',
      created_at: '2026-05-29T11:00:00Z',
    });
  });
});
