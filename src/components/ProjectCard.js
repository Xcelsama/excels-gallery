import Image from "next/image";
import Link from "next/link";
import { formatPublished } from "@/lib/utils";

export default function ProjectCard({ project, priority = false }) {
  return (
    <Link href={`/gallery/${project.id}`} className="group block">
      <div className="relative aspect-[4/5] overflow-hidden bg-surface">
        <Image
          src={project.after_image_url}
          alt={project.title}
          fill
          sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 90vw"
          quality={80}
          priority={priority}
          className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
        />
        <span className="absolute left-3 top-3 rounded-full bg-bg/70 px-2.5 py-1 text-[11px] text-ink-muted backdrop-blur-sm">
          After
        </span>
      </div>

      <div className="mt-3">
        <h3 className="font-display text-lg text-ink">{project.title}</h3>
        <p className="mt-0.5 text-xs text-ink-faint">
          {formatPublished(project.published_at)}
        </p>
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
