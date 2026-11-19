export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-8 sm:px-6 lg:px-8" aria-busy="true">
      <span className="sr-only" role="status">
        Loading wallpaper
      </span>
      <div className="h-4 w-40 animate-pulse rounded-lg bg-white/[0.05] motion-reduce:animate-none" />
      <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-8">
          <div className="aspect-[16/9] w-full animate-pulse rounded-3xl bg-white/[0.05] motion-reduce:animate-none" />
          <div className="h-64 animate-pulse rounded-3xl bg-white/[0.04] motion-reduce:animate-none" />
        </div>
        <div className="space-y-6 lg:col-span-4">
          <div className="h-80 animate-pulse rounded-3xl bg-white/[0.04] motion-reduce:animate-none" />
          <div className="h-56 animate-pulse rounded-3xl bg-white/[0.03] motion-reduce:animate-none" />
        </div>
      </div>
    </div>
  );
}
