import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

interface GalleryPaginationProps {
  pathname: string;
  page: number;
  hasNextPage: boolean;
  /** Current query string (without a leading "?"). */
  query: string;
}

function pageHref(pathname: string, query: string, page: number): string {
  const params = new URLSearchParams(query);
  if (page <= 1) params.delete("page");
  else params.set("page", String(page));
  const search = params.toString();
  return search ? `${pathname}?${search}` : pathname;
}

/**
 * Server-rendered pagination: links work without JavaScript and preserve every active
 * filter/search/sort parameter. Page size stays server-controlled.
 */
export function GalleryPagination({ pathname, page, hasNextPage, query }: GalleryPaginationProps) {
  if (page <= 1 && !hasNextPage) return null;

  return (
    <nav
      aria-label="Wallpaper gallery pages"
      className="mt-10 flex items-center justify-between gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3"
    >
      {page > 1 ? (
        <Link
          href={pageHref(pathname, query, page - 1)}
          rel="prev"
          aria-label={`Previous page, page ${page - 1}`}
          className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2 text-xs font-semibold text-slate-200 hover:border-white/25 hover:text-white"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Previous
        </Link>
      ) : (
        <span aria-hidden="true" className="w-[104px]" />
      )}

      <span aria-live="polite" className="text-xs font-medium text-slate-400">
        Page {page}
      </span>

      {hasNextPage ? (
        <Link
          href={pageHref(pathname, query, page + 1)}
          rel="next"
          aria-label={`Next page, page ${page + 1}`}
          className="inline-flex items-center gap-1.5 rounded-xl border border-[#00F0FF]/35 bg-[#00F0FF]/10 px-3.5 py-2 text-xs font-semibold text-cyan-100 hover:bg-[#00F0FF]/20"
        >
          Next
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      ) : (
        <span aria-hidden="true" className="w-[104px]" />
      )}
    </nav>
  );
}
