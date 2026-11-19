"use client";

import { Check, Copy, Palette } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

interface ColorPaletteChipsProps {
  colors: string[];
}

export function ColorPaletteChips({ colors }: ColorPaletteChipsProps) {
  const [copiedHex, setCopiedHex] = useState<string | null>(null);

  async function handleCopy(hex: string) {
    try {
      await navigator.clipboard.writeText(hex);
      setCopiedHex(hex);
      window.setTimeout(() => {
        setCopiedHex((current) => (current === hex ? null : current));
      }, 1800);
    } catch {
      // Clipboard API unavailable in restricted context
    }
  }

  return (
    <div className="glass-surface rounded-2xl p-5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <Palette className="h-4 w-4 text-[#00F0FF]" />
          <span>Dominant Color Palette</span>
        </div>
        <span className="text-xs text-slate-400">Click hex to copy</span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-5">
        {colors.slice(0, 5).map((hex) => {
          const isCopied = copiedHex === hex;
          return (
            <div
              key={hex}
              className="group flex flex-col overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] transition hover:border-white/25"
            >
              <button
                type="button"
                onClick={() => handleCopy(hex)}
                className="flex flex-col items-stretch text-left"
                title={`Copy ${hex}`}
              >
                <span
                  className="h-12 w-full border-b border-white/10"
                  style={{ backgroundColor: hex }}
                />
                <span className="flex items-center justify-between px-2.5 py-2 font-mono text-xs text-slate-200">
                  <span>{hex}</span>
                  {isCopied ? (
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="h-3.5 w-3.5 text-slate-500 transition group-hover:text-white" />
                  )}
                </span>
              </button>
              <Link
                href={`/?color=${encodeURIComponent(hex)}`}
                className="border-t border-white/[0.06] bg-white/[0.02] px-2.5 py-1 text-[10px] font-medium text-slate-400 hover:text-[#00F0FF]"
              >
                Filter similar →
              </Link>
            </div>
          );
        })}
      </div>

      {copiedHex && (
        <div
          role="status"
          aria-live="polite"
          className="mt-3 inline-flex items-center gap-2 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300"
        >
          <Check className="h-3.5 w-3.5" />
          Copied <span className="font-mono">{copiedHex}</span> to clipboard
        </div>
      )}
    </div>
  );
}
