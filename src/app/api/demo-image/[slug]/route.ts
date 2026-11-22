import { NextResponse } from "next/server";
import { getWallpaperBySlug } from "@/lib/data-provider";
import { readLocalUpload } from "@/lib/seed-data";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.json({ error: "Invalid slug." }, { status: 400 });
  }

  // Only serve thumbnails for wallpapers that actually exist and are published.
  const wallpaper = await getWallpaperBySlug(slug);
  if (!wallpaper || !wallpaper.is_published) {
    return NextResponse.json({ error: "Thumbnail not found." }, { status: 404 });
  }

  const thumb = await readLocalUpload(`thumbs/${slug}.webp`);
  if (!thumb) {
    return NextResponse.json({ error: "Thumbnail not found." }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(thumb), {
    status: 200,
    headers: {
      "Content-Type": "image/webp",
      "Content-Length": String(thumb.byteLength),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
