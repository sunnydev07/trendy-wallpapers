"use client";

import { Eye, Monitor, Smartphone, Wifi, Battery, Lock, AlertTriangle } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import type { Wallpaper } from "@/types/wallpaper";

type PreviewMode = "raw" | "phone" | "desktop";

interface DevicePreviewStageProps {
  wallpaper: Pick<Wallpaper, "title" | "preview_url" | "width" | "height" | "aspect_ratio">;
}

type PreviewWallpaper = DevicePreviewStageProps["wallpaper"];

function StageImage({
  wallpaper,
  alt,
  contain = false,
  priority = false,
}: {
  wallpaper: PreviewWallpaper;
  alt: string;
  contain?: boolean;
  priority?: boolean;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-[#0B0D12] text-center text-xs text-slate-400">
        <AlertTriangle className="h-5 w-5 text-amber-300" />
        <p>Preview failed to load.</p>
        <button
          type="button"
          onClick={() => setFailed(false)}
          className="rounded-lg border border-white/15 bg-white/[0.06] px-2.5 py-1 text-[11px] font-medium text-white hover:bg-white/[0.12]"
        >
          Retry preview
        </button>
      </div>
    );
  }

  return (
    <Image
      src={wallpaper.preview_url}
      alt={alt}
      fill
      unoptimized
      priority={priority}
      sizes="(min-width: 1024px) 720px, calc(100vw - 3rem)"
      onError={() => setFailed(true)}
      className={contain ? "object-contain" : "object-cover"}
    />
  );
}

export function DevicePreviewStage({ wallpaper }: DevicePreviewStageProps) {
  const defaultMode: PreviewMode =
    wallpaper.aspect_ratio === "9:16" ? "phone" : "raw";
  const [mode, setMode] = useState<PreviewMode>(defaultMode);

  return (
    <div className="overflow-hidden rounded-3xl border border-white/[0.08] bg-[#12151E]/90 p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
          <span>Interactive Preview Stage</span>
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 font-mono text-[11px] text-slate-300">
            {wallpaper.width} × {wallpaper.height}
          </span>
        </div>

        <div className="inline-flex rounded-xl border border-white/10 bg-black/50 p-1">
          <button
            type="button"
            onClick={() => setMode("raw")}
            aria-pressed={mode === "raw"}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              mode === "raw"
                ? "bg-white/15 text-white"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Eye className="h-3.5 w-3.5" />
            Raw
          </button>
          <button
            type="button"
            onClick={() => setMode("phone")}
            aria-pressed={mode === "phone"}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              mode === "phone"
                ? "bg-[#FF2E93] text-white"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Smartphone className="h-3.5 w-3.5" />
            Phone Lock Screen
          </button>
          <button
            type="button"
            onClick={() => setMode("desktop")}
            aria-pressed={mode === "desktop"}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              mode === "desktop"
                ? "bg-[#00F0FF]/25 text-cyan-100 ring-1 ring-inset ring-[#00F0FF]/50"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Monitor className="h-3.5 w-3.5" />
            Desktop OS
          </button>
        </div>
      </div>

      {/* Stage Canvas */}
      <div className="relative flex min-h-[360px] items-center justify-center rounded-2xl border border-white/[0.06] bg-[#06080C] p-4 sm:min-h-[480px] sm:p-8">
        {mode === "raw" && (
          <div
            className="relative w-full max-w-[900px] overflow-hidden rounded-xl border border-white/10 shadow-2xl"
            style={{ aspectRatio: `${wallpaper.width} / ${wallpaper.height}` }}
          >
            <StageImage wallpaper={wallpaper} alt={wallpaper.title} contain priority />
          </div>
        )}

        {mode === "phone" && (
          <div className="relative aspect-[9/19.5] w-[265px] overflow-hidden rounded-[42px] border-[7px] border-[#1B1F2A] bg-black shadow-[0_24px_80px_-12px_rgba(0,0,0,0.9)] ring-1 ring-white/20 sm:w-[295px]">
            <StageImage
              wallpaper={wallpaper}
              alt={`${wallpaper.title} phone lock screen mockup`}
            />

            {/* Dynamic Island + Status Bar */}
            <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between px-6 pt-3.5 text-[11px] font-semibold text-white drop-shadow">
              <span>9:41</span>
              <span className="h-5 w-20 rounded-full bg-black/95 ring-1 ring-white/10" />
              <span className="flex items-center gap-1.5">
                <Wifi className="h-3 w-3" />
                <Battery className="h-3.5 w-3.5" />
              </span>
            </div>

            {/* Lock Screen Clock Overlay */}
            <div className="pointer-events-none absolute inset-x-0 top-14 flex flex-col items-center text-white drop-shadow-[0_4px_18px_rgba(0,0,0,0.65)]">
              <div className="flex items-center gap-1 text-[11px] font-medium tracking-wide text-white/90">
                <Lock className="h-3 w-3" />
                <span>Thursday, November 19</span>
              </div>
              <div className="mt-1 font-display text-6xl font-bold tracking-tight">
                09:41
              </div>
            </div>

            {/* Bottom Lock Screen Actions + Home Bar */}
            <div className="pointer-events-none absolute inset-x-0 bottom-3 flex flex-col items-center gap-3 px-6">
              <div className="flex w-full items-center justify-between">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-[10px] text-white ring-1 ring-white/20">
                  ✦
                </span>
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-[10px] text-white ring-1 ring-white/20">
                  ◉
                </span>
              </div>
              <span className="h-1 w-28 rounded-full bg-white/80" />
            </div>
          </div>
        )}

        {mode === "desktop" && (
          <div className="relative aspect-[16/10] w-full max-w-3xl overflow-hidden rounded-2xl border-[6px] border-[#1A1E28] bg-black shadow-[0_24px_80px_-12px_rgba(0,0,0,0.9)] ring-1 ring-white/15">
            <StageImage
              wallpaper={wallpaper}
              alt={`${wallpaper.title} desktop OS mockup`}
            />

            {/* Translucent Top Menu Bar */}
            <div className="pointer-events-none absolute inset-x-0 top-0 flex h-7 items-center justify-between bg-black/60 px-4 text-[11px] font-medium text-white/90">
              <div className="flex items-center gap-3">
                <span className="font-bold"></span>
                <span>Finder</span>
                <span className="hidden text-white/70 sm:inline">File</span>
                <span className="hidden text-white/70 sm:inline">View</span>
              </div>
              <div className="flex items-center gap-2.5 text-white/85">
                <Wifi className="h-3 w-3" />
                <span>Thu 4:29 PM</span>
              </div>
            </div>

            {/* Floating Window Preview */}
            <div className="pointer-events-none absolute left-6 top-14 hidden w-56 rounded-xl border border-white/15 bg-black/60 p-3 sm:block">
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
              </div>
              <div className="mt-3 space-y-1.5">
                <div className="h-2 w-3/4 rounded bg-white/25" />
                <div className="h-2 w-1/2 rounded bg-white/15" />
              </div>
            </div>

            {/* Floating Dock */}
            <div className="pointer-events-none absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-2xl border border-white/15 bg-black/60 px-3 py-2">
              {["#38BDF8", "#FF2E93", "#A855F7", "#10B981", "#F59E0B", "#E2E8F0"].map(
                (color, idx) => (
                  <span
                    key={idx}
                    className="h-7 w-7 rounded-lg border border-white/20 shadow"
                    style={{ backgroundColor: color }}
                  />
                )
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
