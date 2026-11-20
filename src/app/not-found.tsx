import { Compass, Search } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center px-4 py-24 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[#7C3AED]/40 bg-[#7C3AED]/10">
        <Compass className="h-6 w-6 text-[#A78BFA]" />
      </span>
      <p className="mt-6 font-mono text-sm font-semibold uppercase tracking-widest text-[#00F0FF]">
        404
      </p>
      <h1 className="mt-2 font-display text-3xl font-bold text-white">
        This page drifted off-screen
      </h1>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-400">
        The wallpaper or page you&apos;re looking for doesn&apos;t exist or was moved.
        Explore the gallery or read a setup guide instead.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/"
          className="btn-neon inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold"
        >
          <Search className="h-4 w-4" />
          Explore wallpapers
        </Link>
        <Link
          href="/guides"
          className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.06] px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/[0.12]"
        >
          Read guides
        </Link>
      </div>
    </div>
  );
}
