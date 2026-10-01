"use client";

import { useRef, useState } from "react";
import { prepareStoryImage } from "@/lib/imageProcess";
import { MAX_STORY_IMAGES } from "@/lib/storyUpload";

/**
 * The image part of the "Story" post form.
 *
 * `items` lives in AdminPostForm (it needs them at publish time); this
 * component only adds, removes and re-orders them. Each item is:
 *   { key, name, blob, width, height, thumbUrl, blurDataUrl }
 * where `blob` is the already-compressed JPEG that will be uploaded.
 * The order of the array IS the order of the slides; item 1 is the cover.
 */
export default function StoryBuilder({ items, setItems, disabled }) {
  const inputRef = useRef(null);
  const [preparing, setPreparing] = useState(null); // { done, total } | null
  const [message, setMessage] = useState(null);

  async function handleFiles(e) {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = ""; // so picking the same file again still fires onChange
    if (!picked.length) return;

    const room = MAX_STORY_IMAGES - items.length;
    const files = picked.slice(0, Math.max(0, room));
    const notes = [];
    if (picked.length > files.length) {
      notes.push(
        `A story holds up to ${MAX_STORY_IMAGES} images, so ${
          picked.length - files.length
        } were skipped.`
      );
    }

    // One at a time on purpose: decoding several large photos at once can
    // run a phone out of memory.
    const failed = [];
    for (let i = 0; i < files.length; i++) {
      setPreparing({ done: i, total: files.length });
      try {
        const prepared = await prepareStoryImage(files[i]);
        setItems((prev) =>
          prev.length >= MAX_STORY_IMAGES
            ? prev
            : [...prev, { key: crypto.randomUUID(), name: files[i].name, ...prepared }]
        );
      } catch {
        failed.push(files[i].name);
      }
    }
    setPreparing(null);

    if (failed.length) {
      notes.push(`Couldn't read: ${failed.join(", ")}.`);
    }
    setMessage(notes.length ? notes.join(" ") : null);
  }

  function move(index, delta) {
    setItems((prev) => {
      const target = index + delta;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function remove(index) {
    setMessage(null);
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  const busy = disabled || preparing !== null;
  const full = items.length >= MAX_STORY_IMAGES;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="block text-sm text-ink-muted">
          Story images<span className="text-accent"> *</span>
        </span>
        <span className="text-xs tabular-nums text-ink-faint">
          {items.length} / {MAX_STORY_IMAGES}
        </span>
      </div>

      {items.length > 0 && (
        <ol className="mt-2 grid grid-cols-3 gap-2.5 sm:grid-cols-4">
          {items.map((item, i) => (
            <li
              key={item.key}
              className="overflow-hidden rounded-lg border border-line bg-surface"
            >
              <div className="relative aspect-square bg-bg">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.thumbUrl}
                  alt={`Slide ${i + 1}`}
                  className="h-full w-full object-contain"
                />
                <span className="absolute left-1.5 top-1.5 rounded-full bg-black/60 px-2 py-0.5 text-[11px] tabular-nums text-ink">
                  {i + 1}
                </span>
                <button
                  type="button"
                  onClick={() => remove(i)}
                  disabled={busy}
                  aria-label={`Remove slide ${i + 1}`}
                  className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-ink transition-colors hover:bg-danger disabled:opacity-50"
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    aria-hidden="true"
                  >
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              </div>
              <div className="flex items-center justify-between px-1 py-1">
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  disabled={busy || i === 0}
                  aria-label={`Move slide ${i + 1} earlier`}
                  className="flex h-9 w-9 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-surface-raised hover:text-ink disabled:opacity-25"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M15 18l-6-6 6-6" />
                  </svg>
                </button>
                <span className="text-[10px] tabular-nums text-ink-faint">
                  {Math.round(item.blob.size / 1024)} KB
                </span>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  disabled={busy || i === items.length - 1}
                  aria-label={`Move slide ${i + 1} later`}
                  className="flex h-9 w-9 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-surface-raised hover:text-ink disabled:opacity-25"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFiles}
        disabled={busy || full}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy || full}
        className="mt-3 w-full rounded-lg border border-dashed border-line bg-surface px-4 py-5 text-sm text-ink-muted transition-colors hover:border-ink-faint hover:text-ink disabled:opacity-50"
      >
        {preparing
          ? `Preparing images… ${preparing.done + 1} of ${preparing.total}`
          : full
            ? "Story is full"
            : items.length === 0
              ? "Choose images"
              : "Add more images"}
      </button>

      <p className="mt-1.5 text-xs text-ink-faint">
        Slides play in this order; image 1 is the cover. Images are shrunk to
        fit (long side 2048 px) and compressed here, before upload.
      </p>
      {message && <p className="mt-1.5 text-xs text-danger">{message}</p>}
    </div>
  );
}
