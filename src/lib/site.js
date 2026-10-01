/**
 * The site's public, absolute base URL (no trailing slash).
 *
 * Link previews (WhatsApp, iMessage, X...) need ABSOLUTE urls for og:url and
 * og:image, so everything that builds one goes through here.
 *
 * Order of preference:
 *  1. NEXT_PUBLIC_SITE_URL, your real domain, once you have one.
 *  2. VERCEL_PROJECT_PRODUCTION_URL, the project's stable production address.
 *     This one matters: VERCEL_URL (below) is the address of ONE specific
 *     deployment, and Vercel's deployment protection can block those from
 *     outside visitors, including WhatsApp's link-preview crawler.
 *  3. VERCEL_URL, only as a last resort (preview deployments).
 *  4. localhost, for `npm run dev`.
 *
 * A blank NEXT_PUBLIC_SITE_URL= line (as in .env.local.example) counts as
 * "not set" instead of crashing `new URL("")`.
 */
export function getSiteUrl() {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");

  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (production) return `https://${production}`;

  const deployment = process.env.VERCEL_URL?.trim();
  if (deployment) return `https://${deployment}`;

  return "http://localhost:3000";
}
