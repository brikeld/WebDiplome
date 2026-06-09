import { describe, expect, it } from 'vitest';
import { resolveProfileHarvestDataJson } from '../server/lib/resolveProfileHarvestData.js';

describe('resolveProfileHarvestDataJson', () => {
  it('falls back to posts-single job history when profile JSON is empty', async () => {
    const data = await resolveProfileHarvestDataJson({}, 'profile-1', {
      async findLatestHarvestDataJson() {
        return { hostname: 'daniel-mac', user_identity: { name: 'Daniel' } };
      },
      async findLatestJobPayload() {
        return null;
      },
    });
    expect(data?.hostname).toBe('daniel-mac');
  });

  it('reads harvest from latest posts-single payload when scan helper is missing', async () => {
    const data = await resolveProfileHarvestDataJson({}, 'profile-2', {
      async findLatestJobPayload(_profileId, jobType) {
        if (jobType === 'posts') return null;
        if (jobType === 'posts-single') {
          return {
            request_payload: {
              jobType: 'posts-single',
              dataJson: { hostname: 'from-single-job' },
            },
          };
        }
        return null;
      },
    });
    expect(data?.hostname).toBe('from-single-job');
  });

  it('synthesizes harvest when allowSynthesize and profile has AI posts', async () => {
    const data = await resolveProfileHarvestDataJson(
      {},
      'profile-3',
      {
        async findLatestHarvestDataJson() {
          return null;
        },
        async findLatestJobPayload() {
          return null;
        },
      },
      {
        allowSynthesize: true,
        profileRow: { slug: 'nyria-demo', display_name: 'Nyria' },
        apiProfile: {
          slug: 'nyria-demo',
          personaPosts: [{ persona: 'popularite', content: 'Great meetup tonight.' }],
        },
      },
    );
    expect(data?._synthesizedForRegeneration).toBe(true);
    expect(data?.MACHINE_IDENTITY?.user_identity?.name).toBe('Nyria');
  });
});
