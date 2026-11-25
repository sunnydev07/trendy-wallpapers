"use client";

import { CheckCircle2, Loader2, ShieldAlert } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

export function DmcaFormClient() {
  const searchParams = useSearchParams();
  const initialUrl = searchParams.get("url") ?? "";
  const initialId = searchParams.get("id") ?? "";

  const [wallpaperUrl, setWallpaperUrl] = useState(initialUrl);
  // The query-string id only matches the URL it was generated from.
  const [wallpaperId, setWallpaperId] = useState(initialId);
  const [reporterName, setReporterName] = useState("");
  const [reporterEmail, setReporterEmail] = useState("");
  const [claimDetails, setClaimDetails] = useState("");
  const [goodFaithConfirmed, setGoodFaithConfirmed] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<{
    referenceId: string;
    receivedAt: string;
    mode: string;
    simulated?: boolean;
  } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const response = await fetch("/api/dmca", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(15_000),
        body: JSON.stringify({
          wallpaperUrl,
          wallpaperId: wallpaperId || undefined,
          reporterName,
          reporterEmail,
          claimDetails,
          goodFaithConfirmed,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Unable to submit DMCA report.");
        return;
      }

      setReceipt({
        referenceId: data.referenceId,
        receivedAt: data.receivedAt,
        mode: data.mode,
        simulated: Boolean(data.simulated),
      });
    } catch (cause) {
      setError(
        cause instanceof DOMException && cause.name === "TimeoutError"
          ? "The takedown service did not respond in time. Your notice was not submitted — please retry."
          : "Network error while submitting DMCA report."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="glass-surface rounded-3xl p-6 sm:p-10">
      <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/35 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-200">
        <ShieldAlert className="h-3.5 w-3.5" />
        Copyright &amp; Takedown Portal
      </div>

      <h1 className="mt-4 font-display text-3xl font-bold text-white sm:text-4xl">
        DMCA Takedown Request
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-slate-300">
        Trendy-Wallpapers responds promptly to valid notices under the Digital
        Millennium Copyright Act (17 U.S.C. § 512). Verified takedown requests are
        logged directly to our moderation queue and typically actioned within 24–48
        hours.
      </p>

      {receipt ? (
        <div className="mt-8 rounded-2xl border border-emerald-400/35 bg-emerald-500/10 p-6">
          <div className="flex items-center gap-2.5 text-emerald-300">
            <CheckCircle2 className="h-5 w-5" />
            <h2 className="font-display text-lg font-bold">
              {receipt.simulated ? "DMCA Notice Simulated (Demo Mode)" : "DMCA Notice Recorded"}
            </h2>
          </div>
          <p className="mt-2 text-sm text-emerald-100/90">
            {receipt.simulated
              ? "This local demo deployment has no moderation database, so nothing was stored. In production the same submission is logged for review; please retain the reference ID."
              : "Your report has been logged for review. Please retain your reference ID for correspondence."}
          </p>
          <dl className="mt-4 space-y-1.5 font-mono text-xs text-emerald-200">
            <div>Reference ID: {receipt.referenceId}</div>
            <div>Timestamp: {receipt.receivedAt}</div>
          </dl>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <div>
            <label
              htmlFor="wallpaper-url"
              className="block text-xs font-semibold uppercase tracking-wider text-slate-300"
            >
              Infringing Wallpaper URL *
            </label>
            <input
              id="wallpaper-url"
              name="wallpaperUrl"
              type="url"
              required
              value={wallpaperUrl}
              onChange={(e) => {
                setWallpaperUrl(e.target.value);
                setWallpaperId("");
              }}
              placeholder="https://trendy-wallpapers.example/wallpaper/..."
              className="mt-2 w-full rounded-xl border border-white/15 bg-black/50 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-[#00F0FF] focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <label
                htmlFor="reporter-name"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-300"
              >
                Full Legal Name or Authorized Agent *
              </label>
              <input
                id="reporter-name"
                name="reporterName"
                type="text"
                required
                minLength={2}
                value={reporterName}
                onChange={(e) => setReporterName(e.target.value)}
                placeholder="Jane Doe / Studio Rights Team"
                className="mt-2 w-full rounded-xl border border-white/15 bg-black/50 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-[#00F0FF] focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="reporter-email"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-300"
              >
                Contact Email *
              </label>
              <input
                id="reporter-email"
                name="reporterEmail"
                type="email"
                required
                value={reporterEmail}
                onChange={(e) => setReporterEmail(e.target.value)}
                placeholder="legal@studio.com"
                className="mt-2 w-full rounded-xl border border-white/15 bg-black/50 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-[#00F0FF] focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="claim-details"
              className="block text-xs font-semibold uppercase tracking-wider text-slate-300"
            >
              Description of Copyrighted Work &amp; Ownership Proof *
            </label>
            <textarea
              id="claim-details"
              name="claimDetails"
              rows={5}
              required
              minLength={25}
              value={claimDetails}
              onChange={(e) => setClaimDetails(e.target.value)}
              placeholder="Identify the original copyrighted work, link to the authorized source, and explain why the listed wallpaper is unauthorized."
              className="mt-2 w-full rounded-xl border border-white/15 bg-black/50 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-[#00F0FF] focus:outline-none"
            />
          </div>

          <label
            htmlFor="dmca-good-faith"
            className="flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-black/35 p-4 text-xs leading-relaxed text-slate-300"
          >
            <input
              id="dmca-good-faith"
              name="goodFaithConfirmed"
              type="checkbox"
              checked={goodFaithConfirmed}
              onChange={(e) => setGoodFaithConfirmed(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-[#FF2E93]"
            />
            <span>
              I have a good-faith belief that use of the material in the manner
              complained of is not authorized by the copyright owner, its agent, or the
              law, and I declare under penalty of perjury that the information in this
              notice is accurate.
            </span>
          </label>

          {error && (
            <div
              role="alert"
              className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-xs text-rose-200"
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="btn-neon inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-sm font-semibold disabled:opacity-50"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Submitting Notice...
              </>
            ) : (
              "Submit DMCA Takedown Notice"
            )}
          </button>
        </form>
      )}
    </div>
  );
}
