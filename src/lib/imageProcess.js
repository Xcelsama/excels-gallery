// Client-side image preparation for story slides. Runs in the browser at
// pick time, so by the time you press Publish the files are already small.
//
// Each photo is re-drawn onto a canvas at (at most) STORY_MAX_EDGE pixels on
// its long side and re-encoded as JPEG. Side effects, all wanted:
//  - a 6-10 MB phone export becomes a few hundred KB,
//  - the browser applies the EXIF rotation while drawing, so the width and
//    height we save are the ones a viewer will actually see,
//  - EXIF metadata (including GPS location) is not carried over to the
//    public copy.

export const STORY_MAX_EDGE = 2048;
const STORY_QUALITY = 0.88;
const THUMB_EDGE = 240;
const BLUR_WIDTH = 16;

function loadImageElement(objectUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not read the image file."));
    img.src = objectUrl;
  });
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("Could not compress the image.")),
      type,
      quality
    );
  });
}

function drawScaled(img, width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, width, height);
  return canvas;
}

/**
 * @returns {Promise<{blob: Blob, width: number, height: number,
 *   thumbUrl: string, blurDataUrl: string}>}
 */
export async function prepareStoryImage(file) {
  if (!file.type.startsWith("image/")) {
    throw new Error(`${file.name} isn't an image.`);
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await loadImageElement(objectUrl);
    const srcW = img.naturalWidth;
    const srcH = img.naturalHeight;
    if (!srcW || !srcH) throw new Error(`${file.name} has no readable size.`);

    const scale = Math.min(1, STORY_MAX_EDGE / Math.max(srcW, srcH));
    const width = Math.max(1, Math.round(srcW * scale));
    const height = Math.max(1, Math.round(srcH * scale));

    const canvas = drawScaled(img, width, height);
    const blob = await canvasToBlob(canvas, "image/jpeg", STORY_QUALITY);

    // Small previews are made from the already-shrunk canvas, so this step
    // is cheap even for a huge source photo.
    const thumbScale = Math.min(1, THUMB_EDGE / Math.max(width, height));
    const thumb = drawScaled(
      canvas,
      Math.max(1, Math.round(width * thumbScale)),
      Math.max(1, Math.round(height * thumbScale))
    );
    const blurHeight = Math.max(1, Math.round((height / width) * BLUR_WIDTH));
    const blur = drawScaled(canvas, BLUR_WIDTH, blurHeight);

    return {
      blob,
      width,
      height,
      thumbUrl: thumb.toDataURL("image/jpeg", 0.7),
      blurDataUrl: blur.toDataURL("image/jpeg", 0.5),
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
