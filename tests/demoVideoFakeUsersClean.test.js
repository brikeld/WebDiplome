import { describe, it, expect } from 'vitest';
import {
  getFakeUsers,
  buildDemoVideoSchedule,
} from '../src/lib/demoVideoFakeUsers.js';

const BANNED = /\b(demo|fake|scripted|prewritten|mock)\b/i;
const ROSTER_FIRST_NAMES = [
  'Camille', 'Théo', 'Theo', 'Léa', 'Lea', 'Hugo', 'Manon', 'Lucas', 'Chloé', 'Chloe',
];

describe('fake-user roster text hygiene', () => {
  it('profile summaries contain no meta words', () => {
    for (const user of getFakeUsers()) {
      expect(user.profileSummary).not.toMatch(BANNED);
      expect(user.userDescription).not.toMatch(BANNED);
      expect(user.profileSummary.length).toBeGreaterThan(30);
    }
  });

  it('schedule post captions are first-person (no roster first names) and clean', () => {
    for (const step of buildDemoVideoSchedule()) {
      const content = step.post.content;
      expect(content).not.toMatch(BANNED);
      for (const name of ROSTER_FIRST_NAMES) {
        expect(content).not.toContain(`${name} `);
      }
      expect(content.length).toBeGreaterThan(40);
    }
  });

  it('schedule still has 20 steps with valid personas and assets', () => {
    const steps = buildDemoVideoSchedule();
    expect(steps).toHaveLength(20);
    for (const step of steps) {
      expect(['productivite', 'securite', 'popularite']).toContain(step.post.persona);
      expect(step.assetBasename.length).toBeGreaterThan(3);
    }
  });
});
