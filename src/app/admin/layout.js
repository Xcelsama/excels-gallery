// Wraps both /admin/login and everything under /admin/(protected), so this
// one metadata export keeps the entire admin area out of search results.
// robots.js already disallows /admin for crawlers, but that only stops
// crawling, a page already linked or indexed from elsewhere wouldn't
// necessarily be dropped by that alone. This <meta name="robots"> tag is
// the stronger, page-level signal search engines actually honor for
// de-indexing.
export const metadata = {
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }) {
  return children;
}
