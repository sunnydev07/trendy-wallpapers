import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "Terms of Service, personal-use wallpaper license, AI Wallpaper Studio usage rules, and copyright policies for Trendy-Wallpapers.",
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 pb-16 pt-12 sm:px-6 lg:px-8">
      <article className="glass-surface rounded-3xl p-8 sm:p-10">
        <h1 className="font-display text-3xl font-bold text-white sm:text-4xl">
          Terms of Service
        </h1>
        <p className="mt-2 text-xs text-slate-400">Last updated: November 19, 2026</p>

        <div className="editorial-prose mt-8">
          <h2>1. Personal-Use Wallpaper License</h2>
          <p>
            All wallpapers published on Trendy-Wallpapers are provided free of charge
            for <strong>personal, non-commercial display use</strong> on your desktops,
            laptops, tablets, ultrawide monitors, and smartphones. You may not resell,
            redistribute as a competing stock pack, or claim exclusive copyright over
            community or official press artworks hosted on this platform.
          </p>

          <h2>2. AI Wallpaper Studio Acceptable Use</h2>
          <p>
            When generating artwork through our{" "}
            <Link href="/ai-generator">AI Wallpaper Studio</Link>, you agree not to
            submit prompts requesting explicit adult content, graphic violence, hate
            speech, illegal acts, or infringing trademarked logos. Safe generated
            wallpapers are automatically published to the public Trendy-Wallpapers
            catalog with transparent <code>AI Generated</code> attribution so the
            community can discover and download them.
          </p>

          <h2>3. Automated Access &amp; Bandwidth Fair Use</h2>
          <p>
            To keep Smart Downloads fast and free for everyone, automated bulk scraping,
            circumventing Redis rate limits, or hotlinking raw download endpoints from
            third-party websites is strictly prohibited.
          </p>

          <h2>4. Copyright &amp; DMCA Compliance</h2>
          <p>
            We respect the intellectual property rights of creators, studios, and game
            publishers. If you believe any wallpaper hosted on Trendy-Wallpapers
            infringes your copyright, please submit a formal takedown notice via our{" "}
            <Link href="/dmca">DMCA Portal</Link> for prompt review and removal.
          </p>

          <h2>5. Disclaimer</h2>
          <p>
            Trendy-Wallpapers is provided &ldquo;as is&rdquo; without warranties of any
            kind. All game titles, display brand names, and third-party trademarks
            referenced in editorial guides remain the property of their respective
            owners.
          </p>
        </div>
      </article>
    </div>
  );
}
