"use client";

import { useEffect, useRef, useState } from "react";
import { createPost, updatePost } from "@/app/admin/actions";
import { createClient } from "@/lib/supabase/client";

const BUCKET = "gallery";

// Supabase's Free plan caps a single file at 50 MB. Staying well under that
// gives a friendly message here instead of a raw storage error.
const MAX_FILE_MB = 25;
const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;

function SubmitButton({ pending, label, pendingLabel }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-full border border-accent/40 bg-accent-soft px-8 py-3 text-sm font-medium text-ink transition-colors hover:border-accent hover:bg-accent/20 disabled:opacity-50"
    >
      {pending ? pendingLabel : label}
    </button>
  );
}

function ImagePicker({ name, label, initialUrl, required }) {
  const [previewUrl, setPreviewUrl] = useState(initialUrl ?? null);
  const [fileInfo, setFileInfo] = useState(null);
  const objectUrlRef = useRef(null);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  function handleChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    setPreviewUrl(url);
    setFileInfo(`${(file.size / 1024 / 1024).toFixed(1)} MB`);
  }

  return (
    <label className="block cursor-pointer">
      <span className="block text-sm text-ink-muted">
        {label}
        {required && <span className="text-accent"> *</span>}
      </span>
      <div className="mt-1.5 flex aspect-[4/3] items-center justify-center overflow-hidden rounded-lg border border-dashed border-line bg-surface">
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="text-xs text-ink-faint">Click to choose a file</span>
        )}
      </div>
      {fileInfo && (
        <span className="mt-1 block text-xs text-ink-faint">{fileInfo}</span>
      )}
      <input
        type="file"
        name={name}
        accept="image/*"
        onChange={handleChange}
        className="sr-only"
      />
    </label>
  );
}

function isRealFile(value) {
  return value instanceof File && value.size > 0;
}

function extFromFile(file) {
  const fromName = file.name?.split(".").pop()?.toLowerCase() ?? "";
  const fromType = file.type?.split("/").pop()?.toLowerCase() ?? "";
  const ext = (fromName.length <= 5 ? fromName : fromType).replace(
    /[^a-z0-9]/g,
    ""
  );
  return ext || "jpg";
}

function checkImage(file, label) {
  if (!file.type.startsWith("image/")) {
    return `The ${label} file needs to be an image.`;
  }
  if (file.size > MAX_FILE_BYTES) {
    const mb = (file.size / 1024 / 1024).toFixed(1);
    return `The ${label} image is ${mb} MB. The limit is ${MAX_FILE_MB} MB.`;
  }
  return null;
}

function loadImageElement(objectUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // naturalWidth/naturalHeight (and drawing this element to a canvas,
    // below) both reflect the orientation the browser actually displays,
    // EXIF rotation included, unlike some lower-level decode APIs. That
    // matters here: getting this wrong would silently swap width/height
    // for portrait photos and reintroduce the exact layout-shift bug this
    // is meant to fix.
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not read the image file."));
    img.src = objectUrl;
  });
}

// Reads a photo's intrinsic pixel size plus a tiny (~16px-wide) blurred
// JPEG preview, entirely client-side, no upload or network round trip.
// Both get stored alongside the project so the public site can render
// with next/image: a reserved aspect ratio (no layout shift while a large
// photo loads) and a blur-up placeholder instead of a blank box.
async function readImageMeta(file) {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await loadImageElement(objectUrl);
    const width = img.naturalWidth;
    const height = img.naturalHeight;
    if (!width || !height) return null;

    const targetWidth = 16;
    const targetHeight = Math.max(1, Math.round((height / width) * targetWidth));
    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
    const blurDataUrl = canvas.toDataURL("image/jpeg", 0.5);

    return { width, height, blurDataUrl };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

// Straight from the browser to Supabase Storage. The file never passes
// through a Vercel function, so Vercel's 4.5 MB request limit doesn't apply.
// Each upload gets a unique name so a replaced image is never served stale
// from a cache.
async function uploadToStorage(supabase, projectId, slot, file) {
  const path = `${projectId}/${slot}-${Date.now()}.${extFromFile(file)}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
    cacheControl: "31536000",
  });
  if (error) {
    throw new Error(`Could not upload the ${slot} image (${error.message}).`);
  }
  return path;
}

async function removeFromStorage(supabase, paths) {
  if (!paths.length) return;
  try {
    await supabase.storage.from(BUCKET).remove(paths);
  } catch {
    // Best effort only. A leftover file is harmless.
  }
}

export default function AdminPostForm({ mode = "create", project = null, onDone }) {
  const isEdit = mode === "edit";
  const [stage, setStage] = useState(null); // null | "uploading" | "saving"
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [tags, setTags] = useState(project?.tags?.join(", ") ?? "");
  const [title, setTitle] = useState(project?.title ?? "");
  const [pickerKey, setPickerKey] = useState(0);
  const formRef = useRef(null);
  const pending = stage !== null;

  async function handleSubmit(e) {
    e.preventDefault();
    if (pending) return;

    // Read everything from the form before the first await.
    const formData = new FormData(e.currentTarget);
    const cleanTitle = String(formData.get("title") ?? "").trim();
    const beforeFile = formData.get("beforeImage");
    const afterFile = formData.get("afterImage");
    const hasBefore = isRealFile(beforeFile);
    const hasAfter = isRealFile(afterFile);

    setError(null);
    setNotice(null);

    // Validate everything up front so we never upload files for a post
    // that was going to be rejected anyway.
    if (!cleanTitle) return setError("Title is required.");
    if (!isEdit && !hasBefore) return setError("A before image is required.");
    if (!isEdit && !hasAfter) return setError("An after image is required.");
    const problem =
      (hasBefore && checkImage(beforeFile, "before")) ||
      (hasAfter && checkImage(afterFile, "after"));
    if (problem) return setError(problem);

    const id = isEdit ? String(formData.get("id") ?? "") : crypto.randomUUID();
    if (!id) return setError("Missing project id.");

    // Best-effort: read each new file's dimensions + blur placeholder
    // before uploading. If a particular file can't be read this way for
    // any reason, meta stays null and that image just falls back to the
    // original unoptimized rendering rather than blocking the publish.
    const [beforeMeta, afterMeta] = await Promise.all([
      hasBefore ? readImageMeta(beforeFile).catch(() => null) : null,
      hasAfter ? readImageMeta(afterFile).catch(() => null) : null,
    ]);

    // The server only ever receives small text fields plus the storage
    // paths of the files we uploaded. Never the files themselves.
    const payload = new FormData();
    for (const [key, value] of formData.entries()) {
      if (!(value instanceof File)) payload.append(key, value);
    }
    payload.set("id", id);
    if (beforeMeta) {
      payload.set("beforeWidth", String(beforeMeta.width));
      payload.set("beforeHeight", String(beforeMeta.height));
      payload.set("beforeBlur", beforeMeta.blurDataUrl);
    }
    if (afterMeta) {
      payload.set("afterWidth", String(afterMeta.width));
      payload.set("afterHeight", String(afterMeta.height));
      payload.set("afterBlur", afterMeta.blurDataUrl);
    }

    const supabase = createClient();
    const uploadedPaths = [];

    try {
      setStage("uploading");
      const jobs = [];
      if (hasBefore) jobs.push(["beforePath", "before", beforeFile]);
      if (hasAfter) jobs.push(["afterPath", "after", afterFile]);

      const results = await Promise.allSettled(
        jobs.map(([, slot, file]) => uploadToStorage(supabase, id, slot, file))
      );

      let firstFailure = null;
      results.forEach((result, i) => {
        if (result.status === "fulfilled") {
          uploadedPaths.push(result.value);
          payload.set(jobs[i][0], result.value);
        } else if (!firstFailure) {
          firstFailure = result.reason;
        }
      });
      if (firstFailure) throw firstFailure;

      setStage("saving");
      const result = await (isEdit ? updatePost(payload) : createPost(payload));
      if (!result.success) throw new Error(result.error);

      if (isEdit) {
        onDone?.();
      } else {
        formRef.current?.reset();
        setTitle("");
        setTags("");
        setShowPreview(false);
        setPickerKey((k) => k + 1);
        setNotice("Published. It is live in the gallery now.");
      }
    } catch (err) {
      // Don't leave orphaned uploads behind when the post didn't save.
      await removeFromStorage(supabase, uploadedPaths);
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setStage(null);
    }
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
      {isEdit && <input type="hidden" name="id" value={project.id} />}

      <div>
        <label htmlFor="title" className="block text-sm text-ink-muted">
          Title
        </label>
        <input
          id="title"
          name="title"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mt-1.5 w-full rounded-lg border border-line bg-surface px-4 py-2.5 text-ink"
        />
      </div>

      <div>
        <label htmlFor="caption" className="block text-sm text-ink-muted">
          Caption
        </label>
        <input
          id="caption"
          name="caption"
          defaultValue={project?.caption ?? ""}
          className="mt-1.5 w-full rounded-lg border border-line bg-surface px-4 py-2.5 text-ink"
        />
      </div>

      <div>
        <label htmlFor="note" className="block text-sm text-ink-muted">
          Notes
        </label>
        <textarea
          id="note"
          name="note"
          rows={4}
          defaultValue={project?.note ?? ""}
          className="mt-1.5 w-full resize-y rounded-lg border border-line bg-surface px-4 py-2.5 text-ink"
        />
      </div>

      <div>
        <label htmlFor="tags" className="block text-sm text-ink-muted">
          Tags
        </label>
        <input
          id="tags"
          name="tags"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="portrait, golden hour, moody"
          className="mt-1.5 w-full rounded-lg border border-line bg-surface px-4 py-2.5 text-ink placeholder:text-ink-faint"
        />
        <p className="mt-1 text-xs text-ink-faint">Comma-separated.</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <ImagePicker
          key={`before-${pickerKey}`}
          name="beforeImage"
          label="Before image"
          initialUrl={project?.before_image_url}
          required={!isEdit}
        />
        <ImagePicker
          key={`after-${pickerKey}`}
          name="afterImage"
          label="After image"
          initialUrl={project?.after_image_url}
          required={!isEdit}
        />
      </div>
      <p className="-mt-3 text-xs text-ink-faint">
        Up to {MAX_FILE_MB} MB per image.
        {isEdit && " Leave an image untouched to keep the current file."}
      </p>

      {error && <p className="text-sm text-danger">{error}</p>}
      {notice && <p className="text-sm text-ink-muted">{notice}</p>}

      <div className="flex items-center gap-3">
        <SubmitButton
          pending={pending}
          label={isEdit ? "Save changes" : "Publish"}
          pendingLabel={
            stage === "uploading"
              ? "Uploading images…"
              : isEdit
                ? "Saving…"
                : "Publishing…"
          }
        />
        <button
          type="button"
          onClick={() => setShowPreview((v) => !v)}
          className="rounded-full border border-line px-6 py-3 text-sm text-ink-muted transition-colors hover:text-ink"
        >
          {showPreview ? "Hide preview" : "Preview"}
        </button>
        {isEdit && (
          <button
            type="button"
            onClick={onDone}
            className="text-sm text-ink-faint transition-colors hover:text-ink"
          >
            Cancel
          </button>
        )}
      </div>

      {showPreview && (
        <div className="rounded-lg border border-line bg-surface p-5">
          <p className="font-display text-xl text-ink">
            {title || "Untitled edit"}
          </p>
          {tags && (
            <div className="mt-2 flex flex-wrap gap-2">
              {tags
                .split(",")
                .map((t) => t.trim())
                .filter(Boolean)
                .map((t) => (
                  <span
                    key={t}
                    className="rounded-full border border-line px-3 py-1 text-xs text-ink-muted"
                  >
                    {t}
                  </span>
                ))}
            </div>
          )}
          <p className="mt-3 text-xs text-ink-faint">
            This is a rough preview from your local files. The published page
            lays the before/after pair out full width.
          </p>
        </div>
      )}
    </form>
  );
}
