import { Cpu, ShieldCheck, Sparkles, Wallet } from "lucide-react";
import type { Metadata } from "next";
import { getAdSenseSlotId } from "@/lib/env";
import { AdSlot } from "@/components/AdSlot";
import { AiStudioClient } from "@/components/AiStudioClient";

export const metadata: Metadata = {
  title: "AI Wallpaper Studio — Custom 4K, Ultrawide & OLED Generator",
  description:
    "Create custom Vice City Neon, Cyberpunk, and True OLED wallpapers in seconds with Vibe presets, Phone Lock Screen clock margins, and automatic Smart Download publishing.",
};

export default function AiGeneratorPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-10 sm:px-6 lg:px-8">
      <section className="max-w-3xl">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#FF2E93]/35 bg-[#FF2E93]/10 px-3.5 py-1 text-xs font-semibold text-pink-200">
          <Sparkles className="h-3.5 w-3.5" />
          Powered by Fal.ai FLUX • Auto-Indexed SEO Flywheel
        </div>
        <h1 className="mt-4 font-display text-3xl font-bold tracking-tight text-white sm:text-5xl">
          AI Wallpaper Studio
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-400 sm:text-base">
          Describe any scene, choose a curated Vibe preset and aspect ratio, and generate
          a clean, textless wallpaper ready for 4K desktops, 21:9 ultrawides, or 9:16
          AMOLED lock screens.
        </p>
      </section>

      <div className="mt-8">
        <AiStudioClient />
      </div>

      {/* AdSense spacing guardrail: >= 48px away from Generate button */}
      <AdSlot
        slot="ai-studio-below-fold"
        adUnitId={getAdSenseSlotId("studio")}
        format="horizontal"
        minHeight={120}
        label="AI Studio Display Slot"
        className="my-12"
      />

      {/* Transparency & Engineering Guardrails */}
      <section className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-3">
        <div className="glass-surface rounded-2xl p-5">
          <ShieldCheck className="h-5 w-5 text-[#00F0FF]" />
          <h2 className="mt-3 font-display text-base font-bold text-white">
            Strict Safety &amp; AI Labeling
          </h2>
          <p className="mt-2 text-xs leading-relaxed text-slate-400">
            Every prompt passes server-side safety validation before reaching the model,
            and every published result is permanently tagged as{" "}
            <strong className="text-slate-200">AI Generated</strong> so visitors can
            filter human and AI art freely.
          </p>
        </div>

        <div className="glass-surface rounded-2xl p-5">
          <Wallet className="h-5 w-5 text-[#FF2E93]" />
          <h2 className="mt-3 font-display text-base font-bold text-white">
            Fair Daily Quotas
          </h2>
          <p className="mt-2 text-xs leading-relaxed text-slate-400">
            Guests receive 2 free generations per day via privacy-preserving IP hashing,
            and signed-in members receive 5/day—backed by an automated daily USD spend
            circuit breaker.
          </p>
        </div>

        <div className="glass-surface rounded-2xl p-5">
          <Cpu className="h-5 w-5 text-purple-400" />
          <h2 className="mt-3 font-display text-base font-bold text-white">
            Instant Smart Downloads
          </h2>
          <p className="mt-2 text-xs leading-relaxed text-slate-400">
            Each finished piece is automatically thumbnailed, color-extracted for its top
            5 hex codes, and given a permanent detail page with custom Sharp cropping.
          </p>
        </div>
      </section>
    </div>
  );
}
