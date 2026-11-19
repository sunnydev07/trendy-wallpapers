"use client";

import { useEffect, useRef } from "react";
import { getAdSenseClientId } from "@/lib/env";

interface AdSlotProps {
  /** Human-readable placement label, shown in the reserved preview frame. */
  slot: string;
  /** Numeric AdSense ad unit ID. Live ads only render when this is a valid ID. */
  adUnitId?: string;
  format?: "auto" | "fluid" | "rectangle" | "horizontal";
  minHeight?: number;
  label?: string;
  className?: string;
}

declare global {
  interface Window {
    adsbygoogle?: Record<string, unknown>[];
  }
}

/** Fixed geometry per format so a growing creative cannot shift the page. */
const FORMAT_HEIGHTS: Record<NonNullable<AdSlotProps["format"]>, number> = {
  auto: 0,
  fluid: 0,
  rectangle: 250,
  horizontal: 90,
};

/**
 * CLS-safe Google AdSense wrapper.
 * - Reserves explicit height (format height or minHeight) so Cumulative Layout Shift stays < 0.05.
 * - Enforces generous vertical margin (`my-12` = 48px) away from Download/Generate buttons.
 * - Renders a clean, non-deceptive dev preview frame until both a client ID and a numeric
 *   ad unit ID are configured.
 */
export function AdSlot({
  slot,
  adUnitId,
  format = "auto",
  minHeight = 120,
  label = "Advertisement",
  className = "",
}: AdSlotProps) {
  const clientId = getAdSenseClientId();
  const numericAdUnit = adUnitId && /^\d{6,}$/.test(adUnitId) ? adUnitId : null;
  const reservedHeight = FORMAT_HEIGHTS[format] || minHeight;
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!clientId || !numericAdUnit || initializedRef.current) return;
    initializedRef.current = true;
    try {
      window.adsbygoogle = window.adsbygoogle || [];
      window.adsbygoogle.push({});
    } catch {
      // AdSense script may be blocked by browser extensions; fail silently with reserved height.
    }
  }, [clientId, numericAdUnit]);

  if (!clientId || !numericAdUnit) {
    return (
      <aside
        aria-label="Sponsored placement preview"
        className={`my-12 w-full ${className}`}
      >
        <div
          style={{ minHeight: `${reservedHeight}px` }}
          className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/[0.12] bg-white/[0.02] px-4 py-6 text-center"
        >
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
            {label}
          </span>
          <p className="mt-2 text-xs text-slate-500">
            CLS-reserved AdSense container (<code className="text-slate-400">{slot}</code> •{" "}
            {reservedHeight}px min-height)
          </p>
        </div>
      </aside>
    );
  }

  return (
    <aside aria-label="Advertisement" className={`my-12 w-full ${className}`}>
      <div className="mb-1.5 text-center text-[10px] font-medium uppercase tracking-widest text-slate-500">
        Advertisement
      </div>
      <div
        style={{ minHeight: `${reservedHeight}px` }}
        className="flex items-center justify-center overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02]"
      >
        <ins
          className="adsbygoogle block w-full"
          style={{ display: "block", minHeight: `${reservedHeight}px` }}
          data-ad-client={clientId}
          data-ad-slot={numericAdUnit}
          data-ad-format={format}
          data-full-width-responsive="true"
        />
      </div>
    </aside>
  );
}
