import { Mail, MessageSquare, ShieldAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Contact Us",
  description:
    "Reach the Trendy-Wallpapers team for artist submissions, editorial collaborations, technical support, or copyright inquiries.",
};

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 pb-16 pt-12 sm:px-6 lg:px-8">
      <div className="glass-surface rounded-3xl p-8 sm:p-10">
        <h1 className="font-display text-3xl font-bold text-white sm:text-4xl">
          Contact Trendy-Wallpapers
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-300 sm:text-base">
          Have original 4K or ultrawide artwork to feature, spotted a display bug, or
          need to reach our licensing desk? Use the dedicated channel below for the
          fastest response.
        </p>

        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/[0.08] bg-black/35 p-5">
            <Mail className="h-5 w-5 text-[#00F0FF]" />
            <h2 className="mt-3 font-display text-sm font-bold text-white">
              General &amp; Artist Submissions
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-slate-400">
              Send portfolio links, press kits, or partnership proposals.
            </p>
            <a
              href="mailto:hello@trendy-wallpapers.example"
              className="mt-3 inline-block font-mono text-xs text-[#00F0FF] hover:underline"
            >
              hello@trendy-wallpapers.example
            </a>
          </div>

          <div className="rounded-2xl border border-white/[0.08] bg-black/35 p-5">
            <MessageSquare className="h-5 w-5 text-[#FF2E93]" />
            <h2 className="mt-3 font-display text-sm font-bold text-white">
              Editorial &amp; Advertising
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-slate-400">
              Inquiries regarding display guides, sponsorships, or brand safety.
            </p>
            <a
              href="mailto:editorial@trendy-wallpapers.example"
              className="mt-3 inline-block font-mono text-xs text-[#FF2E93] hover:underline"
            >
              editorial@trendy-wallpapers.example
            </a>
          </div>

          <div className="rounded-2xl border border-white/[0.08] bg-black/35 p-5">
            <ShieldAlert className="h-5 w-5 text-amber-400" />
            <h2 className="mt-3 font-display text-sm font-bold text-white">
              Copyright &amp; DMCA Desk
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-slate-400">
              For fastest removal or attribution correction, use our logged DMCA portal.
            </p>
            <Link
              href="/dmca"
              className="mt-3 inline-block text-xs font-semibold text-amber-300 hover:underline"
            >
              Open DMCA Form →
            </Link>
          </div>
        </div>

        <p className="mt-8 border-t border-white/[0.08] pt-5 text-xs text-slate-500">
          Typical response window: 1–2 business days for editorial inquiries, and within
          24–48 hours for verified DMCA takedown requests.
        </p>
      </div>
    </div>
  );
}
