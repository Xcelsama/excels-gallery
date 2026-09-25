import Link from "next/link";
import { notFound } from "next/navigation";
import CompareSlider from "@/components/CompareSlider";
import { createClient } from "@/lib/supabase/server";
import { formatPublished } from "@/lib/utils";

export async function generateMetadata({ params }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: project } = await supabase
    .from("gallery_projects")
    .select("title, caption, after_image_url")
    .eq("id", id)
    .single();

  if (!project) return {};

  // The root layout's title template appends " | Excel's Gallery"
  // automatically, so `title` below stays just the project name. OG/Twitter
  // tags aren't templated the same way, so they spell out the full string.
  const fullTitle = `${project.title} | Excel's Gallery`;
  const description = project.caption ?? undefined;

  return {
    title: project.title,
    description,
    // The "after" shot is the finished result, so it's the one worth
    // showing when this link is shared or unfurled elsewhere.
    openGraph: {
      title: fullTitle,
      description,
      images: project.after_image_url ? [{ url: project.after_image_url }] : [],
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: project.after_image_url ? [project.after_image_url] : [],
    },
  };
}

export default async function ProjectPage({ params }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: project, error } = await supabase
    .from("gallery_projects")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !project) {
    notFound();
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

      <h1 className="mt-4 font-display text-3xl text-ink sm:text-4xl">
        {project.title}
      </h1>
      <p className="mt-2 text-sm text-ink-faint">
        {formatPublished(project.published_at)}
      </p>

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
