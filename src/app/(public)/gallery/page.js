import { createClient as createPublicClient } from "@supabase/supabase-js";
import GalleryGrid from "@/components/GalleryGrid";
import { createClient } from "@/lib/supabase/server";
import { ogImageSize, OG_WIDTH } from "@/lib/og";
import { getSiteUrl } from "@/lib/site";

// Link preview for the plain /gallery link (WhatsApp, iMessage, X...). The
// picture is the newest post's image, served by ./og.jpg/route.js. If the
// gallery is empty, or the lookup fails, the page simply has no preview image.
export async function generateMetadata() {
  const siteUrl = getSiteUrl();
  const pageUrl = `${siteUrl}/gallery`;
  const description =
    "Before-and-after Lightroom Mobile edits by Excel Amadi: a study in light, color, and composition.";

  let latest = null;
  try {
    const supabase = createPublicClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
    const { data } = await supabase
      .from("gallery_projects")
      .select("after_width, after_height, published_at, updated_at")
      .order("published_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    latest = data ?? null;
  } catch {
    latest = null;
  }

  const fullTitle = "Gallery | Excel's Gallery";
  const base = {
    title: "Gallery",
    description,
    alternates: { canonical: pageUrl },
  };

  if (!latest) {
    return {
      ...base,
      openGraph: {
        type: "website",
        url: pageUrl,
        siteName: "Excel's Gallery",
        title: fullTitle,
        description,
      },
    };
  }

  // ?v= changes whenever the newest post changes, so chats re-fetch the image.
  const version =
    Date.parse(latest.updated_at ?? latest.published_at) || 0;
  const imageUrl = `${siteUrl}/gallery/og.jpg?v=${version}`;
  const size = ogImageSize(latest.after_width, latest.after_height);
  const image = {
    url: imageUrl,
    width: size?.width ?? OG_WIDTH,
    ...(size ? { height: size.height } : {}),
    type: "image/jpeg",
    alt: "Excel's Gallery",
  };

  return {
    ...base,
    openGraph: {
      type: "website",
      url: pageUrl,
      siteName: "Excel's Gallery",
      title: fullTitle,
      description,
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: [imageUrl],
    },
  };
}

// Data changes only when the admin publishes, not on every request, a
// short revalidation window keeps the gallery fast without going fully
// static and missing new posts for too long.
export const revalidate = 60;

export default async function GalleryPage() {
  const supabase = await createClient();
  const { data: projects, error } = await supabase
    .from("gallery_projects")
    .select(
      "id, title, caption, tags, post_type, after_image_url, after_width, after_height, after_blur_data_url, published_at"
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
