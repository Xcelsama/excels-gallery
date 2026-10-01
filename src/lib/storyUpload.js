// Browser-side upload of a story's files straight to Supabase Storage, the
// same approach AdminPostForm already uses for before/after posts (files
// never pass through a Vercel function, so its 4.5 MB request limit doesn't
// apply). The server action afterwards only receives the storage PATHS.

export const MAX_STORY_IMAGES = 20;
export const MAX_AUDIO_MB = 15;
export const IMAGE_BUCKET = "gallery";
export const AUDIO_BUCKET = "story-audio";

const AUDIO_TYPES = { mp3: "audio/mpeg", m4a: "audio/mp4" };
const UPLOAD_CONCURRENCY = 3;

function audioExt(file) {
  const ext = file.name?.split(".").pop()?.toLowerCase() ?? "";
  return ext in AUDIO_TYPES ? ext : null;
}

/** Returns an error message, or null if the file is fine. */
export function checkAudio(file) {
  if (!audioExt(file)) return "The music file needs to be an .mp3 or .m4a.";
  if (file.size > MAX_AUDIO_MB * 1024 * 1024) {
    const mb = (file.size / 1024 / 1024).toFixed(1);
    return `The music file is ${mb} MB. The limit is ${MAX_AUDIO_MB} MB.`;
  }
  return null;
}

/**
 * Uploads every prepared image (3 at a time) and the optional audio file.
 *
 * `uploaded` is filled in as files land ({ gallery: [paths], audio: [paths] })
 * so that if anything fails the caller can delete whatever did get uploaded.
 *
 * @returns {Promise<{images: {path, width, height}[], audioPath: string|null}>}
 */
export async function uploadStoryAssets({
  supabase,
  id,
  items,
  audioFile,
  uploaded,
  onProgress,
}) {
  const total = items.length + (audioFile ? 1 : 0);
  let done = 0;
  let failure = null;
  const images = new Array(items.length);
  const stamp = Date.now();

  let cursor = 0;
  async function worker() {
    while (!failure) {
      const i = cursor++;
      if (i >= items.length) return;
      const path = `${id}/story-${String(i).padStart(2, "0")}-${stamp}.jpg`;
      const { error } = await supabase.storage
        .from(IMAGE_BUCKET)
        .upload(path, items[i].blob, {
          contentType: "image/jpeg",
          cacheControl: "31536000",
        });
      if (error) {
        failure = new Error(`Could not upload image ${i + 1} (${error.message}).`);
        return;
      }
      uploaded.gallery.push(path);
      images[i] = { path, width: items[i].width, height: items[i].height };
      onProgress?.(++done, total);
    }
  }

  // allSettled (not all): wait until every worker has stopped, so nothing is
  // still uploading while the caller is cleaning up after a failure.
  await Promise.allSettled(
    Array.from({ length: Math.min(UPLOAD_CONCURRENCY, items.length) }, worker)
  );
  if (failure) throw failure;

  let audioPath = null;
  if (audioFile) {
    const ext = audioExt(audioFile);
    audioPath = `${id}/audio-${stamp}.${ext}`;
    const { error } = await supabase.storage
      .from(AUDIO_BUCKET)
      .upload(audioPath, audioFile, {
        contentType: AUDIO_TYPES[ext],
        cacheControl: "31536000",
      });
    if (error) {
      throw new Error(`Could not upload the music file (${error.message}).`);
    }
    uploaded.audio.push(audioPath);
    onProgress?.(++done, total);
  }

  return { images, audioPath };
}
