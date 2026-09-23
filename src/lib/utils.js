/**
 * "Published September 23, 2026 · 12:48 AM" — from a Postgres timestamptz
 * string. Formatted on the server (and re-usable on the client) so it never
 * depends on the visitor's own device clock/locale for correctness, only
 * for which timezone it displays in.
 */
export function formatPublished(dateString) {
  const date = new Date(dateString);
  const datePart = date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const timePart = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  return `Published ${datePart} · ${timePart}`;
}

/** "moody, golden hour,  portrait" -> ["moody", "golden hour", "portrait"] */
export function parseTagsInput(raw) {
  return Array.from(
    new Set(
      raw
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean)
    )
  );
}

export function joinClasses(...classes) {
  return classes.filter(Boolean).join(" ");
}
