"use client";

import { CheckCircle2, Crop, Download, Monitor, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";
import type { DownloadFormatOption, Wallpaper } from "@/types/wallpaper";

interface SmartDownloadPanelProps {
  wallpaper: Pick<Wallpaper, "slug" | "width" | "height">;
}

const FORMAT_OPTIONS: DownloadFormatOption[] = [
  { format: "webp", label: "WebP", hint: "Best balance" },
  { format: "png", label: "PNG", hint: "Lossless OLED" },
  { format: "jpg", label: "JPG", hint: "Universal" },
];

const QUICK_PRESETS = [
  { label: "4K UHD", w: 3840, h: 2160 },
  { label: "QHD 1440p", w: 2560, h: 1440 },
  { label: "Ultrawide 21:9", w: 3440, h: 1440 },
  { label: "Mobile 9:16", w: 1440, h: 2560 },
];

const MIN_DIMENSION = 320;
const MAX_SIDE = 7680;
const MAX_OUTPUT_PIXELS = 7680 * 4320;

function parseDimension(raw: string, max: number): number | null {
  if (!/^\d+$/.test(raw.trim())) return null;
  const value = Number.parseInt(raw, 10);
  return value >= MIN_DIMENSION && value <= max ? value : null;
}

/** Mirrors the server's output ceiling so the UI never offers a URL the API rejects. */
function isSupportedGeometry(width: number, height: number): boolean {
  return (
    width >= MIN_DIMENSION &&
    height >= MIN_DIMENSION &&
    width <= MAX_SIDE &&
    height <= MAX_SIDE &&
    width * height <= MAX_OUTPUT_PIXELS
  );
}

export function SmartDownloadPanel({ wallpaper }: SmartDownloadPanelProps) {
  // Screen size is an estimate: screen.width/height multiplied by DPR, not guaranteed native pixels.
  const [detectedScreen, setDetectedScreen] = useState<{
    w: number;
    h: number;
    isMobile: boolean;
  } | null>(null);
  const [oversizedScreen, setOversizedScreen] = useState(false);

  const [format, setFormat] = useState<"webp" | "png" | "jpg">("webp");
  const [customWidth, setCustomWidth] = useState(String(wallpaper.width));
  const [customHeight, setCustomHeight] = useState(String(wallpaper.height));
  const [fitMode, setFitMode] = useState<"cover" | "contain">("cover");
  const [showCustom, setShowCustom] = useState(false);

  useEffect(() => {
    const detect = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      const w = Math.round(window.screen.width * dpr);
      const h = Math.round(window.screen.height * dpr);
      if (w < MIN_DIMENSION || h < MIN_DIMENSION) return;
      if (!isSupportedGeometry(w, h)) {
        // Never present an Auto-Fit link that the download API must reject.
        setDetectedScreen(null);
        setOversizedScreen(true);
        return;
      }
      setOversizedScreen(false);
      setDetectedScreen({ w, h, isMobile: h > w });
    };
    detect();
    window.addEventListener("resize", detect);
    window.addEventListener("orientationchange", detect);
    return () => {
      window.removeEventListener("resize", detect);
      window.removeEventListener("orientationchange", detect);
    };
  }, []);

  const buildDownloadUrl = (w?: number, h?: number) => {
    const params = new URLSearchParams({
      slug: wallpaper.slug,
      format,
      fit: fitMode,
    });
    if (w) params.set("w", String(w));
    if (h) params.set("h", String(h));
    return `/api/download?${params.toString()}`;
  };

  const parsedWidth = parseDimension(customWidth, MAX_SIDE);
  const parsedHeight = parseDimension(customHeight, MAX_SIDE);
  const customValid =
    parsedWidth !== null &&
    parsedHeight !== null &&
    parsedWidth * parsedHeight <= MAX_OUTPUT_PIXELS;

  return (
    <div className="rounded-3xl border border-white/[0.08] bg-[#12151E]/90 p-5 sm:p-6">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-lg font-bold text-white">Smart Download</h2>
        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-300">
          <CheckCircle2 className="h-3 w-3" />
          Free • No Login
        </span>
      </div>

      {/* Format Picker */}
      <div className="mt-4">
        <span id="output-format-label" className="text-xs font-medium text-slate-400">
          Output Format
        </span>
        <div role="group" aria-labelledby="output-format-label" className="mt-2 grid grid-cols-3 gap-2">
          {FORMAT_OPTIONS.map((opt) => {
            const active = format === opt.format;
            return (
              <button
                key={opt.format}
                type="button"
                aria-pressed={active}
                onClick={() => setFormat(opt.format)}
                className={`rounded-xl border px-3 py-2 text-left transition ${
                  active
                    ? "border-[#00F0FF]/50 bg-[#00F0FF]/15 text-white"
                    : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/20"
                }`}
              >
                <div className="text-xs font-bold">{opt.label}</div>
                <div className="text-[10px] text-slate-400">{opt.hint}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Primary Action: Native Original Download */}
      <div className="mt-5 space-y-2.5">
        <a
          href={buildDownloadUrl(wallpaper.width, wallpaper.height)}
          download
          className="btn-neon flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-3.5 text-sm font-semibold"
        >
          <Download className="h-4 w-4" />
          <span>
            Download Original ({wallpaper.width}×{wallpaper.height} {format.toUpperCase()})
          </span>
        </a>

        {/* Space is reserved before detection so the panel never shifts after hydration. */}
        <div className="min-h-[46px]">
          {oversizedScreen && !detectedScreen && (
            <p className="rounded-xl border border-amber-400/35 bg-amber-500/10 px-3 py-2 text-[11px] leading-relaxed text-amber-200">
              This screen exceeds the 7,680 px / 33.2 MP export limit. Use a preset or a
              custom resolution instead.
            </p>
          )}
          {detectedScreen && (
            <a
              href={buildDownloadUrl(detectedScreen.w, detectedScreen.h)}
              download
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[#00F0FF]/35 bg-[#00F0FF]/10 px-4 py-3 text-xs font-semibold text-cyan-100 transition hover:bg-[#00F0FF]/20"
            >
              {detectedScreen.isMobile ? (
                <Smartphone className="h-4 w-4 text-[#00F0FF]" />
              ) : (
                <Monitor className="h-4 w-4 text-[#00F0FF]" />
              )}
              <span>
                Auto-Fit Estimated Screen ({detectedScreen.w}×{detectedScreen.h})
              </span>
            </a>
          )}
        </div>
      </div>

      {/* Quick Device Presets */}
      <div className="mt-5">
        <div className="text-xs font-medium text-slate-400">Quick Resize Presets</div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {QUICK_PRESETS.map((preset) => (
            <a
              key={preset.label}
              href={buildDownloadUrl(preset.w, preset.h)}
              download
              className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-slate-200 transition hover:border-white/25 hover:bg-white/[0.07]"
            >
              <span className="font-medium">{preset.label}</span>
              <span className="font-mono text-[10px] text-slate-400">
                {preset.w}×{preset.h}
              </span>
            </a>
          ))}
        </div>
      </div>

      {/* Custom Resolution & Cropper Accordion */}
      <div className="mt-5 border-t border-white/[0.08] pt-4">
        <button
          type="button"
          onClick={() => setShowCustom((prev) => !prev)}
          aria-expanded={showCustom}
          className="flex w-full items-center justify-between text-xs font-semibold text-slate-300 hover:text-white"
        >
          <span className="inline-flex items-center gap-1.5">
            <Crop className="h-3.5 w-3.5 text-[#FF2E93]" />
            Custom Resolution &amp; Cropper
          </span>
          <span className="text-slate-500">{showCustom ? "Hide" : "Expand"}</span>
        </button>

        {showCustom && (
          <div className="mt-3 space-y-3 rounded-2xl border border-white/10 bg-black/40 p-3.5">
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-[11px] text-slate-400" htmlFor="custom-width">
                  Width (px)
                </label>
                <input
                  id="custom-width"
                  type="text"
                  inputMode="numeric"
                  value={customWidth}
                  onChange={(e) => setCustomWidth(e.target.value)}
                  aria-invalid={parsedWidth === null}
                  className="mt-1 w-full rounded-lg border border-white/15 bg-[#0B0D12] px-2.5 py-1.5 font-mono text-xs text-white focus:border-[#00F0FF] focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-400" htmlFor="custom-height">
                  Height (px)
                </label>
                <input
                  id="custom-height"
                  type="text"
                  inputMode="numeric"
                  value={customHeight}
                  onChange={(e) => setCustomHeight(e.target.value)}
                  aria-invalid={parsedHeight === null}
                  className="mt-1 w-full rounded-lg border border-white/15 bg-[#0B0D12] px-2.5 py-1.5 font-mono text-xs text-white focus:border-[#00F0FF] focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setFitMode("cover")}
                aria-pressed={fitMode === "cover"}
                className={`flex-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium ${
                  fitMode === "cover"
                    ? "border-[#FF2E93]/50 bg-[#FF2E93]/15 text-pink-100"
                    : "border-white/10 text-slate-400"
                }`}
              >
                Smart Crop (Fill)
              </button>
              <button
                type="button"
                onClick={() => setFitMode("contain")}
                aria-pressed={fitMode === "contain"}
                className={`flex-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium ${
                  fitMode === "contain"
                    ? "border-[#FF2E93]/50 bg-[#FF2E93]/15 text-pink-100"
                    : "border-white/10 text-slate-400"
                }`}
              >
                Fit Inside (No Crop)
              </button>
            </div>

            {customValid ? (
              <a
                href={buildDownloadUrl(parsedWidth, parsedHeight)}
                download
                className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs font-semibold text-white hover:bg-white/15"
              >
                <Download className="h-3.5 w-3.5" />
                Export {parsedWidth}×{parsedHeight} {format.toUpperCase()}
              </a>
            ) : (
              <p className="rounded-xl border border-amber-400/35 bg-amber-500/10 px-3 py-2 text-center text-[11px] font-medium text-amber-200">
                Enter whole numbers between {MIN_DIMENSION} and {MAX_SIDE} per side, up to
                33.2 megapixels total.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
