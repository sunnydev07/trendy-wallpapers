"use client";

import { Menu, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

interface NavbarProps {
  demoMode?: boolean;
}

const NAV_LINKS = [
  { href: "/", label: "Explore" },
  { href: "/category/gta-6-vice-city", label: "Vice City" },
  { href: "/resolution/4k", label: "4K & OLED" },
  { href: "/collections", label: "Collections" },
  { href: "/guides", label: "Guides" },
];

export function Navbar({ demoMode = false }: NavbarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.08] bg-[#0B0D12]/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <Link href="/" className="group flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#FF2E93] via-fuchsia-600 to-[#00F0FF] p-[1px] shadow-lg shadow-[#FF2E93]/20">
              <span className="flex h-full w-full items-center justify-center rounded-[11px] bg-[#0B0D12] font-display text-sm font-bold tracking-tight text-white">
                TW
              </span>
            </span>
            <span className="font-display text-lg font-bold tracking-tight text-white">
              Trendy<span className="text-[#FF2E93]">Wallpapers</span>
            </span>
          </Link>
          {demoMode && (
            <span className="hidden rounded-full border border-[#00F0FF]/30 bg-[#00F0FF]/10 px-2.5 py-0.5 text-[11px] font-medium text-[#00F0FF] sm:inline-flex">
              Local Demo Mode
            </span>
          )}
        </div>

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary navigation">
          {NAV_LINKS.map((link) => {
            const isActive =
              link.href === "/"
                ? pathname === "/"
                : pathname === link.href ||
                  (link.href === "/collections" && pathname.startsWith("/collections/"));
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={isActive ? "page" : undefined}
                className={`rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-white/[0.08] text-white ring-1 ring-inset ring-white/15"
                    : "text-slate-300 hover:bg-white/[0.04] hover:text-white"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href="/ai-generator"
            className="btn-neon hidden items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold sm:inline-flex"
          >
            <Sparkles className="h-4 w-4" />
            <span>AI Studio</span>
          </Link>

          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-200 hover:bg-white/[0.08] lg:hidden"
            aria-label="Toggle navigation menu"
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-white/[0.08] bg-[#0B0D12]/95 px-4 py-4 lg:hidden">
          <div className="flex flex-col gap-1.5">
            {NAV_LINKS.map((link) => {
              const isActive =
                link.href === "/"
                  ? pathname === "/"
                  : pathname === link.href ||
                    (link.href === "/collections" && pathname.startsWith("/collections/"));
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={isActive ? "page" : undefined}
                  onClick={() => setMobileOpen(false)}
                  className={`rounded-lg px-3 py-2.5 text-sm font-medium ${
                    isActive
                      ? "bg-white/[0.08] text-white"
                      : "text-slate-200 hover:bg-white/[0.06] hover:text-white"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
            <Link
              href="/ai-generator"
              onClick={() => setMobileOpen(false)}
              className="mt-2 inline-flex items-center justify-center gap-2 rounded-xl bg-white/[0.08] px-4 py-2.5 text-sm font-semibold text-white ring-1 ring-inset ring-white/15"
            >
              <Sparkles className="h-4 w-4 text-[#FF2E93]" />
              Open AI Wallpaper Studio
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
