"use client";

import { useMemo, useState } from "react";
import ProjectCard from "@/components/ProjectCard";
import EmptyState from "@/components/EmptyState";

export default function GalleryGrid({ projects }) {
  const [query, setQuery] = useState("");
  const [activeTag, setActiveTag] = useState(null);

  const allTags = useMemo(() => {
    const set = new Set();
    projects.forEach((p) => p.tags?.forEach((tag) => set.add(tag)));
    return Array.from(set).sort();
  }, [projects]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return projects.filter((p) => {
      const matchesTag = !activeTag || p.tags?.includes(activeTag);
      if (!matchesTag) return false;
      if (!q) return true;
      const haystack = [p.title, p.caption, ...(p.tags ?? [])]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [projects, query, activeTag]);

  if (projects.length === 0) {
    return (
      <EmptyState
        title="Nothing published yet"
        description="New before-and-after edits will show up here as soon as they go live."
      />
    );
  }

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search edits"
          aria-label="Search gallery"
          className="w-full rounded-full border border-line bg-surface px-4 py-2.5 text-sm text-ink placeholder:text-ink-faint sm:max-w-xs"
        />
        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-2 text-xs">
            <button
              onClick={() => setActiveTag(null)}
              aria-pressed={activeTag === null}
              className={
                "rounded-full border px-3 py-1.5 transition-colors " +
                (activeTag === null
                  ? "border-accent bg-accent text-bg font-medium"
                  : "border-line text-ink-muted hover:border-ink-faint hover:text-ink")
              }
            >
              All
            </button>
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => setActiveTag(tag === activeTag ? null : tag)}
                aria-pressed={tag === activeTag}
                className={
                  "rounded-full border px-3 py-1.5 transition-colors " +
                  (tag === activeTag
                    ? "border-accent bg-accent text-bg font-medium"
                    : "border-line text-ink-muted hover:border-ink-faint hover:text-ink")
                }
              >
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="mt-10">
          <EmptyState
            title="No matches"
            description="Try a different search term or clear the tag filter."
          />
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((project, i) => (
            <ProjectCard
              key={project.id}
              project={project}
              priority={i < 3}
            />
          ))}
        </div>
      )}
    </div>
  );
}
