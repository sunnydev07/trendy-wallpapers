import { ArrowLeft, Calendar, Clock, User } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MDXRemote } from "next-mdx-remote/rsc";
import { AdSlot } from "@/components/AdSlot";
import { getAdSenseSlotId, getSiteUrl } from "@/lib/env";
import { getAllGuides, getGuideBySlug } from "@/lib/guides";

interface GuideArticlePageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return (await getAllGuides()).map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({
  params,
}: GuideArticlePageProps): Promise<Metadata> {
  const { slug } = await params;
  const guide = await getGuideBySlug(slug);
  if (!guide) return { title: "Guide Not Found" };

  return {
    title: guide.title,
    description: guide.excerpt,
    keywords: guide.tags,
    openGraph: {
      type: "article",
      title: guide.title,
      description: guide.excerpt,
      publishedTime: guide.publishedAt,
      modifiedTime: guide.updatedAt,
    },
  };
}

export default async function GuideArticlePage({ params }: GuideArticlePageProps) {
  const { slug } = await params;
  const guide = await getGuideBySlug(slug);

  if (!guide) {
    notFound();
  }

  const relatedGuides = (await getAllGuides()).filter((g) => g.slug !== guide.slug);
  const siteUrl = getSiteUrl();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: guide.title,
    description: guide.excerpt,
    datePublished: guide.publishedAt,
    dateModified: guide.updatedAt,
    author: {
      "@type": "Organization",
      name: guide.author,
    },
    publisher: {
      "@type": "Organization",
      name: "Trendy-Wallpapers",
      url: siteUrl,
    },
    mainEntityOfPage: `${siteUrl}/guides/${guide.slug}`,
  };

  return (
    <div className="mx-auto max-w-4xl px-4 pb-16 pt-10 sm:px-6 lg:px-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <Link
        href="/guides"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-white"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Display Guides
      </Link>

      <article className="glass-surface mt-6 rounded-3xl p-6 sm:p-10">
        <header className="border-b border-white/[0.08] pb-7">
          <span
            className="inline-block rounded-full border border-white/15 px-3 py-1 text-xs font-semibold text-white"
            style={{ backgroundColor: `${guide.accentHex}22` }}
          >
            {guide.category}
          </span>

          <h1 className="mt-4 font-display text-3xl font-bold leading-tight text-white sm:text-4xl">
            {guide.title}
          </h1>

          <p className="mt-4 text-base leading-relaxed text-slate-300">
            {guide.excerpt}
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-4 text-xs text-slate-400">
            <span className="inline-flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-[#00F0FF]" />
              {guide.author}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-[#FF2E93]" />
              Updated {guide.updatedAt}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-slate-400" />
              {guide.readTime}
            </span>
          </div>
        </header>

        <div className="editorial-prose mt-8">
          <MDXRemote
            source={guide.content}
            components={{
              AdSlot: (props: React.ComponentProps<typeof AdSlot>) => (
                <AdSlot {...props} adUnitId={getAdSenseSlotId("guide")} />
              ),
            }}
          />
        </div>
      </article>

      {relatedGuides.length > 0 && (
        <section className="mt-14">
          <h2 className="font-display text-xl font-bold text-white">
            Continue Reading
          </h2>
          <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
            {relatedGuides.map((item) => (
              <Link
                key={item.slug}
                href={`/guides/${item.slug}`}
                className="glass-surface group rounded-2xl p-5 transition hover:border-white/20"
              >
                <div className="text-xs font-semibold text-[#00F0FF]">
                  {item.category} • {item.readTime}
                </div>
                <h3 className="mt-2 font-display text-base font-bold text-white group-hover:text-[#FF2E93]">
                  {item.title}
                </h3>
                <p className="mt-2 line-clamp-2 text-xs text-slate-400">
                  {item.excerpt}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
