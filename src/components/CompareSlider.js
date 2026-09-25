"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

const IMAGE_SIZES = "(min-width: 640px) 45vw, 100vw";

/**
 * Goes through next/image whenever we have the stored intrinsic
 * width/height for a photo (captured client-side at upload time, see
 * AdminPostForm's readImageMeta). That gets us automatic resizing +
 * AVIF/WebP conversion for these large source photos, a reserved aspect
 * ratio so nothing shifts while loading, and a blur-up placeholder.
 *
 * Older rows published before that metadata existed won't have
 * width/height on file, so each image below falls back to a plain <img>
 * for those specifically, exactly matching the original unoptimized
 * behavior rather than risking a distorted render.
 */
export default function CompareSlider({
  before,
  after,
  title,
  beforeWidth,
  beforeHeight,
  beforeBlur,
  afterWidth,
  afterHeight,
  afterBlur,
}) {
  const hasBeforeDims = Boolean(beforeWidth && beforeHeight);
  const hasAfterDims = Boolean(afterWidth && afterHeight);

  return (
    <div>
      {/* Desktop / tablet: side by side, each at its own natural ratio */}
      <div className="hidden gap-px overflow-hidden rounded-sm bg-line sm:grid sm:grid-cols-2">
        <figure className="bg-surface">
          {hasBeforeDims ? (
            <Image
              src={before}
              alt={`${title}, before`}
              width={beforeWidth}
              height={beforeHeight}
              sizes={IMAGE_SIZES}
              quality={90}
              className="block h-auto w-full"
              {...(beforeBlur
                ? { placeholder: "blur", blurDataURL: beforeBlur }
                : {})}
            />
          ) : (
            <img
              src={before}
              alt={`${title}, before`}
              className="block h-auto w-full"
            />
          )}
          <figcaption className="flex items-center gap-2 px-1 py-3">
            <span className="h-px w-4 bg-line" />
            <span className="text-[11px] uppercase tracking-[0.14em] text-ink-faint">
              Before
            </span>
          </figcaption>
        </figure>
        <figure className="bg-surface">
          {hasAfterDims ? (
            <Image
              src={after}
              alt={`${title}, after`}
              width={afterWidth}
              height={afterHeight}
              sizes={IMAGE_SIZES}
              quality={90}
              className="block h-auto w-full"
              {...(afterBlur
                ? { placeholder: "blur", blurDataURL: afterBlur }
                : {})}
            />
          ) : (
            <img
              src={after}
              alt={`${title}, after`}
              className="block h-auto w-full"
            />
          )}
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
        <DragSlider
          before={before}
          after={after}
          title={title}
          beforeWidth={beforeWidth}
          beforeHeight={beforeHeight}
          beforeBlur={beforeBlur}
          hasBeforeDims={hasBeforeDims}
          afterWidth={afterWidth}
          afterHeight={afterHeight}
          afterBlur={afterBlur}
          hasAfterDims={hasAfterDims}
        />
      </div>
    </div>
  );
}

function DragSlider({
  before,
  after,
  title,
  beforeWidth,
  beforeHeight,
  beforeBlur,
  hasBeforeDims,
  afterWidth,
  afterHeight,
  afterBlur,
  hasAfterDims,
}) {
  const containerRef = useRef(null);
  const [percent, setPercent] = useState(50);
  const draggingRef = useRef(false);
  const rafRef = useRef(null);

  const updateFromClientX = useCallback((clientX) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const next = ((clientX - rect.left) / rect.width) * 100;
    setPercent(Math.min(100, Math.max(0, next)));
  }, []);

  // Pointer devices can fire move events much faster than the screen can
  // repaint. Coalescing to one update per animation frame keeps the drag
  // smooth without piling up redundant re-renders.
  const scheduleUpdate = useCallback(
    (clientX) => {
      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        updateFromClientX(clientX);
      });
    },
    [updateFromClientX]
  );

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const handlePointerDown = (e) => {
    draggingRef.current = true;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    updateFromClientX(e.clientX);
  };
  const handlePointerMove = (e) => {
    if (!draggingRef.current) return;
    scheduleUpdate(e.clientX);
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
      // pan-y (not none): lets a vertical swipe that starts on the photo
      // still scroll the page. Only a horizontal-dominant drag is captured
      // for the slider; the browser decides which based on the gesture's
      // initial direction, then either sends us pointermove or hands the
      // touch off to native scrolling (which fires onPointerCancel below).
      className="relative w-full touch-pan-y select-none overflow-hidden rounded-sm bg-surface"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {hasAfterDims ? (
        <Image
          src={after}
          alt={`${title}, after`}
          width={afterWidth}
          height={afterHeight}
          sizes={IMAGE_SIZES}
          quality={90}
          draggable={false}
          className="block h-auto w-full"
          {...(afterBlur
            ? { placeholder: "blur", blurDataURL: afterBlur }
            : {})}
        />
      ) : (
        <img
          src={after}
          alt={`${title}, after`}
          draggable={false}
          className="block h-auto w-full"
        />
      )}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ clipPath: `inset(0 ${100 - percent}% 0 0)` }}
      >
        {hasBeforeDims ? (
          <Image
            src={before}
            alt={`${title}, before`}
            fill
            sizes={IMAGE_SIZES}
            quality={90}
            draggable={false}
            className="object-cover"
            {...(beforeBlur
              ? { placeholder: "blur", blurDataURL: beforeBlur }
              : {})}
          />
        ) : (
          <img
            src={before}
            alt={`${title}, before`}
            draggable={false}
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
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

      <ScrollHint />
    </div>
  );
}

/**
 * A quiet, self-dismissing "there's more below" cue for mobile. The drag
 * handle above makes this frame feel like a self-contained interaction,
 * so first-time visitors can miss that the page keeps going underneath it.
 * Fades out on the first scroll (or after a few seconds, whichever comes
 * first) and never comes back for the rest of the visit.
 */
function ScrollHint() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const hide = () => setVisible(false);
    window.addEventListener("scroll", hide, { passive: true, once: true });
    const timer = setTimeout(hide, 4000);
    return () => {
      window.removeEventListener("scroll", hide);
      clearTimeout(timer);
    };
  }, []);

  return (
    <>
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/55 to-transparent transition-opacity duration-500 ${
          visible ? "opacity-100" : "opacity-0"
        }`}
      />
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-x-0 bottom-2.5 flex flex-col items-center gap-1 transition-opacity duration-500 ${
          visible ? "opacity-100" : "opacity-0"
        }`}
      >
        <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-ink/90">
          Scroll for details
        </span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="animate-bounce text-ink/90"
        >
          <path d="M12 5v14M19 12l-7 7-7-7" />
        </svg>
      </div>
    </>
  );
}
