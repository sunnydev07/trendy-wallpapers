import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy (GDPR, CCPA & Google AdSense)",
  description:
    "How Trendy-Wallpapers handles privacy, IP hashing for AI rate limits, GDPR/CCPA rights, and Google AdSense advertising cookies.",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 pb-16 pt-12 sm:px-6 lg:px-8">
      <article className="glass-surface rounded-3xl p-8 sm:p-10">
        <h1 className="font-display text-3xl font-bold text-white sm:text-4xl">
          Privacy Policy
        </h1>
        <p className="mt-2 text-xs text-slate-400">Last updated: November 19, 2026</p>

        <div className="editorial-prose mt-8">
          <p>
            Trendy-Wallpapers respects your privacy and minimizes data collection by
            design. You can browse and download every wallpaper on our site without
            creating an account or submitting personal contact details.
          </p>

          <h2>1. Information We Collect</h2>
          <ul>
            <li>
              <strong>Privacy-Preserving Rate Limit Hashes:</strong> When you use the
              AI Wallpaper Studio as a guest, our server computes a salted one-way
              SHA-256 hash of your IP address to enforce fair daily quotas (2 free
              generations/day). We do not store raw guest IP addresses in our
              application database.
            </li>
            <li>
              <strong>Voluntary Submissions:</strong> If you submit a copyright notice
              via our <Link href="/dmca">DMCA Takedown Portal</Link>, we store the name,
              email address, and claim details you provide strictly to process and
              document the legal request.
            </li>
            <li>
              <strong>Standard Server Telemetry:</strong> Our hosting and CDN edge
              providers process standard HTTP headers (user-agent, requested path,
              referrer) for security, caching, and abuse prevention.
            </li>
          </ul>

          <h2>2. Google AdSense &amp; Third-Party Advertising Cookies</h2>
          <p>
            Trendy-Wallpapers uses <strong>Google AdSense</strong> to keep our high-res
            wallpaper bandwidth and AI Studio free for visitors. Third-party vendors,
            including Google, use cookies to serve ads based on a user&apos;s prior
            visits to this website or other websites on the internet.
          </p>
          <ul>
            <li>
              Google&apos;s use of advertising cookies enables it and its partners to
              serve ads to you based on your visit to Trendy-Wallpapers and/or other
              sites on the internet.
            </li>
            <li>
              You may opt out of personalized advertising at any time by visiting{" "}
              <a
                href="https://www.google.com/settings/ads"
                target="_blank"
                rel="noopener noreferrer"
              >
                Google Ads Settings
              </a>
              .
            </li>
            <li>
              You may also opt out of third-party vendor cookies for personalized
              advertising by visiting{" "}
              <a
                href="https://www.aboutads.info/choices/"
                target="_blank"
                rel="noopener noreferrer"
              >
                www.aboutads.info
              </a>
              .
            </li>
          </ul>

          <h2>3. GDPR (EEA &amp; UK) Privacy Rights</h2>
          <p>
            If you reside in the European Economic Area or United Kingdom, you have the
            right to request access to, correction of, portability of, or deletion of
            any personal data we hold about you, as well as the right to withdraw
            consent for non-essential advertising cookies.
          </p>

          <h2>4. CCPA / CPRA (California) Privacy Rights</h2>
          <p>
            California residents have the right to know what personal information is
            collected, request deletion of personal information, and opt out of the sale
            or sharing of personal information for cross-context behavioral advertising.
            Trendy-Wallpapers does not sell user lists or personal records.
          </p>

          <h2>5. Contact for Privacy Requests</h2>
          <p>
            To exercise any GDPR or CCPA right or ask a privacy question, contact us at{" "}
            <code>privacy@trendy-wallpapers.example</code> or visit our{" "}
            <Link href="/contact">Contact page</Link>.
          </p>
        </div>
      </article>
    </div>
  );
}
