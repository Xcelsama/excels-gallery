import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";
import { OG_MAX_BYTES, OG_MAX_HEIGHT, OG_WIDTH } from "@/lib/og";

// The link-preview image for one post: /gallery/<id>/og.jpg
//
// WhatsApp (and friends) fetch this when someone shares a post link. They
// want a small file (about 1200 px wide, ideally under 300 KB), so instead of
// handing them the full-size original we shrink it here and keep lowering the
// JPEG quality until it fits under OG_MAX_BYTES.
//
// - Before/after posts: the "after" image. Story posts: the first image
//   (stories store their first image in the same after_* columns, see
//   0003_story_posts.sql, so one query covers both).
// - The URL ends in ".jpg" on purpose: middleware.js skips paths with an
//   image extension, so this route doesn't pay for a login check.
// - The page's metadata adds ?v=<updated_at>, so the response can be cached
//   for a year: when the post changes, the URL changes.

export const runtime = "nodejs";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const QUALITY_STEPS = [82, 74, 66, 58, 50];
const WIDTH_STEPS = [OG_WIDTH, 1000, 800];

export async function GET(_request, { params }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) return new Response("Not found", { status: 404 });

  // A plain anonymous client (no cookies): this route is public, and reading
  // a public post needs nothing else.
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  const { data: project } = await supabase
    .from("gallery_projects")
    .select("after_image_url")
    .eq("id", id)
    .maybeSingle();

  if (!project?.after_image_url) {
    return new Response("Not found", { status: 404 });
  }

  const upstream = await fetch(project.after_image_url);
  if (!upstream.ok) return new Response("Image unavailable", { status: 502 });
  const input = Buffer.from(await upstream.arrayBuffer());

  try {
    const oriented = sharp(input, { failOn: "none" }).rotate(); // apply EXIF orientation (older posts keep it)

    // Normal case: 1200 px wide, quality stepped down until it fits. Only a
    // very grainy photo can still be too big after that; for those, the last
    // resort is a smaller width, so the size limit always holds.
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
        "Cache-Control":
          "public, max-age=31536000, s-maxage=31536000, immutable",
      },
    });
  } catch {
    return new Response("Could not process image", { status: 500 });
  }
}
