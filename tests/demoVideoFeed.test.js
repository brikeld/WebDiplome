import { describe, expect, it } from 'vitest';
import { isLocalDemoVideoApiOrigin } from '../src/lib/demoVideoFeed.js';

describe('demoVideoFeed API routing', () => {
  it('uses the local generator only for local API origins', () => {
    expect(isLocalDemoVideoApiOrigin('http://localhost:3001')).toBe(true);
    expect(isLocalDemoVideoApiOrigin('http://127.0.0.1:3001')).toBe(true);
    expect(isLocalDemoVideoApiOrigin('https://webdiplome-production.up.railway.app')).toBe(false);
  });
});
