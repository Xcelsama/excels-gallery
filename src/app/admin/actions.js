"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parseTagsInput } from "@/lib/utils";

const BUCKET = "gallery";

function extFromFile(file) {
  const fromName = file.name?.split(".").pop();
  if (fromName && fromName.length <= 5) return fromName.toLowerCase();
  const fromType = file.type?.split("/").pop();
  return fromType || "jpg";
}

async function requireUser(supabase) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

async function uploadImage(supabase, projectId, slot, file) {
  const path = `${projectId}/${slot}.${extFromFile(file)}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: true });
  if (error) throw new Error(`Could not upload the ${slot} image.`);

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return publicUrl;
}

function readPostFields(formData) {
  const title = String(formData.get("title") ?? "").trim();
  const caption = String(formData.get("caption") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();
  const tags = parseTagsInput(String(formData.get("tags") ?? ""));
  return { title, caption, note, tags };
}

export async function createPost(prevState, formData) {
  const supabase = await createClient();
  const user = await requireUser(supabase);
  if (!user) return { success: false, error: "You need to sign in again." };

  const { title, caption, note, tags } = readPostFields(formData);
  const beforeFile = formData.get("beforeImage");
  const afterFile = formData.get("afterImage");

  if (!title) return { success: false, error: "Title is required." };
  if (!(beforeFile instanceof File) || beforeFile.size === 0) {
    return { success: false, error: "A before image is required." };
  }
  if (!(afterFile instanceof File) || afterFile.size === 0) {
    return { success: false, error: "An after image is required." };
  }

  const id = randomUUID();

  try {
    const [beforeUrl, afterUrl] = await Promise.all([
      uploadImage(supabase, id, "before", beforeFile),
      uploadImage(supabase, id, "after", afterFile),
    ]);

    const { error } = await supabase.from("gallery_projects").insert({
      id,
      title,
      caption: caption || null,
      note: note || null,
      tags,
      before_image_url: beforeUrl,
      after_image_url: afterUrl,
    });
    if (error) throw error;
  } catch (err) {
    return {
      success: false,
      error: err.message || "Could not publish. Please try again.",
    };
  }

  revalidatePath("/gallery");
  revalidatePath("/admin");

  return { success: true };
}

export async function updatePost(prevState, formData) {
  const supabase = await createClient();
  const user = await requireUser(supabase);
  if (!user) return { success: false, error: "You need to sign in again." };

  const id = String(formData.get("id") ?? "");
  if (!id) return { success: false, error: "Missing project id." };

  const { title, caption, note, tags } = readPostFields(formData);
  if (!title) return { success: false, error: "Title is required." };

  const updates = { title, caption: caption || null, note: note || null, tags };

  const beforeFile = formData.get("beforeImage");
  const afterFile = formData.get("afterImage");

  try {
    if (beforeFile instanceof File && beforeFile.size > 0) {
      updates.before_image_url = await uploadImage(
        supabase,
        id,
        "before",
        beforeFile
      );
    }
    if (afterFile instanceof File && afterFile.size > 0) {
      updates.after_image_url = await uploadImage(
        supabase,
        id,
        "after",
        afterFile
      );
    }

    const { error } = await supabase
      .from("gallery_projects")
      .update(updates)
      .eq("id", id);
    if (error) throw error;
  } catch (err) {
    return {
      success: false,
      error: err.message || "Could not save changes. Please try again.",
    };
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

  // Best-effort storage cleanup — a leftover file in Storage is harmless,
  // but we don't want a failed cleanup to make deletion itself fail.
  try {
    const { data: files } = await supabase.storage.from(BUCKET).list(id);
    if (files?.length) {
      await supabase.storage
        .from(BUCKET)
        .remove(files.map((f) => `${id}/${f.name}`));
    }
  } catch {
    // Ignore — see comment above.
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
