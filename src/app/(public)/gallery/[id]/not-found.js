import Link from "next/link";

export default function ProjectNotFound() {
  return (
    <main className="mx-auto flex max-w-5xl flex-col items-center px-6 py-24 text-center sm:px-8">
      <p className="font-display text-xl text-ink">Project not found</p>
      <p className="mt-2 max-w-sm text-sm text-ink-muted">
        This edit may have been removed or the link is incorrect.
      </p>
      <Link
        href="/gallery"
        className="mt-6 rounded-full border border-line px-5 py-2 text-sm text-ink transition-colors hover:border-accent/60"
      >
        Back to gallery
      </Link>
    </main>
  );
}
