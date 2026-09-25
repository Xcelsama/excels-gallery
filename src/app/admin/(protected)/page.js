import { Suspense } from "react";
import AdminPostForm from "@/components/AdminPostForm";
import AdminPostList from "@/components/AdminPostList";
import AdminMessages from "@/components/AdminMessages";
import AdminAnalytics from "@/components/AdminAnalytics";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Studio" };

export default async function AdminDashboardPage() {
  const supabase = await createClient();

  const [{ data: projects }, { data: messages }] = await Promise.all([
    supabase
      .from("gallery_projects")
      .select("*")
      .order("published_at", { ascending: false }),
    supabase
      .from("messages")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  return (
    <div className="space-y-16">
      {/* Primary: this is what the dashboard is for. */}
      <section>
        <h1 className="font-display text-2xl text-ink">Create new post</h1>
        <p className="mt-1 text-sm text-ink-muted">
          A before and an after image are both required to publish.
        </p>
        <div className="mt-6">
          <AdminPostForm mode="create" />
        </div>
      </section>

      {/* Secondary: management, kept simple and out of the way. */}
      <section>
        <h2 className="font-display text-xl text-ink">Your posts</h2>
        <div className="mt-6">
          <AdminPostList projects={projects ?? []} />
        </div>
      </section>

      <section>
        <h2 className="font-display text-xl text-ink">Messages</h2>
        <div className="mt-6">
          <AdminMessages messages={messages ?? []} />
        </div>
      </section>

      <section>
        <h2 className="font-display text-xl text-ink">Analytics</h2>
        <p className="mt-1 text-sm text-ink-muted">
          From Vercel Web Analytics.
        </p>
        <div className="mt-6">
          <Suspense
            fallback={
              <p className="text-sm text-ink-faint">Loading analytics…</p>
            }
          >
            <AdminAnalytics />
          </Suspense>
        </div>
      </section>
    </div>
  );
}
