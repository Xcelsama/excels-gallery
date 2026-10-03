"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// ---------------------------------------------------------------------------
// Zoom limits. Change these numbers to taste.
//
//  MIN_ZOOM   1 = the photo fitted to the screen. You can't zoom out past it.
//  MAX_ZOOM   the most you can zoom in. The viewer loads a 2048 px wide copy
//             of the photo (not the huge original), so going much past 4x
//             would only show blur.
//
// Panning is limited too: once zoomed, you can drag the photo around, but
// never so far that its edge leaves the screen.
// ---------------------------------------------------------------------------
const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const BUTTON_STEP = 1.5; // each + / - tap multiplies / divides the zoom by this
const DOUBLE_TAP_ZOOM = 2.5; // zoom level a double-tap / double-click jumps to
const VIEW_WIDTH = 2048; // px width of the copy loaded in the viewer

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

// Same optimizer next/image uses (resized, AVIF/WebP), so a 20 MB original
// isn't downloaded just to zoom in. Falls back to the original if it fails.
function optimizedUrl(src) {
  return `/_next/image?url=${encodeURIComponent(src)}&w=${VIEW_WIDTH}&q=90`;
}

/**
 * Full-screen viewer for the before / after photos of a post.
 *  - Switch between Before and After at the top; your zoom and position are
 *    kept, so you can compare the same spot in both.
 *  - Zoom: pinch, scroll wheel / trackpad, double-tap (double-click), the
 *    +/- buttons, or the + and - keys. Drag to move around when zoomed.
 *  - Close: the X button or Esc.
 */
export default function ImageZoomViewer({
  before,
  after,
  title,
  initial = "after",
  onClose,
}) {
  const [which, setWhich] = useState(initial === "before" ? "before" : "after");
  const [view, setView] = useState({ s: MIN_ZOOM, x: 0, y: 0 });
  const [animate, setAnimate] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [hint, setHint] = useState(true);
  const [srcMode, setSrcMode] = useState({ before: "opt", after: "opt" });

  const stageRef = useRef(null);
  const imgRef = useRef(null);
  const closeRef = useRef(null);
  const viewRef = useRef(view); // always-current copy for event handlers
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const pointers = useRef(new Map());
  const gesture = useRef(null);
  const tap = useRef({ valid: false, t: 0 });
  const lastTap = useRef({ t: 0, x: 0, y: 0 });

  // How far the photo may be moved at a given zoom, so it can't leave the
  // screen. (If it's smaller than the screen in one direction, no movement.)
  const getBounds = useCallback((s) => {
    const stage = stageRef.current;
    const img = imgRef.current;
    if (!stage || !img) return { maxX: 0, maxY: 0 };
    return {
      maxX: Math.max(0, (img.offsetWidth * s - stage.clientWidth) / 2),
      maxY: Math.max(0, (img.offsetHeight * s - stage.clientHeight) / 2),
    };
  }, []);

  // The one place the view changes: applies the zoom limits and pan limits.
  const commit = useCallback(
    (next) => {
      const s = clamp(next.s, MIN_ZOOM, MAX_ZOOM);
      const { maxX, maxY } = getBounds(s);
      const v = {
        s,
        x: clamp(next.x, -maxX, maxX),
        y: clamp(next.y, -maxY, maxY),
      };
      viewRef.current = v;
      setView(v);
    },
    [getBounds]
  );

  // Zoom to a level, keeping the point (fx, fy), measured from the centre of
  // the screen, in the same place under the finger / cursor.
  const zoomTo = useCallback(
    (target, fx = 0, fy = 0) => {
      const { s, x, y } = viewRef.current;
      const s2 = clamp(target, MIN_ZOOM, MAX_ZOOM);
      const ratio = s2 / s;
      commit({ s: s2, x: fx - (fx - x) * ratio, y: fy - (fy - y) * ratio });
    },
    [commit]
  );

  const stepZoom = useCallback(
    (direction) => {
      setHint(false);
      setAnimate(true);
      const s = viewRef.current.s;
      zoomTo(direction > 0 ? s * BUTTON_STEP : s / BUTTON_STEP);
    },
    [zoomTo]
  );

  const resetZoom = useCallback(() => {
    setAnimate(true);
    zoomTo(MIN_ZOOM);
  }, [zoomTo]);

  const pick = (key) => {
    if (key === which) return;
    setLoaded(false);
    setWhich(key);
  };
  const pickRef = useRef(pick);
  pickRef.current = pick;

  // --- open / close housekeeping -------------------------------------------
  useEffect(() => {
    const opener = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden"; // page doesn't scroll behind
    closeRef.current?.focus();
    const hintTimer = setTimeout(() => setHint(false), 4500);
    return () => {
      clearTimeout(hintTimer);
      document.body.style.overflow = previousOverflow;
      opener?.focus?.();
    };
  }, []);

  // --- keyboard ------------------------------------------------------------
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onCloseRef.current();
      else if (e.key === "+" || e.key === "=") stepZoom(1);
      else if (e.key === "-" || e.key === "_") stepZoom(-1);
      else if (e.key === "0") resetZoom();
      else if (e.key === "ArrowLeft") pickRef.current("before");
      else if (e.key === "ArrowRight") pickRef.current("after");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stepZoom, resetZoom]);

  // --- scroll wheel / trackpad pinch (needs a non-passive listener) ---------
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const onWheel = (e) => {
      e.preventDefault();
      setAnimate(false);
      setHint(false);
      const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      const k = e.ctrlKey ? 0.01 : 0.0015; // trackpad pinch sends ctrl+wheel
      const rect = el.getBoundingClientRect();
      zoomTo(
        viewRef.current.s * Math.exp(-dy * k),
        e.clientX - rect.left - rect.width / 2,
        e.clientY - rect.top - rect.height / 2
      );
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomTo]);

  // Warm the cache with the other photo so switching is instant.
  useEffect(() => {
    const other = which === "after" ? before : after;
    if (!other) return;
    const preload = new Image();
    preload.src = optimizedUrl(other);
  }, [which, before, after]);

  // --- touch / mouse gestures: drag to move, two fingers to pinch ----------
  const stageCentre = () => {
    const rect = stageRef.current.getBoundingClientRect();
    return { cx: rect.left + rect.width / 2, cy: rect.top + rect.height / 2 };
  };

  const startGesture = () => {
    const pts = [...pointers.current.values()];
    const v = { ...viewRef.current };
    if (pts.length >= 2) {
      const { cx, cy } = stageCentre();
      const [a, b] = pts;
      gesture.current = {
        mode: "pinch",
        dist: Math.hypot(a.x - b.x, a.y - b.y) || 1,
        mx: (a.x + b.x) / 2 - cx,
        my: (a.y + b.y) / 2 - cy,
        v,
      };
    } else if (pts.length === 1) {
      gesture.current = { mode: "pan", px: pts[0].x, py: pts[0].y, v };
    } else {
      gesture.current = null;
    }
  };

  const onPointerDown = (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    setAnimate(false);
    setHint(false);
    e.currentTarget.setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    startGesture();
    tap.current =
      pointers.current.size === 1
        ? { valid: true, t: performance.now() }
        : { valid: false, t: 0 };
  };

  const onPointerMove = (e) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    if (!g) return;

    if (g.mode === "pinch" && pointers.current.size >= 2) {
      const { cx, cy } = stageCentre();
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const s2 = clamp((g.v.s * dist) / g.dist, MIN_ZOOM, MAX_ZOOM);
      const ratio = s2 / g.v.s;
      const mx = (a.x + b.x) / 2 - cx;
      const my = (a.y + b.y) / 2 - cy;
      // keep the spot that was under the pinch centre under the fingers
      commit({
        s: s2,
        x: mx - (g.mx - g.v.x) * ratio,
        y: my - (g.my - g.v.y) * ratio,
      });
    } else if (g.mode === "pan") {
      const dx = e.clientX - g.px;
      const dy = e.clientY - g.py;
      if (Math.hypot(dx, dy) > 8) tap.current.valid = false;
      if (viewRef.current.s > MIN_ZOOM) {
        commit({ s: g.v.s, x: g.v.x + dx, y: g.v.y + dy });
      }
    }
  };

  const endPointer = (e) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.delete(e.pointerId);
    e.currentTarget.releasePointerCapture?.(e.pointerId);

    // Double-tap / double-click: toggle between fitted and DOUBLE_TAP_ZOOM.
    const now = performance.now();
    if (
      e.type === "pointerup" &&
      tap.current.valid &&
      pointers.current.size === 0 &&
      now - tap.current.t < 300
    ) {
      const last = lastTap.current;
      if (
        now - last.t < 320 &&
        Math.hypot(e.clientX - last.x, e.clientY - last.y) < 30
      ) {
        lastTap.current = { t: 0, x: 0, y: 0 };
        setAnimate(true);
        if (viewRef.current.s > MIN_ZOOM + 0.05) {
          zoomTo(MIN_ZOOM);
        } else {
          const { cx, cy } = stageCentre();
          zoomTo(DOUBLE_TAP_ZOOM, e.clientX - cx, e.clientY - cy);
        }
      } else {
        lastTap.current = { t: now, x: e.clientX, y: e.clientY };
      }
    }
    tap.current.valid = false;
    startGesture(); // carry on with a remaining finger, if any
  };

  // --- render --------------------------------------------------------------
  const raw = which === "before" ? before : after;
  const mode = srcMode[which];
  const src = mode === "opt" ? optimizedUrl(raw) : raw;
  const failed = mode === "failed";
  const atMin = view.s <= MIN_ZOOM + 0.001;
  const atMax = view.s >= MAX_ZOOM - 0.001;

  const onImgError = () => {
    setSrcMode((m) => ({
      ...m,
      [which]: m[which] === "opt" ? "orig" : "failed",
    }));
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${title}: zoom viewer`}
      className="fixed inset-0 z-[100] flex flex-col bg-bg"
    >
      {/* Top bar: close, and pick which photo to look at */}
      <div
        className="flex shrink-0 items-center justify-between gap-3 border-b border-line px-3 pb-2.5"
        style={{ paddingTop: "max(0.625rem, env(safe-area-inset-top, 0px))" }}
      >
        <button
          ref={closeRef}
          type="button"
          onClick={() => onCloseRef.current()}
          aria-label="Close"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-line text-ink-muted transition-colors hover:border-ink-faint hover:text-ink"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>

        <div
          role="group"
          aria-label="Choose photo"
          className="flex rounded-full border border-line p-0.5"
        >
          {["before", "after"].map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => pick(key)}
              aria-pressed={which === key}
              className={
                "rounded-full px-4 py-1.5 text-xs uppercase tracking-[0.14em] transition-colors " +
                (which === key
                  ? "bg-surface-raised text-accent"
                  : "text-ink-faint hover:text-ink")
              }
            >
              {key}
            </button>
          ))}
        </div>

        <span className="w-10" aria-hidden="true" />
      </div>

      {/* The photo. This area owns all touch gestures. */}
      <div
        ref={stageRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        className={
          "relative min-h-0 flex-1 touch-none select-none overflow-hidden " +
          (atMin ? "cursor-zoom-in" : "cursor-grab active:cursor-grabbing")
        }
      >
        {!loaded && !failed && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs uppercase tracking-[0.14em] text-ink-faint">
            Loading…
          </div>
        )}

        {failed ? (
          <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-ink-muted">
            This photo couldn&rsquo;t be loaded.
          </div>
        ) : (
          <img
            key={which}
            ref={imgRef}
            src={src}
            alt={`${title}, ${which}`}
            draggable={false}
            decoding="async"
            onDragStart={(e) => e.preventDefault()}
            onLoad={() => {
              setLoaded(true);
              commit(viewRef.current); // re-apply limits for this photo's size
            }}
            onError={onImgError}
            className="absolute inset-0 m-auto max-h-full max-w-full"
            style={{
              transform: `translate(${view.x}px, ${view.y}px) scale(${view.s})`,
              transformOrigin: "center",
              transition: animate ? "transform 180ms ease-out" : "none",
              willChange: "transform",
              opacity: loaded ? 1 : 0,
            }}
          />
        )}
      </div>

      {/* One-time hint */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-x-0 flex justify-center transition-opacity duration-500 ${
          hint && loaded && atMin ? "opacity-100" : "opacity-0"
        }`}
        style={{ bottom: "calc(max(1rem, env(safe-area-inset-bottom, 0px)) + 3.75rem)" }}
      >
        <span className="rounded-full bg-surface-raised px-3 py-1.5 text-xs text-ink-muted shadow-lg">
          Pinch, scroll or double-tap to zoom &middot; up to {MAX_ZOOM}&times;
        </span>
      </div>

      {/* Zoom controls */}
      <div
        className="pointer-events-none absolute inset-x-0 flex justify-center"
        style={{ bottom: "max(1rem, env(safe-area-inset-bottom, 0px))" }}
      >
        <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-line bg-surface-raised p-1 shadow-lg">
          <button
            type="button"
            onClick={() => stepZoom(-1)}
            disabled={atMin}
            aria-label="Zoom out"
            className="flex h-10 w-10 items-center justify-center rounded-full text-ink transition-colors hover:bg-surface disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M5 12h14" />
            </svg>
          </button>
          <button
            type="button"
            onClick={resetZoom}
            disabled={atMin}
            aria-label="Reset zoom"
            className="min-w-[5rem] px-2 text-center text-sm tabular-nums text-ink-muted disabled:cursor-default"
          >
            {atMax ? `${MAX_ZOOM}\u00d7 max` : `${view.s.toFixed(1)}\u00d7`}
          </button>
          <button
            type="button"
            onClick={() => stepZoom(1)}
            disabled={atMax}
            aria-label="Zoom in"
            className="flex h-10 w-10 items-center justify-center rounded-full text-ink transition-colors hover:bg-surface disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
