import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('generation job implementation', () => {
  it('exposes worker claim and complete endpoints', () => {
    const src = readFileSync('server/routes/generationJobRoutes.js', 'utf8');
    expect(src).toContain("router.get('/worker/jobs/next'");
    expect(src).toContain("router.post('/worker/jobs/:id/complete'");
    expect(src).toContain("router.post('/worker/jobs/:id/fail'");
  });

  it('worker calls local LM Studio and hosted API', () => {
    const src = readFileSync('worker/ai-worker.js', 'utf8');
    expect(src).toContain('LM_STUDIO_BASE_URL');
    expect(src).toContain('/api/worker/jobs/next');
    expect(src).toContain('/api/worker/jobs/');
    expect(src).toContain('generatePersonaPosts');
  });
});
