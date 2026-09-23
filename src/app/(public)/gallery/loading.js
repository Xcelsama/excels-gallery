export default function GalleryLoading() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-12 sm:px-8">
      <div className="h-10 w-full max-w-xs animate-pulse rounded-full bg-surface" />
      <div className="mt-8 grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i}>
            <div className="aspect-[4/5] animate-pulse bg-surface" />
            <div className="mt-3 h-4 w-2/3 animate-pulse rounded bg-surface" />
            <div className="mt-2 h-3 w-1/3 animate-pulse rounded bg-surface" />
          </div>
        ))}
      </div>
    </main>
  );
}
