// Next.js App Router convention: this file becomes /robots.txt
// automatically, no route handler needed.
export default function robots() {
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000");

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // The admin area is already auth-gated (see middleware.js), this
        // is just belt-and-suspenders so it's never suggested in search
        // results either.
        disallow: "/admin",
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
