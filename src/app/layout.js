import { Fraunces, Work_Sans } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  display: "swap",
});

const sans = Work_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600"],
  display: "swap",
});

// Used to resolve relative OG/Twitter image URLs (see the gallery detail
// page's generateMetadata) into absolute ones, which social platforms
// require. Set NEXT_PUBLIC_SITE_URL in your env once the site has a real
// domain; Vercel deployments get a working fallback automatically via
// VERCEL_URL even before that's set.
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

export const metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Excel's Gallery",
    template: "%s | Excel's Gallery",
  },
  description:
    "Before-and-after Lightroom Mobile edits by Excel Amadi: a study in light, color, and composition.",
};

export const viewport = {
  themeColor: "#15130f",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`}>
      <body className="bg-bg text-ink font-sans antialiased">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
