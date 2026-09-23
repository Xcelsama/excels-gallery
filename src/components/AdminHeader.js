"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AdminHeader() {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.refresh();
    router.push("/admin/login");
  }

  return (
    <header className="border-b border-line">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-5 sm:px-8">
        <div>
          <Link href="/admin" className="font-display text-lg text-ink">
            Excel&rsquo;s Gallery
          </Link>
          <span className="ml-2 text-xs text-ink-faint">Studio</span>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <Link
            href="/gallery"
            target="_blank"
            className="text-ink-muted transition-colors hover:text-ink"
          >
            View site
          </Link>
          <button
            onClick={handleSignOut}
            className="text-ink-muted transition-colors hover:text-ink"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
