"use client";

import {
  AlertTriangle,
  ArrowUpRight,
  Download,
  Loader2,
  ShieldCheck,
  Smartphone,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { AI_STYLE_PRESETS } from "@/lib/prompt-safety";
import type { AiGenerationResult, AiQuotaStatus } from "@/types/wallpaper";

const ASPECT_OPTIONS: {
  value: "16:9" | "21:9" | "9:16" | "4:3";
  label: string;
  desc: string;
}[] = [
  { value: "16:9", label: "16:9 Desktop", desc: "4K / QHD" },
  { value: "21:9", label: "21:9 Ultrawide", desc: "3440×1440" },
  { value: "9:16", label: "9:16 Mobile", desc: "Lock Screen" },
  { value: "4:3", label: "4:3 Tablet", desc: "iPad / Studio" },
];

export function AiStudioClient() {
  const [prompt, setPrompt] = useState(
    "Rain-slicked coastal boulevard at twilight with palm silhouettes and distant neon skyline"
  );
  const [stylePresetId, setStylePresetId] = useState(AI_STYLE_PRESETS[0].id);
  const [aspectRatio, setAspectRatio] = useState<"16:9" | "21:9" | "9:16" | "4:3">("16:9");
  const [phoneClockMargin, setPhoneClockMargin] = useState(true);
  const [quota, setQuota] = useState<AiQuotaStatus | null>(null);
  const [quotaLoading, setQuotaLoading] = useState(true);
  const [quotaError, setQuotaError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AiGenerationResult | null>(null);
  const [previewFailed, setPreviewFailed] = useState(false);
  const generationInFlight = useRef(false);

  const loadQuota = useCallback(async (signal: AbortSignal) => {
    setQuotaLoading(true);
    setQuotaError(null);
    try {
      const response = await fetch("/api/ai/generate", { signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]) });
      const data = await response.json();
      if (signal.aborted) return;
      if (!response.ok || !data.quota) {
        setQuotaError(data.error ?? "Could not load your daily quota.");
        return;
      }
      // A generation response is always newer than this poll.
      if (!generationInFlight.current) setQuota(data.quota as AiQuotaStatus);
    } catch (cause) {
      if (signal.aborted) return;
      setQuotaError(
        cause instanceof DOMException && cause.name === "TimeoutError"
          ? "Quota check timed out. Retry to continue."
          : "Could not reach the quota service."
      );
    } finally {
      if (!signal.aborted) setQuotaLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadQuota(controller.signal);
    return () => controller.abort();
  }, [loadQuota]);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (generationInFlight.current) return;
    setError(null);
    setLoading(true);
    generationInFlight.current = true;

    try {
      const response = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(90_000),
        body: JSON.stringify({
          prompt,
          stylePresetId,
          aspectRatio,
          phoneClockMargin: aspectRatio === "9:16" ? phoneClockMargin : false,
          modelKey: "flux-schnell",
        }),
      });

      const data = await response.json();
      if (data.quota) setQuota(data.quota);

      if (!response.ok) {
        setError(data.error ?? "Unable to generate wallpaper right now.");
        return;
      }

      setPreviewFailed(false);
      setResult(data as AiGenerationResult);
    } catch (cause) {
      setError(
        cause instanceof DOMException && cause.name === "TimeoutError"
          ? "Generation timed out after 90s. It may still have been created — check your quota before retrying."
          : "Network error while contacting the AI Studio endpoint."
      );
    } finally {
      generationInFlight.current = false;
      setLoading(false);
    }
  }

  const isDisabled =
    loading ||
    quotaLoading ||
    quota === null ||
    Boolean(quota.budgetExhausted) ||
    quota.remaining <= 0;

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
      {/* Left: Studio Controls */}
      <form
        onSubmit={handleGenerate}
        className="glass-surface space-y-6 rounded-3xl p-6 lg:col-span-7"
      >
        {/* Quota & Daily Circuit Breaker Banner */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/40 px-4 py-3">
          <div className="flex items-center gap-2 text-xs text-slate-300">
            <ShieldCheck className="h-4 w-4 text-[#00F0FF]" />
            <span>
              Daily Quota:{" "}
              <strong className="text-white">
                {quotaLoading
                  ? "checking…"
                  : quota
                    ? `${quota.remaining} / ${quota.limit}`
                    : "unavailable"}
              </strong>{" "}
              {quota?.isAuthenticated ? "(Signed In)" : "(Guest)"}
            </span>
            {quotaError && !quotaLoading && (
              <button
                type="button"
                onClick={() => void loadQuota(new AbortController().signal)}
                className="rounded-lg border border-white/15 bg-white/[0.06] px-2 py-1 text-[11px] font-medium text-white hover:bg-white/[0.12]"
              >
                Retry quota check
              </button>
            )}
          </div>
          {quota && (
            <div className="flex items-center gap-2 text-[11px] text-slate-400">
              <span>
                Global Pool: ${quota.dailySpentUsd.toFixed(3)} / $
                {quota.dailyBudgetUsd.toFixed(2)}
              </span>
              {quota.mode === "demo" && (
                <span className="rounded-full border border-[#00F0FF]/30 bg-[#00F0FF]/10 px-2 py-0.5 text-[10px] font-medium text-[#00F0FF]">
                  Demo Sim
                </span>
              )}
            </div>
          )}
        </div>

        {quotaError && (
          <p role="status" className="rounded-2xl border border-amber-400/35 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
            {quotaError}
          </p>
        )}

        {quota?.budgetExhausted && (
          <div className="flex items-start gap-3 rounded-2xl border border-amber-400/35 bg-amber-500/10 p-4 text-xs text-amber-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              Today&apos;s free global AI budget cap has been reached. Generation is
              temporarily paused until 00:00 UTC to keep the studio sustainable.
            </p>
          </div>
        )}

        {/* Prompt Input */}
        <div>
          <label
            htmlFor="ai-prompt"
            className="block text-sm font-semibold text-white"
          >
            Describe Your Wallpaper Scene
          </label>
          <textarea
            id="ai-prompt"
            rows={3}
            maxLength={360}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g., Minimalist obsidian ocean horizon with a thin electric cyan light beam..."
            className="mt-2 w-full rounded-2xl border border-white/15 bg-black/50 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-[#00F0FF] focus:outline-none"
          />
          <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-400">
            <span>All prompts are server-sanitized for family-safe, textless output.</span>
            <span>{prompt.length}/360</span>
          </div>
        </div>

        {/* Vibe Presets */}
        <div>
          <span className="block text-sm font-semibold text-white">Vibe Preset</span>
          <div className="mt-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {AI_STYLE_PRESETS.map((preset) => {
              const active = stylePresetId === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setStylePresetId(preset.id)}
                  className={`flex items-start gap-3 rounded-2xl border p-3.5 text-left transition ${
                    active
                      ? "border-white/30 bg-white/[0.08] ring-1 ring-inset ring-white/15"
                      : "border-white/[0.08] bg-white/[0.02] hover:border-white/20"
                  }`}
                >
                  <span
                    className="mt-1 h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: preset.accentHex }}
                  />
                  <div>
                    <div className="text-xs font-semibold text-white">{preset.name}</div>
                    <p className="mt-0.5 text-[11px] leading-snug text-slate-400">
                      {preset.tagline}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Aspect Ratio Selector */}
        <div>
          <span className="block text-sm font-semibold text-white">Aspect Ratio</span>
          <div className="mt-2.5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {ASPECT_OPTIONS.map((opt) => {
              const active = aspectRatio === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setAspectRatio(opt.value)}
                  className={`rounded-xl border px-3 py-2.5 text-left transition ${
                    active
                      ? "border-[#00F0FF]/50 bg-[#00F0FF]/15 text-white"
                      : "border-white/10 bg-white/[0.02] text-slate-300 hover:border-white/20"
                  }`}
                >
                  <div className="text-xs font-bold">{opt.label}</div>
                  <div className="text-[10px] text-slate-400">{opt.desc}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Phone Clock Margin Toggle (shown when 9:16 selected) */}
        {aspectRatio === "9:16" && (
          <label
            htmlFor="phone-clock-margin"
            className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3"
          >
            <div className="flex items-center gap-2.5">
              <Smartphone className="h-4 w-4 text-[#FF2E93]" />
              <div>
                <div className="text-xs font-semibold text-white">
                  Phone Lock Screen Clock Margin
                </div>
                <div className="text-[11px] text-slate-400">
                  Keeps the upper 28% calm and minimal so your clock stays legible.
                </div>
              </div>
            </div>
            <input
              id="phone-clock-margin"
              name="phoneClockMargin"
              type="checkbox"
              checked={phoneClockMargin}
              onChange={(e) => setPhoneClockMargin(e.target.checked)}
              className="h-4 w-4 accent-[#FF2E93]"
            />
          </label>
        )}

        {error && (
          <div
            role="alert"
            className="rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-xs text-rose-200"
          >
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={isDisabled}
          className="btn-neon flex w-full items-center justify-center gap-2 rounded-2xl px-6 py-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Generating &amp; Indexing Wallpaper...</span>
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              <span>Generate Wallpaper</span>
            </>
          )}
        </button>
      </form>

      {/* Right: Live Result Stage */}
      <div className="glass-surface flex flex-col justify-between rounded-3xl p-6 lg:col-span-5">
        <div>
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-bold text-white">Studio Output</h2>
            <span className="rounded-full border border-[#FF2E93]/40 bg-[#FF2E93]/15 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-pink-200">
              Auto-Labeled AI
            </span>
          </div>

          {!result ? (
            <div className="mt-6 flex min-h-[340px] flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 bg-black/35 p-6 text-center">
              <Sparkles className="h-8 w-8 text-[#00F0FF]" />
              <p className="mt-3 text-sm font-medium text-white">
                Ready to synthesize your backdrop
              </p>
              <p className="mt-1.5 max-w-xs text-xs leading-relaxed text-slate-400">
                Every safe generation is automatically thumbnailed, color-indexed, and
                published to its own permanent SEO page with Smart Download support.
              </p>
            </div>
          ) : (
            <div className="mt-5 space-y-4">
              <div
                className="relative overflow-hidden rounded-2xl border border-white/15 bg-black"
                style={{
                  aspectRatio: `${result.wallpaper.width} / ${result.wallpaper.height}`,
                }}
              >
                {previewFailed ? (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-4 text-center text-xs text-slate-400">
                    <p>Preview failed to load.</p>
                    <button
                      type="button"
                      onClick={() => setPreviewFailed(false)}
                      className="rounded-lg border border-white/15 bg-white/[0.06] px-2.5 py-1 text-[11px] font-medium text-white hover:bg-white/[0.12]"
                    >
                      Retry preview
                    </button>
                  </div>
                ) : (
                  <Image
                    src={result.wallpaper.preview_url}
                    alt={result.wallpaper.title}
                    fill
                    unoptimized
                    sizes="(min-width: 1024px) 420px, calc(100vw - 3rem)"
                    onError={() => setPreviewFailed(true)}
                    className="object-cover"
                  />
                )}
              </div>

              <div>
                <h3 className="font-display text-base font-bold text-white">
                  {result.wallpaper.title}
                </h3>
                <p className="mt-1 text-xs text-slate-400">
                  {result.wallpaper.width}×{result.wallpaper.height} •{" "}
                  {result.wallpaper.aspect_ratio} • Model: {result.modelUsed}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <a
                  href={`/api/download?slug=${encodeURIComponent(result.wallpaper.slug)}&format=png`}
                  download
                  className="btn-neon inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-semibold"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download PNG
                </a>
                <Link
                  href={`/wallpaper/${result.wallpaper.slug}`}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.06] px-4 py-2.5 text-xs font-semibold text-white hover:bg-white/[0.12]"
                >
                  Open Detail Page
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 rounded-2xl border border-white/[0.08] bg-black/35 p-4 text-[11px] leading-relaxed text-slate-400">
          <strong className="text-slate-200">Transparency Policy:</strong> Wallpapers
          created here are stored with{" "}
          <code className="rounded bg-white/10 px-1 text-slate-200">
            source_type = ai_generated
          </code>{" "}
          so visitors can freely include or exclude AI art in the main gallery.
        </div>
      </div>
    </div>
  );
}
