import fs from "node:fs/promises";
import path from "node:path";
import { cache } from "react";
import matter from "gray-matter";
import type { GuideArticle, GuideMeta } from "@/types/wallpaper";

const GUIDES_DIR = path.join(process.cwd(), "content", "guides");
const IS_DEV = process.env.NODE_ENV !== "production";
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]*$/i;

interface CachedArticle {
  mtimeMs: number;
  article: GuideArticle;
}

const articleCache = new Map<string, CachedArticle>();
let listCache: { key: string; guides: GuideMeta[] } | null = null;

function estimateReadTime(content: string): string {
  const words = content.trim().split(/\s+/).filter(Boolean).length;
  return `${Math.max(1, Math.round(words / 220))} min read`;
}

function parseArticle(slug: string, raw: string): GuideArticle {
  const { data, content } = matter(raw);
  return {
    slug: typeof data.slug === "string" && data.slug ? data.slug : slug,
    title: String(data.title ?? slug),
    excerpt: String(data.excerpt ?? ""),
    publishedAt: String(data.publishedAt ?? "2026-01-15"),
    updatedAt: String(data.updatedAt ?? data.publishedAt ?? "2026-01-15"),
    author: String(data.author ?? "Trendy-Wallpapers Editorial"),
    readTime: String(data.readTime ?? estimateReadTime(content)),
    category: String(data.category ?? "Display Engineering"),
    accentHex: String(data.accentHex ?? "#FF2E93"),
    tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
    content,
  };
}

async function readArticle(slug: string): Promise<GuideArticle | null> {
  if (!SLUG_PATTERN.test(slug)) return null;

  for (const extension of [".mdx", ".md"]) {
    const file = path.join(GUIDES_DIR, `${slug}${extension}`);
    let stat;
    try {
      stat = await fs.stat(file);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
      throw error;
    }

    const cached = articleCache.get(file);
    // Production content is immutable per build; dev re-reads when a file changes.
    if (cached && (!IS_DEV || cached.mtimeMs === stat.mtimeMs)) return cached.article;

    const article = parseArticle(slug, await fs.readFile(file, "utf8"));
    articleCache.set(file, { mtimeMs: stat.mtimeMs, article });
    return article;
  }
  return null;
}

export const getGuideBySlug = cache(async (slug: string): Promise<GuideArticle | null> =>
  readArticle(slug)
);

export const getAllGuides = cache(async (): Promise<GuideMeta[]> => {
  let files: string[];
  try {
    files = (await fs.readdir(GUIDES_DIR)).filter((file) => /\.mdx?$/.test(file)).sort();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }

  const key = files.join(",");
  if (!IS_DEV && listCache?.key === key) return listCache.guides;

  const articles = await Promise.all(
    files.map((file) => readArticle(file.replace(/\.mdx?$/, "")))
  );
  const guides = articles
    .filter((article): article is GuideArticle => Boolean(article))
    .map(
      ({ slug, title, excerpt, publishedAt, updatedAt, author, readTime, category, accentHex, tags }) => ({
        slug,
        title,
        excerpt,
        publishedAt,
        updatedAt,
        author,
        readTime,
        category,
        accentHex,
        tags,
      })
    )
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

  listCache = { key, guides };
  return guides;
});
