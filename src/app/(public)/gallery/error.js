"use client";

export default function GalleryError({ reset }) {
  return (
    <main className="mx-auto flex max-w-6xl flex-col items-center px-6 py-24 text-center sm:px-8">
      <p className="font-display text-xl text-ink">
        The gallery didn&rsquo;t load
      </p>
      <p className="mt-2 max-w-sm text-sm text-ink-muted">
        Something went wrong reaching the database. Check your connection
        and try again.
      </p>
      <button
        onClick={reset}
        className="mt-6 rounded-full border border-line px-5 py-2 text-sm text-ink transition-colors hover:border-accent/60"
      >
        Try again
      </button>
    </main>
  );
}
