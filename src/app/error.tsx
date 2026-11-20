"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface the failure for observability without leaking internals to the UI.
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center px-4 py-24 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[#FF2E93]/40 bg-[#FF2E93]/10">
        <AlertTriangle className="h-6 w-6 text-[#FF2E93]" />
      </span>
      <h1 className="mt-6 font-display text-3xl font-bold text-white">
        Something went wrong
      </h1>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-400">
        We hit an unexpected error while loading this page. Your wallpapers are safe —
        try again, or head back to the gallery.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="btn-neon inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold"
        >
          <RotateCcw className="h-4 w-4" />
          Try again
        </button>
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.06] px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/[0.12]"
        >
          Back to gallery
        </Link>
      </div>
    </div>
  );
}
