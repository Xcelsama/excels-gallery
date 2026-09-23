"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { createPost, updatePost } from "@/app/admin/actions";

const initialState = { success: false, error: null };

function SubmitButton({ label, pendingLabel }) {
  const { pending } = useFormStatus();
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

export default function AdminPostForm({ mode = "create", project = null, onDone }) {
  const action = mode === "edit" ? updatePost : createPost;
  const [state, formAction] = useActionState(action, initialState);
  const [showPreview, setShowPreview] = useState(false);
  const [tags, setTags] = useState(project?.tags?.join(", ") ?? "");
  const [title, setTitle] = useState(project?.title ?? "");
  const formRef = useRef(null);

  useEffect(() => {
    if (state.success) {
      if (mode === "create") {
        formRef.current?.reset();
        setTitle("");
        setTags("");
        setShowPreview(false);
      } else {
        onDone?.();
      }
    }
  }, [state.success, mode, onDone]);

  return (
    <form ref={formRef} action={formAction} className="space-y-6">
      {mode === "edit" && (
        <input type="hidden" name="id" value={project.id} />
      )}

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
          name="beforeImage"
          label="Before image"
          initialUrl={project?.before_image_url}
          required={mode === "create"}
        />
        <ImagePicker
          name="afterImage"
          label="After image"
          initialUrl={project?.after_image_url}
          required={mode === "create"}
        />
      </div>
      {mode === "edit" && (
        <p className="-mt-3 text-xs text-ink-faint">
          Leave an image untouched to keep the current file.
        </p>
      )}

      {state.error && <p className="text-sm text-danger">{state.error}</p>}

      <div className="flex items-center gap-3">
        <SubmitButton
          label={mode === "edit" ? "Save changes" : "Publish"}
          pendingLabel={mode === "edit" ? "Saving…" : "Publishing…"}
        />
        <button
          type="button"
          onClick={() => setShowPreview((v) => !v)}
          className="rounded-full border border-line px-6 py-3 text-sm text-ink-muted transition-colors hover:text-ink"
        >
          {showPreview ? "Hide preview" : "Preview"}
        </button>
        {mode === "edit" && (
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
            This is a rough preview from your local files — the published
            page lays the before/after pair out full width.
          </p>
        </div>
      )}
    </form>
  );
}
