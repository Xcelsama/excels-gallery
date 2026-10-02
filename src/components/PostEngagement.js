"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const VISITOR_KEY = "excels-gallery-visitor";

function makeId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// A random id kept in this browser so one visitor can't love a post twice or
// inflate views by refreshing. If storage is blocked, an id for this page
// load is used instead.
let memoryId = null;
function getVisitorId() {
  try {
    let id = window.localStorage.getItem(VISITOR_KEY);
    if (!id) {
      id = makeId();
      window.localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  } catch {
    memoryId = memoryId ?? makeId();
    return memoryId;
  }
}

function compact(n) {
  return new Intl.NumberFormat("en-US", { notation: "compact" }).format(n);
}

/**
 * Views + love button for one post.
 *  - Opening the post records one view (the database ignores the same
 *    visitor re-opening it within 30 minutes).
 *  - The heart toggles this visitor's love on/off.
 *
 * variant "pill": labelled buttons for the before/after page.
 * variant "icon": compact version for the story viewer's top bar.
 *
 * If migration 0004 hasn't been run yet, the calls fail quietly and the
 * page keeps working.
 */
export default function PostEngagement({
  projectId,
  initialViews = 0,
  initialLoves = 0,
  variant = "pill",
}) {
  const [views, setViews] = useState(initialViews);
  const [loves, setLoves] = useState(initialLoves);
  const [loved, setLoved] = useState(false);
  const [busy, setBusy] = useState(false);
  const recorded = useRef(false);

  useEffect(() => {
    if (recorded.current) return;
    recorded.current = true;

    const supabase = createClient();
    const visitorId = getVisitorId();

    (async () => {
      try {
        await supabase.rpc("record_post_view", {
          p_project_id: projectId,
          p_visitor_id: visitorId,
        });
        const { data } = await supabase.rpc("get_post_stats", {
          p_project_id: projectId,
          p_visitor_id: visitorId,
        });
        const row = Array.isArray(data) ? data[0] : data;
        if (row) {
          setViews(Number(row.view_count));
          setLoves(Number(row.love_count));
          setLoved(Boolean(row.loved));
        }
      } catch {
        // Stats are a nice-to-have; never break the post page over them.
      }
    })();
  }, [projectId]);

  async function toggleLove() {
    if (busy) return;
    setBusy(true);

    const next = !loved;
    // Update the heart straight away, then confirm with the database.
    setLoved(next);
    setLoves((n) => Math.max(0, n + (next ? 1 : -1)));

    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("set_post_love", {
        p_project_id: projectId,
        p_visitor_id: getVisitorId(),
        p_loved: next,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      if (row) {
        setLoves(Number(row.love_count));
        setLoved(Boolean(row.loved));
      }
    } catch {
      setLoved(!next);
      setLoves((n) => Math.max(0, n + (next ? -1 : 1)));
    } finally {
      setBusy(false);
    }
  }

  const heart = (size) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={loved ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21.2l7.8-7.7 1-1.1a5.5 5.5 0 0 0 0-7.8z" />
    </svg>
  );

  const eye = (size) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );

  const loveLabel = loved ? "Remove your love" : "Love this post";

  if (variant === "icon") {
    return (
      <div className="flex items-center">
        <span
          className="flex items-center gap-1 px-2 text-xs tabular-nums text-ink-faint"
          title={`${views} views`}
        >
          {eye(16)}
          {compact(views)}
        </span>
        <button
          type="button"
          onClick={toggleLove}
          aria-pressed={loved}
          aria-label={loveLabel}
          className={
            "flex h-10 items-center gap-1 rounded-full px-2.5 text-sm tabular-nums transition-colors hover:bg-surface-raised " +
            (loved ? "text-danger" : "text-ink-muted hover:text-ink")
          }
        >
          {heart(18)}
          <span>{compact(loves)}</span>
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span
        className="inline-flex items-center gap-1.5 px-1 text-sm tabular-nums text-ink-faint"
        title={`${views} views`}
      >
        {eye(16)}
        {compact(views)}
        <span className="sr-only"> views</span>
      </span>
      <button
        type="button"
        onClick={toggleLove}
        aria-pressed={loved}
        aria-label={loveLabel}
        className={
          "inline-flex shrink-0 items-center gap-2 rounded-full border py-1.5 pl-3.5 pr-4 text-sm tabular-nums transition-colors " +
          (loved
            ? "border-danger text-danger"
            : "border-line text-ink-muted hover:border-ink-faint hover:text-ink")
        }
      >
        {heart(18)}
        <span>{compact(loves)}</span>
      </button>
    </div>
  );
}
