# What changed in this pass, and why

This documents everything touched in this optimization round. One action
is required on your end: **run the new database migration** (below)
before the next deploy, otherwise new uploads won't have anywhere to
store their image metadata.

## Required: run the new migration

`supabase/migrations/0002_image_metadata.sql` is new. Same process as
before: Supabase Dashboard → SQL Editor → New query → paste its contents
→ Run. It only *adds* nullable columns to the existing table, so it's
safe to run against a project that already has posts; nothing existing
is touched or deleted.

Optional: set `NEXT_PUBLIC_SITE_URL` once you have a real domain (see
`.env.local.example`). Without it, the site falls back to Vercel's own
deployment URL, so nothing breaks if you skip this for now.

---

## The main problem: images

The before/after comparison on each project's detail page
(`CompareSlider.js`) was rendering your original, full-resolution photos
directly, with no resizing or compression. Your grid thumbnails already
went through `next/image`; the detail page — the page people actually
came to look at — didn't. That's almost certainly the "large images,
slow to load" you were seeing.

**Fixed by**: routing those images through `next/image` too, which means
Vercel/Next's image pipeline now automatically resizes each photo to the
size it's actually displayed at and re-encodes it as AVIF or WebP
(`next.config.js` now requests both, falling back to WebP alone, then
the original format, for older browsers). A multi-MB source photo
typically comes back well under a few hundred KB. Quality is kept high
(90) since the edits themselves are the point of the site.

**The catch**: `next/image` needs to know an image's width and height up
front to do this without the page jumping around as photos load, and
those weren't being stored anywhere. So `AdminPostForm.js` now reads each
photo's real pixel dimensions **client-side, at upload time** — no
extra network round trip — along with generating a tiny (~16px-wide)
blurred preview of it. Both travel up to `actions.js`, which re-validates
them (bounds-checked, capped length) before saving, and get stored in the
two new columns 0002 adds. The public site then uses these for:

- **No layout shift**: the page reserves the correct aspect-ratio space
  for a photo before it's loaded, instead of the surrounding content
  jumping once the image pops in.
- **Blur-up placeholders**: a soft blurred preview shows immediately,
  sharpening into the real photo once it's ready, instead of a blank box.

**Posts you publish before running the migration, or that were published
before this update**: fall back to the exact original unoptimized
rendering for that specific photo (still fully public/visible either
way, just without the new dimensions/blur). Nothing breaks, nothing
needs backfilling. Re-saving a post (even without changing its images)
won't add the metadata retroactively — only a fresh image upload
captures it, since that's the only point the raw file is available to
read. If you want the older posts optimized too, re-uploading their
photos through the edit form is what picks it up.

## Mobile: the "can't scroll" issue

Two things were going on here, one real bug and one polish/discoverability gap:

1. **The actual bug**: the compare-slider's touch handling was set to
   block *all* native touch gestures (`touch-action: none`) so it could
   interpret horizontal drags itself. That also blocks a vertical swipe
   that starts on the photo from scrolling the page — which is likely
   why it could feel like the page was stuck. Changed to `touch-pan-y`,
   which lets the browser handle vertical scrolling natively and only
   hands horizontal-dominant drags to the slider. The drag-to-compare
   interaction itself is unchanged.
2. **Discoverability**: even once scrolling works, the slider fills
   enough of the screen that it can read as the whole page. Added a
   small "Scroll for details" cue with a bouncing arrow at the bottom of
   the frame on mobile, which fades out on the first scroll (or after a
   few seconds) and doesn't come back for the rest of the visit.

## Reactivity / smoothness

- The drag-to-compare handler now batches its updates to one per
  animation frame (`requestAnimationFrame`) instead of one per raw
  pointer-move event, which can fire faster than the screen repaints on
  some devices/trackpads. Keeps the drag smooth without extra
  re-renders piling up.
- The welcome screen now prefetches the `/gallery` route as soon as it
  renders, so by the time someone taps "Continue" the page is already
  warming up rather than starting from a cold click.

## UI

- **Mobile header overflow**: at narrow phone widths (measured and
  confirmed at 320px, a real device width, in an actual browser — this
  wasn't a hunch), the logo and nav were colliding. The header is now
  responsive: smaller and tighter on phones, the original spacious sizing
  restored from 640px up. Verified with real pixel measurements across
  320/360/375/640px, not just a screenshot.
- **Dark-themed form controls**: added `color-scheme: dark` so native
  scrollbars, date pickers, etc. render dark instead of defaulting to a
  jarring light theme on top of the site's palette.

## "Standard site" completeness

- **`sitemap.js` / `robots.js`**: auto-generated `/sitemap.xml` and
  `/robots.txt` (Next.js App Router conventions, no extra route code
  needed). The sitemap lists every project page; `/admin` is disallowed
  in robots.txt as a second layer on top of the existing auth guard.
- **Open Graph / Twitter card metadata**: sharing a project's link now
  unfurls with its title, caption, and the "after" photo, instead of
  nothing. Needed `metadataBase` on the root layout so those image URLs
  resolve to absolute ones (required by every platform that unfurls
  links) — this pulls from `NEXT_PUBLIC_SITE_URL` if set, or Vercel's own
  URL otherwise.
- **Page titles** now use Next's title template (`"<page> | Excel's
  Gallery"` generated centrally from the root layout) instead of every
  page spelling out the suffix by hand. Purely a maintenance/consistency
  change, nothing visible changes.
- **Favicon, apple-touch-icon, and a web manifest**: there wasn't a
  `/public` directory yet, so the site had no icon at all (a blank/generic
  icon in browser tabs). Added `src/app/icon.svg` (a small "E" monogram in
  the site's own accent gold on its dark background, Next's file
  convention wires it up automatically) plus a rasterized
  `apple-icon.png` for iOS home-screen icons, and `manifest.js` for
  "add to home screen." Checked the monogram's legibility by actually
  rendering it at real favicon sizes (16/32/48px) in a browser rather than
  eyeballing the source SVG, and went with a bolder weight than my first
  pass once the 16px render showed it was a little thin.
- **Admin area de-indexed**: added `src/app/admin/layout.js` with
  `robots: { index: false, follow: false }`, covering both `/admin/login`
  and everything under the protected dashboard with one file. robots.txt
  already disallowed `/admin` for crawlers, but that only stops crawling —
  this is the stronger page-level signal for keeping already-linked pages
  out of search results.
- **Tag filter buttons** on the gallery grid now expose their
  pressed/unpressed state (`aria-pressed`) for screen readers, they're
  toggles, not plain links, and weren't announced as such before.
- **`theme-color`** set to match the site's background, so the browser
  chrome on mobile (Android's address bar tint, etc.) matches the page
  instead of defaulting to white.

## What I intentionally left alone

- **The About page's headshot** now goes through `next/image` too, but
  only when `about.photo` is a local `/public` path (what the field's own
  comment already documents as the normal usage) — anything else falls
  back to a plain `<img>`, so pointing it at some other host later can't
  break the build.
- **The welcome screen itself** (the one-time full-screen intro before
  the gallery). It only shows once per visitor and felt like a
  deliberate choice, not a bug, so I left the design as-is beyond the
  prefetch mentioned above.

## How this was checked without a working `next build`

This sandbox has no network access (confirmed by a 403 from the npm
registry), so nothing here has gone through an actual `npm install` or
`next build`. To compensate:
- Every file is run through a real JavaScript/JSX parser (esbuild) right
  after editing it, so plain syntax errors can't slip through silently.
- The trickiest new piece of logic — reading a photo's real width/height
  and generating its blur placeholder in the browser — is tested against
  an actual generated JPEG in a real headless Chromium instance, checking
  the output numbers directly, not just reasoned through.
- The mobile header fix and the new scroll hint are both rendered and
  measured/screenshotted in that same real browser at several device
  widths, rather than eyeballed from the Tailwind classes.
- The new SQL migration's syntax was checked against Postgres's actual
  documented behavior (and one assumption — that `ADD CONSTRAINT IF NOT
  EXISTS` was supported — turned out to be wrong and was corrected before
  shipping here).

That catches most of what a real build would catch, but not literally
everything (e.g. Next's own type-checking of route exports). If
`npm install && npm run build` turns up anything, send me the error.
