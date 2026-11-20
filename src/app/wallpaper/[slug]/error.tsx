"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import Link from "next/link";

export default function WallpaperError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center px-4 py-24 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[#00F0FF]/40 bg-[#00F0FF]/10">
        <AlertTriangle className="h-6 w-6 text-[#00F0FF]" />
      </span>
      <h1 className="mt-6 font-display text-3xl font-bold text-white">
        Couldn&apos;t load this wallpaper
      </h1>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-400">
        The preview or download service hit a snag. Retry, or browse the rest of the
        collection while we recover.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="btn-neon inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold"
        >
          <RotateCcw className="h-4 w-4" />
          Retry
        </button>
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.06] px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/[0.12]"
        >
          Browse gallery
        </Link>
      </div>
    </div>
  );
}
