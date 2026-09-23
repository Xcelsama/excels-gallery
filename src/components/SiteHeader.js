"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/gallery", label: "Gallery" },
  { href: "/about", label: "About" },
  { href: "/message", label: "Message" },
];

export default function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="border-b border-line">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5 sm:px-8">
        <Link
          href="/gallery"
          className="font-display text-lg tracking-tight text-ink"
        >
          Excel&rsquo;s Gallery
        </Link>
        <nav className="flex items-center gap-6 text-sm">
          {links.map((link) => {
            const isActive = pathname?.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={
                  "relative py-1 transition-colors " +
                  (isActive
                    ? "text-ink"
                    : "text-ink-muted hover:text-ink")
                }
              >
                {link.label}
                {isActive && (
                  <span className="absolute -bottom-[1px] left-0 right-0 h-px bg-accent" />
                )}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
