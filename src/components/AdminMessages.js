"use client";

import { useState } from "react";
import { deleteMessage } from "@/app/admin/actions";
import { formatPublished } from "@/lib/utils";

export default function AdminMessages({ messages }) {
  const [pendingId, setPendingId] = useState(null);

  async function handleDelete(id) {
    setPendingId(id);
    await deleteMessage(id);
    setPendingId(null);
  }

  if (messages.length === 0) {
    return <p className="text-sm text-ink-faint">No messages yet.</p>;
  }

  return (
    <ul className="divide-y divide-line">
      {messages.map((msg) => (
        <li key={msg.id} className="py-4 first:pt-0">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm text-ink">
                {msg.name}{" "}
                <span className="text-ink-faint">&lt;{msg.email}&gt;</span>
              </p>
              <p className="mt-1 whitespace-pre-line text-sm text-ink-muted">
                {msg.message}
              </p>
              <p className="mt-1 text-xs text-ink-faint">
                {formatPublished(msg.created_at)}
              </p>
            </div>
            <button
              onClick={() => handleDelete(msg.id)}
              disabled={pendingId === msg.id}
              className="shrink-0 text-xs text-danger transition-opacity hover:opacity-80 disabled:opacity-50"
            >
              {pendingId === msg.id ? "Deleting…" : "Delete"}
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
