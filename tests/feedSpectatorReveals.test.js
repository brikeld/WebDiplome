import { describe, expect, it } from 'vitest';
import { createFeedSpectatorRevealController } from '../src/lib/feedSpectatorReveals.js';

describe('feedSpectatorReveals', () => {
  it('does not wipe the directory when reveal fires before React commits profiles', () => {
    let profiles = [];
    const controller = createFeedSpectatorRevealController({
      setAllProfiles: (updater) => {
        profiles = typeof updater === 'function' ? updater(profiles) : updater;
      },
    });

    const row = {
      slug: 'demo-user-abc123',
      personaPosts: [{ id: 'post-1', persona: 'productivite', content: 'hello', createdAt: '2026-01-01T00:00:00Z' }],
    };

    controller.ingestProfiles([{ slug: row.slug, personaPosts: [] }]);
    expect(profiles).toEqual([]);

    profiles = [row];
    controller.ingestProfiles([row]);

    expect(profiles).toHaveLength(1);
    expect(profiles[0].personaPosts?.length).toBeGreaterThan(0);
  });
});
