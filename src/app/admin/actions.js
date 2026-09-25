"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parseTagsInput } from "@/lib/utils";

const BUCKET = "gallery";
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function requireUser(supabase) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

// Images are uploaded straight from the browser to Supabase Storage (a file
// of a few MB would be rejected by Vercel's 4.5 MB request limit if it came
// through here). This action only receives the storage path of each upload.
// We re-check the shape of that path so a request can't point a post at some
// other file in the bucket.
function readUploadedPath(formData, field, slot, id) {
  const value = String(formData.get(field) ?? "");
  if (!value) return null;
  const pattern = new RegExp(`^${id}/${slot}-\\d+\\.[a-z0-9]{1,5}$`);
  return pattern.test(value) ? value : undefined;
}

function publicUrlFor(supabase, path) {
  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return publicUrl;
}

function pathFromPublicUrl(url) {
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const index = url ? url.indexOf(marker) : -1;
  if (index === -1) return null;
  return decodeURIComponent(url.slice(index + marker.length));
}

async function removePaths(supabase, paths) {
  const list = paths.filter(Boolean);
  if (!list.length) return;
  try {
    await supabase.storage.from(BUCKET).remove(list);
  } catch {
    // Best effort only. A leftover file in Storage is harmless.
  }
}

function readPostFields(formData) {
  const title = String(formData.get("title") ?? "").trim();
  const caption = String(formData.get("caption") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();
  const tags = parseTagsInput(String(formData.get("tags") ?? ""));
  return { title, caption, note, tags };
}

// Width/height/blur placeholder for one image slot ("before" or "after"),
// as read client-side in AdminPostForm's readImageMeta and submitted
// alongside the upload. Never trusted blindly: width and height are
// bounds-checked integers (and only kept as a pair, mismatched aspect
// ratio metadata is worse than none), and the blur string is capped at
// the same length the 0002 migration's check constraint allows, so a
// malformed value fails here with a normal empty result instead of a
// raw database error.
function readImageMetaFields(formData, slot) {
  const width = Number(formData.get(`${slot}Width`));
  const height = Number(formData.get(`${slot}Height`));
  const blur = formData.get(`${slot}Blur`);

  const result = {};
  if (Number.isInteger(width) && width >= 1 && width <= 20000) {
    result.width = width;
  }
  if (Number.isInteger(height) && height >= 1 && height <= 20000) {
    result.height = height;
  }
  if (!("width" in result) || !("height" in result)) {
    delete result.width;
    delete result.height;
  }
  if (
    typeof blur === "string" &&
    blur.startsWith("data:image/") &&
    blur.length <= 4000
  ) {
    result.blur = blur;
  }
  return result;
}

export async function createPost(formData) {
  const supabase = await createClient();
  const user = await requireUser(supabase);
  if (!user) return { success: false, error: "You need to sign in again." };

  const { title, caption, note, tags } = readPostFields(formData);
  const id = String(formData.get("id") ?? "");

  if (!title) return { success: false, error: "Title is required." };
  if (!UUID_RE.test(id)) return { success: false, error: "Missing project id." };

  const beforePath = readUploadedPath(formData, "beforePath", "before", id);
  const afterPath = readUploadedPath(formData, "afterPath", "after", id);
  if (!beforePath) return { success: false, error: "A before image is required." };
  if (!afterPath) return { success: false, error: "An after image is required." };

  const beforeMeta = readImageMetaFields(formData, "before");
  const afterMeta = readImageMetaFields(formData, "after");

  try {
    const { error } = await supabase.from("gallery_projects").insert({
      id,
      title,
      caption: caption || null,
      note: note || null,
      tags,
      before_image_url: publicUrlFor(supabase, beforePath),
      after_image_url: publicUrlFor(supabase, afterPath),
      before_width: beforeMeta.width ?? null,
      before_height: beforeMeta.height ?? null,
      before_blur_data_url: beforeMeta.blur ?? null,
      after_width: afterMeta.width ?? null,
      after_height: afterMeta.height ?? null,
      after_blur_data_url: afterMeta.blur ?? null,
    });
    if (error) throw error;
  } catch (err) {
    await removePaths(supabase, [beforePath, afterPath]);
    return {
      success: false,
      error: err.message || "Could not publish. Please try again.",
    };
  }

  revalidatePath("/gallery");
  revalidatePath("/admin");

  return { success: true };
}

export async function updatePost(formData) {
  const supabase = await createClient();
  const user = await requireUser(supabase);
  if (!user) return { success: false, error: "You need to sign in again." };

  const id = String(formData.get("id") ?? "");
  if (!UUID_RE.test(id)) return { success: false, error: "Missing project id." };

  const { title, caption, note, tags } = readPostFields(formData);
  if (!title) return { success: false, error: "Title is required." };

  const beforePath = readUploadedPath(formData, "beforePath", "before", id);
  const afterPath = readUploadedPath(formData, "afterPath", "after", id);
  if (beforePath === undefined || afterPath === undefined) {
    return { success: false, error: "That image upload wasn't recognised." };
  }

  const updates = { title, caption: caption || null, note: note || null, tags };
  // Metadata travels with its image: only touched when that image slot
  // was actually replaced, and explicitly nulled out (not left as-is) if
  // this particular upload didn't come with usable metadata, so a new
  // photo can never end up paired with a previous photo's stored
  // dimensions or blur placeholder.
  if (beforePath) {
    updates.before_image_url = publicUrlFor(supabase, beforePath);
    const beforeMeta = readImageMetaFields(formData, "before");
    updates.before_width = beforeMeta.width ?? null;
    updates.before_height = beforeMeta.height ?? null;
    updates.before_blur_data_url = beforeMeta.blur ?? null;
  }
  if (afterPath) {
    updates.after_image_url = publicUrlFor(supabase, afterPath);
    const afterMeta = readImageMetaFields(formData, "after");
    updates.after_width = afterMeta.width ?? null;
    updates.after_height = afterMeta.height ?? null;
    updates.after_blur_data_url = afterMeta.blur ?? null;
  }

  // Remember the files being replaced so we can clean them up afterwards.
  let previous = null;
  if (beforePath || afterPath) {
    const { data } = await supabase
      .from("gallery_projects")
      .select("before_image_url, after_image_url")
      .eq("id", id)
      .single();
    previous = data;
  }

  try {
    const { error } = await supabase
      .from("gallery_projects")
      .update(updates)
      .eq("id", id);
    if (error) throw error;
  } catch (err) {
    await removePaths(supabase, [beforePath, afterPath]);
    return {
      success: false,
      error: err.message || "Could not save changes. Please try again.",
    };
  }

  if (previous) {
    await removePaths(supabase, [
      beforePath ? pathFromPublicUrl(previous.before_image_url) : null,
      afterPath ? pathFromPublicUrl(previous.after_image_url) : null,
    ]);
  }

  revalidatePath("/gallery");
  revalidatePath(`/gallery/${id}`);
  revalidatePath("/admin");

  return { success: true };
}

export async function deletePost(id) {
  const supabase = await createClient();
  const user = await requireUser(supabase);
  if (!user) return { success: false, error: "You need to sign in again." };

  const { error } = await supabase
    .from("gallery_projects")
    .delete()
    .eq("id", id);
  if (error) {
    return { success: false, error: "Could not delete. Please try again." };
  }

  // Best-effort storage cleanup, a leftover file in Storage is harmless,
  // but we don't want a failed cleanup to make deletion itself fail.
  try {
    const { data: files } = await supabase.storage.from(BUCKET).list(id);
    if (files?.length) {
      await supabase.storage
        .from(BUCKET)
        .remove(files.map((f) => `${id}/${f.name}`));
    }
  } catch {
    // Ignore, see comment above.
  }

  revalidatePath("/gallery");
  revalidatePath("/admin");

  return { success: true };
}

export async function deleteMessage(id) {
  const supabase = await createClient();
  const user = await requireUser(supabase);
  if (!user) return { success: false, error: "You need to sign in again." };

  const { error } = await supabase.from("messages").delete().eq("id", id);
  if (error) {
    return { success: false, error: "Could not delete. Please try again." };
  }

  revalidatePath("/admin");
  return { success: true };
}
