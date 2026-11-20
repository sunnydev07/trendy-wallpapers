import type { MetadataRoute } from "next";
import {
  getAllCategories,
  getAllCollections,
  getAllPublishedWallpaperSlugs,
  getAllResolutions,
} from "@/lib/data-provider";
import { getSiteUrl } from "@/lib/env";
import { getAllGuides } from "@/lib/guides";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl();
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    "",
    "/ai-generator",
    "/collections",
    "/guides",
    "/about",
    "/contact",
    "/privacy-policy",
    "/terms",
    "/dmca",
  ].map((route) => ({
    url: `${siteUrl}${route}`,
    lastModified: now,
    changeFrequency: route === "" ? "daily" : "weekly",
    priority: route === "" ? 1.0 : route === "/ai-generator" ? 0.9 : 0.6,
  }));

  const categoryRoutes: MetadataRoute.Sitemap = getAllCategories().map((cat) => ({
    url: `${siteUrl}/category/${cat.slug}`,
    lastModified: now,
    changeFrequency: "daily",
    priority: 0.85,
  }));

  const resolutionRoutes: MetadataRoute.Sitemap = getAllResolutions().map((res) => ({
    url: `${siteUrl}/resolution/${res.slug}`,
    lastModified: now,
    changeFrequency: "daily",
    priority: 0.85,
  }));

  const collectionRoutes: MetadataRoute.Sitemap = getAllCollections().map((col) => ({
    url: `${siteUrl}/collections/${col.slug}`,
    lastModified: new Date(col.updatedAt),
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  const guideRoutes: MetadataRoute.Sitemap = (await getAllGuides()).map((guide) => ({
    url: `${siteUrl}/guides/${guide.slug}`,
    lastModified: new Date(guide.updatedAt),
    changeFrequency: "monthly",
    priority: 0.8,
  }));

  const wallpaperSlugs = await getAllPublishedWallpaperSlugs();
  const wallpaperRoutes: MetadataRoute.Sitemap = wallpaperSlugs.map((item) => ({
    url: `${siteUrl}/wallpaper/${item.slug}`,
    lastModified: new Date(item.updatedAt),
    changeFrequency: "weekly",
    priority: 0.75,
  }));

  return [
    ...staticRoutes,
    ...categoryRoutes,
    ...resolutionRoutes,
    ...collectionRoutes,
    ...guideRoutes,
    ...wallpaperRoutes,
  ];
}
