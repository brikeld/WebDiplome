import path from 'path';
import { Buffer } from 'buffer';
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const DEFAULT_MAC_CONTENT_DIR = '/Users/brikeld/Documents/videoDEMO/contentFakePeople';

function cleanEnvPath(value) {
  const raw = String(value || '').trim();
  return raw.replace(/^['"]|['"]$/g, '');
}

function addCandidate(candidates, dir) {
  const clean = cleanEnvPath(dir);
  if (!clean) return;
  if (!candidates.includes(clean)) candidates.push(clean);
}

export function demoVideoContentDirCandidates(env = process.env) {
  const candidates = [];

  addCandidate(candidates, env.VIDEO_DEMO_CONTENT_DIR);

  const demoRoot = cleanEnvPath(env.VIDEO_DEMO_DIR);
  if (demoRoot) {
    if (
      path.basename(demoRoot) === 'contentFakePeople'
      || path.win32.basename(demoRoot) === 'contentFakePeople'
    ) {
      addCandidate(candidates, demoRoot);
    }
    addCandidate(candidates, path.join(demoRoot, 'contentFakePeople'));
  }

  addCandidate(candidates, DEFAULT_MAC_CONTENT_DIR);
  addCandidate(candidates, path.join(REPO_ROOT, 'public', 'videoDEMO', 'contentFakePeople'));

  return candidates;
}

export function assertSafeDemoVideoBasename(assetBasename) {
  const safe = String(assetBasename || '').trim();
  if (!safe || safe.includes('/') || safe.includes('\\') || safe.includes('..') || path.basename(safe) !== safe) {
    throw new Error('invalid assetBasename');
  }
  return safe;
}

export function normalizeDemoVideoAssetUrl(assetUrl, assetBasename) {
  const raw = String(assetUrl || '').trim();
  if (!raw) return '';

  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('invalid assetUrl');
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('invalid assetUrl');
  }

  const safeBasename = assetBasename ? assertSafeDemoVideoBasename(assetBasename) : '';
  if (safeBasename) {
    let urlBasename = path.posix.basename(url.pathname);
    try {
      urlBasename = decodeURIComponent(urlBasename);
    } catch {
      // Keep the encoded basename; the comparison below will reject it.
    }
    if (urlBasename !== safeBasename) {
      throw new Error('assetUrl basename mismatch');
    }
  }

  return url.toString();
}

export async function resolveDemoVideoAssetPath(assetBasename, { env = process.env } = {}) {
  const safe = assertSafeDemoVideoBasename(assetBasename);
  const tried = [];

  for (const dir of demoVideoContentDirCandidates(env)) {
    const candidate = path.join(dir, safe);
    tried.push(candidate);
    try {
      await fs.access(candidate);
      return { path: candidate, dir, tried };
    } catch (err) {
      if (err?.code !== 'ENOENT' && err?.code !== 'ENOTDIR') throw err;
    }
  }

  throw new Error(
    [
      `demo-video asset not found: ${safe}`,
      `Tried: ${tried.join(' | ') || '(no candidate folders)'}`,
      'Set VIDEO_DEMO_CONTENT_DIR to the contentFakePeople folder that exists on the AI worker machine.',
    ].join('. '),
  );
}

export async function readDemoVideoAsset(assetBasename, {
  assetUrl = '',
  env = process.env,
  fetchImpl = globalThis.fetch,
} = {}) {
  const safe = assertSafeDemoVideoBasename(assetBasename);
  const normalizedUrl = normalizeDemoVideoAssetUrl(assetUrl, safe);

  if (normalizedUrl) {
    if (typeof fetchImpl !== 'function') throw new Error('fetch unavailable for demo-video assetUrl');
    const res = await fetchImpl(normalizedUrl, { cache: 'no-store' });
    if (!res?.ok) {
      throw new Error(`demo-video asset fetch failed: ${res?.status || 'network error'}`);
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    return {
      source: 'url',
      url: normalizedUrl,
      buffer,
      mime: res.headers?.get?.('content-type') || '',
    };
  }

  const resolved = await resolveDemoVideoAssetPath(safe, { env });
  return {
    source: 'file',
    ...resolved,
    buffer: await fs.readFile(resolved.path),
  };
}
