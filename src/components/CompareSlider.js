"use client";

import { useCallback, useRef, useState } from "react";

/**
 * Renders full-quality <img> tags rather than next/image here on purpose:
 * we don't store the images' intrinsic width/height, and the brief asks
 * specifically for this view to preserve original aspect ratio without
 * cropping or extra compression. Grid thumbnails (ProjectCard) still go
 * through next/image, where optimizing for a fast scroll matters more.
 */
export default function CompareSlider({ before, after, title }) {
  return (
    <div>
      {/* Desktop / tablet: side by side, each at its own natural ratio */}
      <div className="hidden gap-px overflow-hidden rounded-sm bg-line sm:grid sm:grid-cols-2">
        <figure className="bg-surface">
          <img
            src={before}
            alt={`${title}, before`}
            className="block h-auto w-full"
          />
          <figcaption className="flex items-center gap-2 px-1 py-3">
            <span className="h-px w-4 bg-line" />
            <span className="text-[11px] uppercase tracking-[0.14em] text-ink-faint">
              Before
            </span>
          </figcaption>
        </figure>
        <figure className="bg-surface">
          <img
            src={after}
            alt={`${title}, after`}
            className="block h-auto w-full"
          />
          <figcaption className="flex items-center gap-2 px-1 py-3">
            <span className="h-px w-4 bg-accent" />
            <span className="text-[11px] uppercase tracking-[0.14em] text-accent">
              After
            </span>
          </figcaption>
        </figure>
      </div>

      {/* Mobile: one frame, drag (or arrow keys) to compare */}
      <div className="sm:hidden">
        <DragSlider before={before} after={after} title={title} />
      </div>
    </div>
  );
}

function DragSlider({ before, after, title }) {
  const containerRef = useRef(null);
  const [percent, setPercent] = useState(50);
  const draggingRef = useRef(false);

  const updateFromClientX = useCallback((clientX) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const next = ((clientX - rect.left) / rect.width) * 100;
    setPercent(Math.min(100, Math.max(0, next)));
  }, []);

  const handlePointerDown = (e) => {
    draggingRef.current = true;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    updateFromClientX(e.clientX);
  };
  const handlePointerMove = (e) => {
    if (!draggingRef.current) return;
    updateFromClientX(e.clientX);
  };
  const handlePointerUp = () => {
    draggingRef.current = false;
  };

  const handleKeyDown = (e) => {
    if (e.key === "ArrowLeft") {
      setPercent((p) => Math.max(0, p - 5));
    } else if (e.key === "ArrowRight") {
      setPercent((p) => Math.min(100, p + 5));
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full touch-none select-none overflow-hidden rounded-sm bg-surface"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <img
        src={after}
        alt={`${title}, after`}
        draggable={false}
        className="block h-auto w-full"
      />
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ clipPath: `inset(0 ${100 - percent}% 0 0)` }}
      >
        <img
          src={before}
          alt={`${title}, before`}
          draggable={false}
          className="absolute inset-0 h-full w-full object-cover"
        />
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/45 to-transparent" />
      <span className="pointer-events-none absolute left-3 top-3 text-[10px] font-medium uppercase tracking-[0.14em] text-ink/90">
        Before
      </span>
      <span className="pointer-events-none absolute right-3 top-3 text-[10px] font-medium uppercase tracking-[0.14em] text-accent">
        After
      </span>

      <div
        className="absolute inset-y-0 w-px bg-accent shadow-[0_0_12px_rgba(201,154,63,0.5)]"
        style={{ left: `${percent}%` }}
      >
        <div
          role="slider"
          tabIndex={0}
          aria-label="Comparison position"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(percent)}
          onKeyDown={handleKeyDown}
          className="absolute left-1/2 top-1/2 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize items-center justify-center rounded-full border border-accent/70 bg-bg text-accent shadow-lg"
        >
          <span aria-hidden="true" className="text-sm">
            ↔
          </span>
        </div>
      </div>
    </div>
  );
}
