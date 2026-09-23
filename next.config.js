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
    // Lightroom edits are the whole point of this site — don't let the
    // default quality squash them. Grid thumbnails still get resized/lazy
    // loaded for speed; only the compression amount is raised.
    qualities: [75, 90, 95],
  },
};

module.exports = nextConfig;
