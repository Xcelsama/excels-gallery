"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const STORAGE_KEY = "excels-gallery:visited";

export default function WelcomeGate() {
  const router = useRouter();
  // null = still checking localStorage, false = show welcome, true = skip it
  const [hasVisited, setHasVisited] = useState(null);

  useEffect(() => {
    let visited = false;
    try {
      visited = window.localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      // Storage can be unavailable (private mode, disabled cookies, etc.);
      // fall back to showing the welcome screen every time rather than
      // breaking the page.
    }

    if (visited) {
      router.replace("/gallery");
    } else {
      setHasVisited(false);
    }
  }, [router]);

  function handleContinue() {
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // If storage isn't available, the visitor will just see the welcome
      // screen again next time, not ideal, but not a broken experience.
    }
    router.push("/gallery");
  }

  // Returning visitor: render nothing while the redirect above kicks in,
  // instead of flashing the welcome screen first.
  if (hasVisited === null) {
    return <div className="min-h-dvh bg-bg" />;
  }

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-bg px-6 text-center">
      <div className="grain" />
      <div className="relative z-10 animate-fade-in">
        <h1 className="font-display text-4xl italic text-ink sm:text-5xl">
          Excel&rsquo;s Gallery
        </h1>
        <p className="mt-4 max-w-sm text-balance text-ink-muted">
          Before-and-after Lightroom edits: light, color, and composition,
          worked through one photograph at a time.
        </p>
        <button
          onClick={handleContinue}
          className="mt-10 rounded-full bg-accent px-8 py-3 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover"
        >
          Continue
        </button>
      </div>

      {/* Discreet admin entry point: a small, low-visibility corner mark
          rather than a labeled nav item. Still a real, focusable link for
          keyboard and screen-reader use, just not visually advertised. */}
      <Link
        href="/admin/login"
        aria-label="Admin"
        className="absolute bottom-5 right-5 h-3 w-3 rounded-full bg-ink-faint/40 opacity-40 transition-opacity hover:opacity-100 focus-visible:opacity-100"
      />
    </div>
  );
}
