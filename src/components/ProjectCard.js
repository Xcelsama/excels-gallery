import Image from "next/image";
import Link from "next/link";
import { formatPublished } from "@/lib/utils";

export default function ProjectCard({ project, priority = false }) {
  return (
    <Link href={`/gallery/${project.id}`} className="group block">
      <div className="relative aspect-[4/5] overflow-hidden rounded-sm bg-surface ring-1 ring-inset ring-line transition-shadow duration-300 group-hover:ring-accent/40">
        <Image
          src={project.after_image_url}
          alt={project.title}
          fill
          sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 90vw"
          quality={80}
          priority={priority}
          className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
          {...(project.after_blur_data_url
            ? { placeholder: "blur", blurDataURL: project.after_blur_data_url }
            : {})}
        />
        {/* Subtle top-down scrim so the badge sits on the image, not
            behind a generic blurred pill — reads as part of the photo. */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/50 to-transparent" />
        <span className="absolute left-3 top-3 text-[10px] font-medium uppercase tracking-[0.14em] text-ink/90">
          After
        </span>
      </div>

      <div className="mt-3.5">
        <p className="text-[11px] uppercase tracking-[0.12em] text-ink-faint">
          {formatPublished(project.published_at)}
        </p>
        <h3 className="mt-1 font-display text-lg text-ink transition-colors duration-200 group-hover:text-accent">
          {project.title}
        </h3>
        {project.tags?.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-x-2 gap-y-1">
            {project.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="text-xs text-ink-muted">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}
