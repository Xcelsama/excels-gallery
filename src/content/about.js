/**
 * Content for the /about page. Edit this file directly and redeploy,
 * intentionally not stored in Supabase or editable from /admin, so it never
 * needs a UI just to fix a typo.
 */
const about = {
  heading: "About Excel",
  photo: null, // e.g. "/excel.jpg" in /public, or leave null for no photo
  paragraphs: [
    "Excel Amadi is a self-taught developer and digital creator based in Nigeria, with an interest in photography, visual editing, web development, and creative digital projects.",
    "This gallery is a record of that practice: before-and-after edits worked through in Lightroom Mobile, one photograph at a time, exploring light, color, and composition.",
    "Outside of editing, Excel builds web projects and is currently looking toward a career in software development.",
  ],
  // Optional links row under the bio. Leave the array empty to hide it
  // entirely, or add entries like { label: "GitHub", href: "https://..." }.
  links: [{ label: "GitHub", href: "https://github.com/Xcelsama" }],
};

export default about;
