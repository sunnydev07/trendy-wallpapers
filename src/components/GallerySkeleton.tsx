interface GallerySkeletonProps {
  cards?: number;
}

/** Reserved masonry geometry so route transitions do not shift layout. */
export function GallerySkeleton({ cards = 9 }: GallerySkeletonProps) {
  const ratios = ["16 / 9", "9 / 16", "21 / 9", "16 / 9", "1 / 1", "9 / 16"];
  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-8 sm:px-6 lg:px-8" aria-busy="true">
      <span className="sr-only" role="status">
        Loading wallpapers
      </span>
      <div className="h-10 w-2/3 max-w-md animate-pulse rounded-2xl bg-white/[0.06] motion-reduce:animate-none" />
      <div className="mt-4 h-4 w-1/2 max-w-sm animate-pulse rounded-lg bg-white/[0.04] motion-reduce:animate-none" />
      <div className="mt-8 h-28 animate-pulse rounded-2xl bg-white/[0.04] motion-reduce:animate-none" />
      <div className="mt-8 columns-1 gap-5 sm:columns-2 lg:columns-3">
        {Array.from({ length: cards }).map((_, index) => (
          <div
            key={index}
            className="mb-5 inline-block w-full break-inside-avoid overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] align-top"
          >
            <div
              className="w-full animate-pulse bg-white/[0.05] motion-reduce:animate-none"
              style={{ aspectRatio: ratios[index % ratios.length] }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
