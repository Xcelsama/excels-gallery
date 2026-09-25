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
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5 sm:px-8 sm:py-5">
        <Link
          href="/gallery"
          className="font-display text-base tracking-tight text-ink sm:text-lg"
        >
          Excel&rsquo;s Gallery
        </Link>
        <nav className="flex items-center gap-3.5 text-xs sm:gap-6 sm:text-sm">
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
