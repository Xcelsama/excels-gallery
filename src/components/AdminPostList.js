"use client";

import { useState } from "react";
import Image from "next/image";
import { deletePost } from "@/app/admin/actions";
import AdminPostForm from "@/components/AdminPostForm";
import { formatPublished } from "@/lib/utils";

export default function AdminPostList({ projects }) {
  const [editingId, setEditingId] = useState(null);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);

  async function handleDelete(id, title) {
    if (!window.confirm(`Delete "${title}"? This can't be undone.`)) return;
    setPendingDeleteId(id);
    await deletePost(id);
    setPendingDeleteId(null);
  }

  if (projects.length === 0) {
    return <p className="text-sm text-ink-faint">Nothing published yet.</p>;
  }

  return (
    <ul className="divide-y divide-line">
      {projects.map((project) => (
        <li key={project.id} className="py-5 first:pt-0">
          {editingId === project.id ? (
            <div className="rounded-lg border border-line bg-surface p-5">
              <AdminPostForm
                mode="edit"
                project={project}
                onDone={() => setEditingId(null)}
              />
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md bg-surface">
                <Image
                  src={project.after_image_url}
                  alt=""
                  fill
                  sizes="64px"
                  className="object-cover"
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-ink">{project.title}</p>
                <p className="text-xs text-ink-faint">
                  {formatPublished(project.published_at)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-4 text-sm">
                <button
                  onClick={() => setEditingId(project.id)}
                  className="text-ink-muted transition-colors hover:text-ink"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(project.id, project.title)}
                  disabled={pendingDeleteId === project.id}
                  className="text-danger transition-opacity hover:opacity-80 disabled:opacity-50"
                >
                  {pendingDeleteId === project.id ? "Deleting…" : "Delete"}
                </button>
              </div>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
