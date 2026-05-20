/**
 * Halftone/dither FX are for harvested photos and screenshots only.
 * Algorithm-generated charts (and similar) should render as-is.
 */
export function shouldApplyPostImageFx(post) {
  if (!post || typeof post !== 'object') return true;
  if (post.chartType != null && String(post.chartType).trim() !== '') return false;
  return true;
}
