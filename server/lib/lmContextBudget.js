import { prepareImageForLmVision } from './lmAssetPrep.js';

/** Keep user JSON small enough to fit alongside system prompts + optional vision. */
export const MAX_USER_PAYLOAD_CHARS = 6000;

export function truncateUserPayloadString(payload) {
  const text = String(payload ?? '');
  if (text.length <= MAX_USER_PAYLOAD_CHARS) return text;
  return `${text.slice(0, MAX_USER_PAYLOAD_CHARS)}\n…[truncated for context budget]`;
}

/** Downscale chart/asset vision input before sending to LM Studio. */
export async function prepareVisionImageData(imageData) {
  if (!imageData?.base64) return null;
  try {
    const buf = Buffer.from(imageData.base64, 'base64');
    const prepared = await prepareImageForLmVision(buf);
    if (!prepared) return null;
    return { base64: prepared.base64, mime: prepared.mime };
  } catch {
    return null;
  }
}
