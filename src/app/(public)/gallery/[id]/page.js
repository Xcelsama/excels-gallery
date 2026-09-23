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
    .select("title, caption")
    .eq("id", id)
    .single();

  if (!project) return { title: "Excel's Gallery" };
  return {
    title: `${project.title} — Excel's Gallery`,
    description: project.caption ?? undefined,
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
        className="text-sm text-ink-muted transition-colors hover:text-ink"
      >
        ← Gallery
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
