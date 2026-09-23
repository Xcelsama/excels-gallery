import GalleryGrid from "@/components/GalleryGrid";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Gallery | Excel's Gallery",
};

// Data changes only when the admin publishes, not on every request, a
// short revalidation window keeps the gallery fast without going fully
// static and missing new posts for too long.
export const revalidate = 60;

export default async function GalleryPage() {
  const supabase = await createClient();
  const { data: projects, error } = await supabase
    .from("gallery_projects")
    .select(
      "id, title, caption, tags, after_image_url, published_at"
    )
    .order("published_at", { ascending: false });

  if (error) {
    throw new Error("Could not load the gallery. Please try again.");
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-12 sm:px-8">
      <GalleryGrid projects={projects ?? []} />
    </main>
  );
}
