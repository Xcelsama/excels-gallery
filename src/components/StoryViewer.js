"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import ShareButton from "@/components/ShareButton";

// How many slides AFTER the current one are fetched ahead of time. One slide
// BEHIND is kept too so "Previous" is instant. Slides outside that window
// are not in the page at all (this is the lazy loading, and it also keeps a
// phone from holding twenty decoded 2048px photos in memory).
const PRELOAD_AHEAD = 2;
const PRELOAD_BEHIND = 1;

const SWIPE_DISTANCE = 48; // px a finger must travel to count as a swipe
const STAGE_PADDING = 12; // px of breathing room between frame and screen edge

/**
 * The biggest box with the image's exact aspect ratio that fits inside
 * (maxW x maxH). Unlike CSS "contain" on the image alone, this is used to
 * size the FRAME, so the frame hugs the picture and the picture is never
 * letterboxed, cropped or stretched.
 */
function fitBox(maxW, maxH, imgW, imgH) {
  const scale = Math.min(maxW / imgW, maxH / imgH);
  return {
    width: Math.max(1, Math.floor(imgW * scale)),
    height: Math.max(1, Math.floor(imgH * scale)),
  };
}

function Icon({ children, size = 20, strokeWidth = 2 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const ICON_BUTTON =
  "flex h-10 w-10 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-surface-raised hover:text-ink";

export default function StoryViewer({ id, title, images, music, engagement }) {
  const last = images.length - 1;
  const [index, setIndex] = useState(0);
  const [stage, setStage] = useState(null); // measured { width, height } of the free area
  const [animateFrame, setAnimateFrame] = useState(false);
  const [loaded, setLoaded] = useState(() => new Set());

  const stageRef = useRef(null);
  const pointers = useRef(new Map());
  const swipeStart = useRef(null);

  const go = useCallback(
    (delta) => setIndex((i) => Math.min(last, Math.max(0, i + delta))),
    [last]
  );

  // --- Measure the free area, and keep it up to date (rotation, resize) ----
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const measure = () =>
      setStage({
        width: Math.max(1, el.clientWidth - STAGE_PADDING * 2),
        height: Math.max(1, el.clientHeight - STAGE_PADDING * 2),
      });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Turn the frame's size animation on only AFTER the first measurement, so
  // the frame doesn't visibly "grow in" from nothing on page load.
  const measured = stage !== null;
  useEffect(() => {
    if (!measured) return;
    const frame = requestAnimationFrame(() => setAnimateFrame(true));
    return () => cancelAnimationFrame(frame);
  }, [measured]);

  // --- Keyboard: arrow keys ------------------------------------------------
  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [go]);

  // --- The viewer is a full-screen layer: stop the page behind it scrolling
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  // --- Swipe (touch, pen or mouse drag) ------------------------------------
  function onPointerDown(e) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    pointers.current.set(e.pointerId, true);
    // A second finger means pinch-zoom, not a swipe.
    swipeStart.current =
      pointers.current.size === 1 ? { x: e.clientX, y: e.clientY } : null;
  }
  function onPointerUp(e) {
    pointers.current.delete(e.pointerId);
    const start = swipeStart.current;
    swipeStart.current = null;
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (Math.abs(dx) >= SWIPE_DISTANCE && Math.abs(dx) > Math.abs(dy) * 1.2) {
      go(dx < 0 ? 1 : -1);
    }
  }
  function onPointerCancel(e) {
    pointers.current.delete(e.pointerId);
    swipeStart.current = null;
  }

  // --- Background music ----------------------------------------------------
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [audioFailed, setAudioFailed] = useState(false);
  const [waitingForTap, setWaitingForTap] = useState(false);
  const hasMusic = Boolean(music) && !audioFailed;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !music) return;

    // These are set from here because React has no attribute for volume.
    audio.volume = Math.min(1, Math.max(0, music.volume));
    audio.loop = music.loop;

    if (!music.autoplay) return;

    // Browsers refuse to start sound without a user gesture. So: try right
    // away (it works if the visitor has interacted with the site before);
    // if it's refused, listen for the first tap / click / key press anywhere
    // and start then. Touch screens only count a tap once the finger lifts,
    // so each event simply retries until one of them is accepted.
    const events = ["pointerdown", "pointerup", "touchend", "keydown"];
    let stopped = false;

    function stopListening() {
      stopped = true;
      events.forEach((name) => window.removeEventListener(name, onGesture));
      setWaitingForTap(false);
    }
    function attempt() {
      return audio.play().then(stopListening, () => {});
    }
    function onGesture(e) {
      // A tap on the music buttons does its own thing.
      if (e.target instanceof Element && e.target.closest("[data-music-control]")) {
        return;
      }
      if (!stopped) attempt();
    }

    audio.play().then(
      () => {
        stopped = true;
      },
      () => {
        if (stopped) return;
        setWaitingForTap(true);
        events.forEach((name) => window.addEventListener(name, onGesture));
      }
    );

    return () => {
      stopped = true;
      events.forEach((name) => window.removeEventListener(name, onGesture));
    };
  }, [music]);

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) audio.play().catch(() => {});
    else audio.pause();
  }
  function toggleMute() {
    const audio = audioRef.current;
    if (!audio) return;
    audio.muted = !audio.muted;
    setMuted(audio.muted);
  }

  // --- Rendering -----------------------------------------------------------
  const current = images[index];
  const frame = stage
    ? fitBox(stage.width, stage.height, current.width, current.height)
    : null;
  const inWindow = (i) => i >= index - PRELOAD_BEHIND && i <= index + PRELOAD_AHEAD;
  const currentLoaded = loaded.has(index);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-bg"
      style={{
        paddingTop: "env(safe-area-inset-top, 0px)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      {/* Progress: one bar per slide */}
      <div
        className="flex gap-1 px-3 pt-3"
        role="progressbar"
        aria-label="Story progress"
        aria-valuemin={1}
        aria-valuemax={images.length}
        aria-valuenow={index + 1}
      >
        {images.map((_, i) => (
          <span
            key={i}
            className={
              "h-[3px] flex-1 rounded-full transition-colors duration-300 " +
              (i <= index ? "bg-accent" : "bg-ink/20")
            }
          />
        ))}
      </div>

      {/* Top bar */}
      <div className="flex items-center gap-1 px-2 pb-1 pt-1.5">
        <Link href="/gallery" aria-label="Back to gallery" className={ICON_BUTTON}>
          <Icon>
            <path d="M18 6L6 18M6 6l12 12" />
          </Icon>
        </Link>
        <h1 className="min-w-0 flex-1 truncate px-1 font-display text-base text-ink">
          {title}
        </h1>
        {engagement}
        <ShareButton title={title} path={`/gallery/${id}`} variant="icon" />
        {hasMusic && (
          <>
            <button
              type="button"
              data-music-control
              onClick={togglePlay}
              aria-label={playing ? "Pause music" : "Play music"}
              className={ICON_BUTTON}
            >
              {playing ? (
                <Icon>
                  <path d="M8 5v14M16 5v14" strokeWidth="3" />
                </Icon>
              ) : (
                <Icon>
                  <path d="M7 4.5v15l12-7.5z" fill="currentColor" />
                </Icon>
              )}
            </button>
            <button
              type="button"
              data-music-control
              onClick={toggleMute}
              aria-label={muted ? "Unmute music" : "Mute music"}
              aria-pressed={muted}
              className={ICON_BUTTON}
            >
              <Icon>
                <path d="M11 5L6 9H3v6h3l5 4z" fill="currentColor" />
                {muted ? (
                  <path d="M22 9l-6 6M16 9l6 6" />
                ) : (
                  <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />
                )}
              </Icon>
            </button>
          </>
        )}
      </div>

      {/* Stage: all the free space. The FRAME inside it takes the current
          image's shape, so it changes size between slides. */}
      <div
        ref={stageRef}
        className="relative flex min-h-0 flex-1 touch-pan-y select-none items-center justify-center"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      >
        <div
          className={
            "relative overflow-hidden rounded-md bg-surface shadow-2xl shadow-black/50 ring-1 ring-line " +
            (animateFrame
              ? "transition-[width,height] duration-300 ease-out"
              : "")
          }
          style={{
            width: frame?.width ?? 0,
            height: frame?.height ?? 0,
            opacity: frame ? 1 : 0,
          }}
        >
          {!currentLoaded && (
            <div className="absolute inset-0 animate-pulse bg-surface-raised" />
          )}
          {images.map((image, i) =>
            inWindow(i) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={image.url}
                src={image.url}
                alt={`${title}, image ${i + 1} of ${images.length}`}
                width={image.width}
                height={image.height}
                draggable={false}
                decoding="async"
                fetchPriority={i === index ? "high" : "auto"}
                aria-hidden={i === index ? undefined : true}
                onLoad={() =>
                  setLoaded((prev) => (prev.has(i) ? prev : new Set(prev).add(i)))
                }
                className={
                  "absolute inset-0 h-full w-full object-contain transition-opacity duration-300 " +
                  (i === index ? "opacity-100" : "pointer-events-none opacity-0")
                }
              />
            ) : null
          )}
        </div>

        {waitingForTap && (
          <p className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-surface-raised/90 px-3 py-1.5 text-xs text-ink-muted">
            Tap anywhere to start the music
          </p>
        )}
      </div>

      {/* Previous / counter / Next */}
      <div className="flex items-center justify-center gap-6 px-4 pb-4 pt-2">
        <button
          type="button"
          onClick={() => go(-1)}
          disabled={index === 0}
          aria-label="Previous image"
          className="flex h-12 w-12 items-center justify-center rounded-full border border-line bg-surface-raised text-ink transition hover:border-ink-faint active:scale-95 disabled:opacity-30 disabled:hover:border-line"
        >
          <Icon size={22} strokeWidth={2.5}>
            <path d="M15 18l-6-6 6-6" />
          </Icon>
        </button>
        <span
          className="min-w-[4.5rem] text-center text-sm tabular-nums text-ink-muted"
          aria-live="polite"
        >
          {index + 1} / {images.length}
        </span>
        <button
          type="button"
          onClick={() => go(1)}
          disabled={index === last}
          aria-label="Next image"
          className="flex h-14 w-14 items-center justify-center rounded-full bg-accent text-bg shadow-lg shadow-black/40 transition hover:bg-accent-hover active:scale-95 disabled:opacity-30 disabled:hover:bg-accent"
        >
          <Icon size={26} strokeWidth={2.75}>
            <path d="M9 18l6-6-6-6" />
          </Icon>
        </button>
      </div>

      {music && (
        <audio
          ref={audioRef}
          src={music.url}
          preload="auto"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
          onError={() => setAudioFailed(true)}
        />
      )}
    </div>
  );
}
