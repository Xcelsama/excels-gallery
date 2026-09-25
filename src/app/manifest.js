// Next.js App Router convention: this file becomes /manifest.webmanifest
// automatically. Mainly matters if someone adds the site to their phone's
// home screen, gives it a proper name/icon/theme instead of a generic one.
export default function manifest() {
  return {
    name: "Excel's Gallery",
    short_name: "Excel's Gallery",
    description:
      "Before-and-after Lightroom Mobile edits by Excel Amadi.",
    start_url: "/gallery",
    display: "standalone",
    background_color: "#15130f",
    theme_color: "#15130f",
    icons: [
      {
        src: "/apple-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
