import Image from "next/image";
import about from "@/content/about";

export const metadata = { title: "About" };

export default function AboutPage() {
  // The docs above `about.photo` point people at a local /public path
  // (the normal case), but the field is a free-form string, so this
  // stays defensive: next/image only for a path we can safely size
  // ourselves, anything else (e.g. a full external URL) falls back to a
  // plain <img> rather than risk an optimizer error on an unknown host.
  const isLocalPhoto = about.photo?.startsWith("/");

  return (
    <main className="mx-auto max-w-3xl px-6 py-16 sm:px-8">
      <h1 className="font-display text-3xl text-ink sm:text-4xl">
        {about.heading}
      </h1>

      {about.photo && isLocalPhoto && (
        <Image
          src={about.photo}
          alt=""
          width={192}
          height={240}
          className="mt-8 aspect-[4/5] w-48 rounded-sm object-cover"
        />
      )}
      {about.photo && !isLocalPhoto && (
        <img
          src={about.photo}
          alt=""
          className="mt-8 aspect-[4/5] w-48 rounded-sm object-cover"
        />
      )}

      <div className="mt-8 max-w-prose space-y-5">
        {about.paragraphs.map((paragraph, i) => (
          <p key={i} className="text-ink-muted">
            {paragraph}
          </p>
        ))}
      </div>

      {about.links?.length > 0 && (
        <div className="mt-8 flex flex-wrap gap-4 text-sm">
          {about.links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              target="_blank"
              rel="noreferrer"
              className="text-accent transition-colors hover:text-ink"
            >
              {link.label}
            </a>
          ))}
        </div>
      )}
    </main>
  );
}
