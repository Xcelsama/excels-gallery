import { cache } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import CompareSlider from "@/components/CompareSlider";
import ShareButton from "@/components/ShareButton";
import StoryViewer from "@/components/StoryViewer";
import { createClient } from "@/lib/supabase/server";
import { ogImageSize, OG_WIDTH } from "@/lib/og";
import { getSiteUrl } from "@/lib/site";
import { formatPublished } from "@/lib/utils";

// generateMetadata and the page both need the post. cache() makes them share
// ONE database query per request instead of running it twice.
const getProject = cache(async (id) => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("gallery_projects")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return data ?? null;
});

export async function generateMetadata({ params }) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) return {};

  const isStory = project.post_type === "story";
  const siteUrl = getSiteUrl();
  const pageUrl = `${siteUrl}/gallery/${id}`;

  // The title template in the root layout appends " | Excel's Gallery" to
  // `title` below, but og:/twitter: tags aren't templated, so they spell out
  // the full string.
  const fullTitle = `${project.title} | Excel's Gallery`;
  const description =
    project.caption ||
    (isStory
      ? "A photo story by Excel Amadi."
      : "A before-and-after Lightroom edit by Excel Amadi.");

  // The preview image is served by ./og.jpg/route.js: a ~1200px, under-300KB
  // copy of the "after" image (a story's first image). The ?v= part changes
  // whenever the post is edited, so chats re-fetch instead of showing a
  // stale picture. It must be an absolute URL.
  const version = Date.parse(project.updated_at ?? project.published_at) || 0;
  const imageUrl = `${siteUrl}/gallery/${id}/og.jpg?v=${version}`;
  const size = ogImageSize(project.after_width, project.after_height);
  const image = {
    url: imageUrl,
    width: size?.width ?? OG_WIDTH,
    ...(size ? { height: size.height } : {}),
    type: "image/jpeg",
    alt: project.title,
  };

  return {
    title: project.title,
    description,
    alternates: { canonical: pageUrl },
    openGraph: {
      type: "article",
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

export default async function ProjectPage({ params }) {
  const { id } = await params;
  const project = await getProject(id);

  if (!project) {
    notFound();
  }

  if (project.post_type === "story") {
    return <StoryPost project={project} />;
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-12 sm:px-8">
      <Link
        href="/gallery"
        className="group inline-flex items-center gap-2 rounded-full border border-line py-1.5 pl-2.5 pr-4 text-sm text-ink-muted transition-colors hover:border-ink-faint hover:text-ink"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="transition-transform duration-200 group-hover:-translate-x-0.5"
        >
          <path d="M19 12H5" />
          <path d="M12 19l-7-7 7-7" />
        </svg>
        Gallery
      </Link>

      <div className="mt-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-3xl text-ink sm:text-4xl">
            {project.title}
          </h1>
          <p className="mt-2 text-sm text-ink-faint">
            {formatPublished(project.published_at)}
          </p>
        </div>
        <div className="pt-1.5">
          <ShareButton title={project.title} path={`/gallery/${project.id}`} />
        </div>
      </div>

      <div className="mt-8">
        <CompareSlider
          before={project.before_image_url}
          after={project.after_image_url}
          title={project.title}
          beforeWidth={project.before_width}
          beforeHeight={project.before_height}
          beforeBlur={project.before_blur_data_url}
          afterWidth={project.after_width}
          afterHeight={project.after_height}
          afterBlur={project.after_blur_data_url}
        />
      </div>

      {(project.caption || project.note || project.tags?.length > 0) && (
        <div className="mt-10 max-w-prose space-y-5">
          {project.caption && (
            <p className="text-lg text-ink">{project.caption}</p>
          )}
          {project.note && (
            <p className="whitespace-pre-line text-sm leading-relaxed text-ink-muted">
              {project.note}
            </p>
          )}
          {project.tags?.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-2">
              {project.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-line px-3 py-1 text-xs text-ink-muted"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </main>
  );
}

// A story post: loads its ordered images (and optional music) and hands them
// to the full-page viewer. Image files live in the public "gallery" bucket
// and the music in "story-audio"; getPublicUrl just builds the address, it
// makes no network call.
async function StoryPost({ project }) {
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("gallery_story_images")
    .select("storage_path, width, height")
    .eq("project_id", project.id)
    .order("sort_order", { ascending: true });

  if (!rows?.length) notFound();

  const images = rows.map((row) => ({
    url: supabase.storage.from("gallery").getPublicUrl(row.storage_path).data
      .publicUrl,
    width: row.width,
    height: row.height,
  }));

  const music = project.audio_path
    ? {
        url: supabase.storage
          .from("story-audio")
          .getPublicUrl(project.audio_path).data.publicUrl,
        volume: Number(project.audio_volume),
        loop: project.audio_loop,
        autoplay: project.audio_autoplay,
      }
    : null;

  return (
    <StoryViewer
      id={project.id}
      title={project.title}
      images={images}
      music={music}
    />
  );
}
