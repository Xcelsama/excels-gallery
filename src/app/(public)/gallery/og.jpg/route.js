import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";
import { OG_MAX_BYTES, OG_MAX_HEIGHT, OG_WIDTH } from "@/lib/og";

// The link-preview image for the main gallery page: /gallery/og.jpg
//
// WhatsApp (and friends) fetch this when someone shares the plain
// /gallery link. It shows the newest post's picture (the "after" image; a
// story's first image), shrunk to about 1200 px wide and under OG_MAX_BYTES,
// exactly like the per-post preview in ./[id]/og.jpg/route.js.
//
// - The URL ends in ".jpg" on purpose: middleware.js skips paths with an
//   image extension, so this route doesn't pay for a login check.
// - The gallery page's metadata adds ?v=<date of the newest post>, so when a
//   new post is published the preview URL changes and chats re-fetch it.

export const runtime = "nodejs";

const QUALITY_STEPS = [82, 74, 66, 58, 50];
const WIDTH_STEPS = [OG_WIDTH, 1000, 800];

export async function GET() {
  // A plain anonymous client (no cookies): this route is public, and reading
  // public posts needs nothing else.
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  const { data: latest } = await supabase
    .from("gallery_projects")
    .select("after_image_url")
    .order("published_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!latest?.after_image_url) {
    return new Response("Not found", { status: 404 });
  }

  const upstream = await fetch(latest.after_image_url);
  if (!upstream.ok) return new Response("Image unavailable", { status: 502 });
  const input = Buffer.from(await upstream.arrayBuffer());

  try {
    const oriented = sharp(input, { failOn: "none" }).rotate(); // apply EXIF orientation

    // 1200 px wide, quality stepped down until it fits; only a very grainy
    // photo needs the smaller-width last resort.
    let output = null;
    for (const width of WIDTH_STEPS) {
      const resized = oriented
        .clone()
        .resize({
          width,
          height: OG_MAX_HEIGHT,
          fit: "inside",
          withoutEnlargement: true,
        })
        .flatten({ background: "#15130f" }); // PNGs with transparency
      for (const quality of QUALITY_STEPS) {
        output = await resized
          .clone()
          .jpeg({ quality, mozjpeg: true })
          .toBuffer();
        if (output.length <= OG_MAX_BYTES) break;
      }
      if (output.length <= OG_MAX_BYTES) break;
    }

    return new Response(output, {
      headers: {
        "Content-Type": "image/jpeg",
        "Content-Length": String(output.length),
        // The ?v= in the page metadata changes with each new post, so a day
        // of caching is safe and keeps the image fast for link crawlers.
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
      },
    });
  } catch {
    return new Response("Could not process image", { status: 500 });
  }
}
