"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Share this post's link.
 *  1. Phones and some desktops: opens the system share sheet (WhatsApp, etc.)
 *     through the Web Share API.
 *  2. Everywhere else, or if that fails: copies the link and says so.
 *  3. If even copying is blocked: shows the link in a prompt to copy by hand.
 *
 * `path` is the post's path (e.g. "/gallery/<id>"). It is turned into a full
 * link with the current origin, so it always matches the site being viewed.
 *
 * variant "pill": a labelled button (before/after page).
 * variant "icon": a round icon button (story viewer's top bar).
 */
export default function ShareButton({ title, path, variant = "pill" }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  function flashCopied() {
    setCopied(true);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCopied(false), 2000);
  }

  async function handleShare() {
    const url = new URL(path, window.location.origin).toString();

    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title, url });
        return;
      } catch (err) {
        // Closing the share sheet isn't an error, so do nothing.
        if (err?.name === "AbortError") return;
        // Anything else: fall through to copying the link instead.
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      flashCopied();
    } catch {
      window.prompt("Copy this link", url);
    }
  }

  const icon = (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" />
      <path d="M16 6l-4-4-4 4" />
      <path d="M12 2v13" />
    </svg>
  );

  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={handleShare}
        aria-label={copied ? "Link copied" : "Share this story"}
        title={copied ? "Link copied" : "Share"}
        className="relative flex h-10 w-10 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-surface-raised hover:text-ink"
      >
        {copied ? (
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M5 12l5 5L20 7" />
          </svg>
        ) : (
          icon
        )}
        <span className="sr-only" role="status">
          {copied ? "Link copied" : ""}
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleShare}
      className="inline-flex shrink-0 items-center gap-2 rounded-full border border-line py-1.5 pl-3.5 pr-4 text-sm text-ink-muted transition-colors hover:border-ink-faint hover:text-ink"
    >
      {icon}
      <span>{copied ? "Link copied" : "Share"}</span>
      <span className="sr-only" role="status">
        {copied ? "Link copied" : ""}
      </span>
    </button>
  );
}
