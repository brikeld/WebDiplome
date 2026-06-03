import { describe, expect, it } from 'vitest';
import {
  buildProfileSlug,
  mapSyncPayloadToProfileRow,
  mapPostForInsert,
  mapPersonaBlurbsForApi,
  slimProfilePayloadForStorage,
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

  it('strips heavyweight sync fields from stored raw_profile', () => {
    const slim = slimProfilePayloadForStorage({
      firstname: 'Ada',
      wallpaperBase64: 'data:image/jpeg;base64,' + 'A'.repeat(5000),
      personaPosts: [{ content: 'hi' }],
      dataJson: { PAST_HISTORY: { huge: 'payload' } },
      data_json: { PAST_HISTORY: { huge: 'payload' } },
    });
    expect(slim.firstname).toBe('Ada');
    expect(slim.wallpaperBase64).toBeUndefined();
    expect(slim.personaPosts).toBeUndefined();
    expect(slim.dataJson).toBeUndefined();
    expect(slim.data_json).toBeUndefined();
  });

  it('maps stored persona blurbs for API', () => {
    const blurbs = mapPersonaBlurbsForApi({
      productivite: 'Focus king.',
      securite: 'Locked down.',
      popularite: 'Always online.',
    });
    expect(blurbs).toEqual({
      productivity: 'Focus king.',
      security: 'Locked down.',
      social: 'Always online.',
    });
  });

  it('maps posts for insert without losing attached assets, leaderboard, or metadata', () => {
    const post = mapPostForInsert({
      persona: 'securite',
      content: 'Firewall disabled.',
      sentiment: 'negative',
      attachedAsset: { kind: 'image', url: '/uploads/a.png' },
      leaderboard: { boardId: 'most_secure' },
      inferenceChain: [{ step: 'data', value: 'signal' }],
      chartType: 'app_usage',
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
      metadata: {
        inferenceChain: [{ step: 'data', value: 'signal' }],
        chartType: 'app_usage',
      },
      source: 'sync',
      created_at: '2026-05-29T11:00:00Z',
    });
  });

  it('serializes numeric post timestamps for Supabase timestamptz columns', () => {
    const post = mapPostForInsert({
      content: 'COMPLIANT notice.',
      createdAt: 1780499624561,
      compliantJoin: { userDisplayName: 'Brikeld Hoxha' },
    }, 'profile-1', 'user-1', 'system');

    expect(post.created_at).toBe('2026-06-03T15:13:44.561Z');
  });
});
