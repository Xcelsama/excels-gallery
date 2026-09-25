/** @type {import('next').NextConfig} */

// Supabase Storage serves public files from https://<project-ref>.supabase.co/storage/...
// We derive the hostname from the same env var the app already uses, so nobody
// has to hardcode a project ref here or update it when the project changes.
function supabaseImageHostname() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

const supabaseHostname = supabaseImageHostname();

const nextConfig = {
  images: {
    remotePatterns: supabaseHostname
      ? [
          {
            protocol: "https",
            hostname: supabaseHostname,
            pathname: "/storage/v1/object/public/**",
          },
        ]
      : [],
    // Lightroom edits are the whole point of this site, don't let the
    // default quality squash them. Grid thumbnails still get resized/lazy
    // loaded for speed; only the compression amount is raised.
    qualities: [75, 90, 95],
    // AVIF first (smallest for photographic images at a given quality),
    // falling back to WebP, then the source format for browsers that
    // support neither. This is the main lever on "images are large": a
    // multi-MB source photo typically comes back well under a few hundred
    // KB once resized + re-encoded here.
    formats: ["image/avif", "image/webp"],
  },
};

module.exports = nextConfig;
