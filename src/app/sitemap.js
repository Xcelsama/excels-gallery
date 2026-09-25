import { createClient } from "@/lib/supabase/server";

// Next.js App Router convention: this file becomes /sitemap.xml
// automatically, no route handler needed.
//
// Every row in gallery_projects is public the moment it's created (see
// the RLS policy in 0001_init.sql, there's no draft/unpublished state in
// this schema), so no extra filtering is needed here beyond what the
// public site already shows.
export default async function sitemap() {
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000");

  const staticRoutes = ["", "/gallery", "/about", "/message"].map((path) => ({
    url: `${siteUrl}${path}`,
    changeFrequency: path === "/gallery" ? "daily" : "monthly",
    priority: path === "" || path === "/gallery" ? 1 : 0.5,
  }));

  const supabase = await createClient();
  const { data: projects } = await supabase
    .from("gallery_projects")
    .select("id, published_at, updated_at")
    .order("published_at", { ascending: false });

  const projectRoutes = (projects ?? []).map((project) => ({
    url: `${siteUrl}/gallery/${project.id}`,
    lastModified: project.updated_at ?? project.published_at ?? undefined,
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  return [...staticRoutes, ...projectRoutes];
}
