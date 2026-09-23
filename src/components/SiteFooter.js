import Link from "next/link";

export default function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-8 text-xs text-ink-faint sm:px-8">
        <p>© {new Date().getFullYear()} Excel&rsquo;s Gallery</p>

        {/* Same discreet pattern as the welcome screen — but here it's on
            every public page, every visit, not just a one-time screen. */}
        <Link
          href="/admin/login"
          aria-label="Admin"
          className="h-2 w-2 rounded-full bg-ink-faint/40 opacity-40 transition-opacity hover:opacity-100 focus-visible:opacity-100"
        />
      </div>
    </footer>
  );
}
