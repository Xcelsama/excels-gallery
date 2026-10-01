// Settings for the link-preview image, shared by the image route
// (app/(public)/gallery/[id]/og.jpg/route.js) and the page metadata so the
// width/height advertised in the og: tags match the file that is served.

export const OG_WIDTH = 1200; // px, the "about 1200px wide" WhatsApp likes
export const OG_MAX_HEIGHT = 1600; // keeps very tall portraits from getting huge
export const OG_MAX_BYTES = 280 * 1024; // stay safely under ~300 KB

/**
 * The size the preview image will have, given the source photo's size.
 * Same maths as sharp's resize({ fit: "inside", withoutEnlargement: true }).
 * Returns null when the source size isn't known (older posts), in which case
 * the og:image:width/height tags are simply left out.
 */
export function ogImageSize(width, height) {
  if (!width || !height) return null;
  const scale = Math.min(OG_WIDTH / width, OG_MAX_HEIGHT / height, 1);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}
