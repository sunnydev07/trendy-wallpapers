import Link from "next/link";

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-24 border-t border-white/[0.08] bg-[#080A0E]">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <Link href="/" className="inline-flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#FF2E93] to-[#00F0FF] p-[1px]">
                <span className="flex h-full w-full items-center justify-center rounded-[7px] bg-[#0B0D12] font-display text-xs font-bold text-white">
                  TW
                </span>
              </span>
              <span className="font-display text-base font-bold text-white">
                Trendy<span className="text-[#FF2E93]">Wallpapers</span>
              </span>
            </Link>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-slate-400">
              High-craft 4K, Ultrawide, and True OLED wallpapers with transparent AI
              labeling, zero login walls, and server-side Smart Downloads tailored to
              your exact screen resolution.
            </p>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              Categories
            </h3>
            <ul className="mt-4 space-y-2.5 text-sm text-slate-400">
              <li>
                <Link href="/category/gta-6-vice-city" className="hover:text-white">
                  GTA 6 &amp; Vice City
                </Link>
              </li>
              <li>
                <Link href="/category/cyberpunk" className="hover:text-white">
                  Cyberpunk &amp; Sci-Fi
                </Link>
              </li>
              <li>
                <Link href="/category/minimalist-oled" className="hover:text-white">
                  Minimalist OLED
                </Link>
              </li>
              <li>
                <Link href="/category/ultrawide" className="hover:text-white">
                  Ultrawide 21:9
                </Link>
              </li>
              <li>
                <Link href="/category/mobile" className="hover:text-white">
                  Mobile Lock Screen
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              Resolutions &amp; Editorial
            </h3>
            <ul className="mt-4 space-y-2.5 text-sm text-slate-400">
              <li>
                <Link href="/resolution/4k" className="hover:text-white">
                  4K UHD (3840×2160)
                </Link>
              </li>
              <li>
                <Link href="/resolution/ultrawide" className="hover:text-white">
                  Ultrawide (3440×1440)
                </Link>
              </li>
              <li>
                <Link href="/resolution/mobile" className="hover:text-white">
                  Mobile 9:16 AMOLED
                </Link>
              </li>
              <li>
                <Link href="/collections/vice-city-midnight-pack" className="hover:text-white">
                  Curated Collections
                </Link>
              </li>
              <li>
                <Link href="/guides" className="hover:text-white">
                  Display Guides
                </Link>
              </li>
              <li>
                <Link href="/ai-generator" className="hover:text-white">
                  AI Wallpaper Studio
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              Company &amp; Legal
            </h3>
            <ul className="mt-4 space-y-2.5 text-sm text-slate-400">
              <li>
                <Link href="/about" className="hover:text-white">
                  About Us
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-white">
                  Contact
                </Link>
              </li>
              <li>
                <Link href="/privacy-policy" className="hover:text-white">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-white">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href="/dmca" className="hover:text-white">
                  DMCA Takedown
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/[0.06] pt-6 text-xs text-slate-500 sm:flex-row">
          <p>© {year} Trendy-Wallpapers. All rights reserved.</p>
          <p>
            Zero login walls • Transparent AI labeling • Personal use wallpaper license
          </p>
        </div>
      </div>
    </footer>
  );
}
