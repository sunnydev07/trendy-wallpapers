import sharp from "sharp";

sharp.concurrency(2);
sharp.cache({ memory: 32, files: 0, items: 32 });

export const MAX_IMAGE_BYTES = 40 * 1024 * 1024;
export const MAX_INPUT_PIXELS = 64_000_000;
export const MAX_OUTPUT_PIXELS = 7680 * 4320;

export interface ProcessedImageMetadata {
  width: number;
  height: number;
  aspectRatio: string;
  dominantColors: string[];
  isOledDark: boolean;
  format: string;
}

export interface SmartDownloadOptions {
  width?: number;
  height?: number;
  format: "webp" | "png" | "jpg";
  fit?: "cover" | "contain" | "inside";
  quality?: number;
}

export class ImageProcessingBusyError extends Error {
  constructor() { super("Image processing is busy. Please retry shortly."); }
}

let activeJobs = 0;
const waitingJobs: (() => void)[] = [];

async function runImageJob<T>(run: () => Promise<T>): Promise<T> {
  if (activeJobs >= 2) {
    if (waitingJobs.length >= 4) throw new ImageProcessingBusyError();
    await new Promise<void>((resolve) => waitingJobs.push(resolve));
  } else {
    activeJobs += 1;
  }
  try { return await run(); }
  finally {
    const next = waitingJobs.shift();
    if (next) next();
    else activeJobs -= 1;
  }
}

function image(input: Buffer) {
  if (input.byteLength > MAX_IMAGE_BYTES) throw new Error("Image exceeds the 40 MB input limit.");
  return sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error", sequentialRead: true })
    .timeout({ seconds: 10 });
}

function rgbToHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map((n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0")).join("").toUpperCase();
}

function colorDistanceSq(a: number[], b: number[]): number {
  return a.reduce((sum, channel, index) => sum + (channel - b[index]) ** 2, 0);
}

export function computeAspectRatioLabel(width: number, height: number): string {
  const ratio = width / Math.max(1, height);
  if (ratio >= 3.0) return "32:9";
  if (ratio >= 2.15) return "21:9";
  if (ratio >= 1.65) return "16:9";
  if (ratio >= 1.25) return "4:3";
  if (ratio >= 0.85) return "1:1";
  return "9:16";
}

export async function extractDominantColors(
  inputBuffer: Buffer,
  maxColors = 5
): Promise<{ colors: string[]; isOledDark: boolean }> {
  const { data, info } = await runImageJob(() => image(inputBuffer)
    .rotate().resize(64, 64, { fit: "inside" }).flatten({ background: "#000000" })
    .toColourspace("srgb").raw().toBuffer({ resolveWithObject: true }));
  const buckets = new Map<string, { count: number; sums: number[] }>();
  let darkPixels = 0;
  for (let i = 0; i < data.length; i += 3) {
    const rgb = [data[i], data[i + 1], data[i + 2]];
    if (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2] < 26) darkPixels += 1;
    const key = rgb.map((n) => Math.floor(n / 24)).join(":");
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.count += 1;
      rgb.forEach((n, index) => { bucket.sums[index] += n; });
    } else buckets.set(key, { count: 1, sums: rgb });
  }
  const colorsByCount = [...buckets.values()].sort((a, b) => b.count - a.count)
    .map(({ count, sums }) => sums.map((n) => n / count));
  const picked: number[][] = [];
  for (const rgb of colorsByCount) {
    if (picked.every((existing) => colorDistanceSq(existing, rgb) >= 42 ** 2)) picked.push(rgb);
    if (picked.length >= maxColors) break;
  }
  const colors = picked.map(([r, g, b]) => rgbToHex(r, g, b));
  for (const [r, g, b] of colorsByCount) {
    if (colors.length >= maxColors) break;
    const hex = rgbToHex(r, g, b);
    if (!colors.includes(hex)) colors.push(hex);
  }
  return { colors, isOledDark: darkPixels / (info.width * info.height) >= 0.45 };
}

export async function generateThumbnailBuffer(inputBuffer: Buffer, maxWidth = 480): Promise<Buffer> {
  return runImageJob(() => image(inputBuffer).rotate()
    .resize({ width: Math.min(600, maxWidth), withoutEnlargement: true })
    .webp({ quality: 80, effort: 0 }).toBuffer());
}

export async function inspectWallpaperBuffer(inputBuffer: Buffer): Promise<ProcessedImageMetadata> {
  const meta = await runImageJob(() => image(inputBuffer).metadata());
  if (!meta.width || !meta.height) throw new Error("Image dimensions are unavailable.");
  const rotated = meta.orientation !== undefined && meta.orientation >= 5 && meta.orientation <= 8;
  const width = rotated ? meta.height : meta.width;
  const height = rotated ? meta.width : meta.height;
  const { colors, isOledDark } = await extractDominantColors(inputBuffer);
  return { width, height, aspectRatio: computeAspectRatioLabel(width, height), dominantColors: colors, isOledDark, format: meta.format ?? "unknown" };
}

export async function processSmartDownload(inputBuffer: Buffer, options: SmartDownloadOptions) {
  return runImageJob(async () => {
    const { width, height } = options;
    if ([width, height].some((n) => n !== undefined && (!Number.isInteger(n) || n < 1 || n > 7680))) {
      throw new Error("Invalid output dimensions.");
    }
    if (width && height && width * height > MAX_OUTPUT_PIXELS) throw new Error("Output exceeds the pixel limit.");
    const quality = Math.max(60, Math.min(100, options.quality ?? 92));
    let pipeline = image(inputBuffer).rotate();
    if (width || height) pipeline = pipeline.resize({ width, height, fit: options.fit ?? "cover", position: "centre" });
    if (options.format === "png") pipeline = pipeline.png({ compressionLevel: 1, adaptiveFiltering: false });
    else if (options.format === "jpg") pipeline = pipeline.jpeg({ quality });
    else pipeline = pipeline.webp({ quality, effort: 0 });
    const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });
    return {
      buffer: data,
      contentType: options.format === "jpg" ? "image/jpeg" : `image/${options.format}`,
      extension: options.format,
      width: info.width,
      height: info.height,
    };
  });
}
