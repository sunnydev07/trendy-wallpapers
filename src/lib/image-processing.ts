import sharp from "sharp";
import { BoundedBodyError, readBoundedStream } from "./fetch-with-timeout";

sharp.concurrency(2);
sharp.cache({ memory: 32, files: 0, items: 32 });

export const MAX_IMAGE_BYTES = 40 * 1024 * 1024;
export const MAX_MULTIPART_BYTES = 45 * 1024 * 1024;
export const MAX_INPUT_PIXELS = 64_000_000;
export const MAX_OUTPUT_SIDE = 7680;
export const MAX_OUTPUT_PIXELS = 7680 * 4320;
export const PREVIEW_MAX_SIDE = 1200;

export interface ProcessedImageMetadata {
  width: number;
  height: number;
  aspectRatio: string;
  dominantColors: string[];
  isOledDark: boolean;
  format: string;
}

export interface DecodedImageMetadata {
  width: number;
  height: number;
  aspectRatio: string;
  format: string;
}

export interface SmartDownloadOptions {
  width?: number;
  height?: number;
  format: "webp" | "png" | "jpg";
  fit?: "cover" | "contain" | "inside";
  quality?: number;
}

export type StoredImageFormat = "jpg" | "png" | "webp";

export class ImageProcessingBusyError extends Error {
  constructor() {
    super("Image processing is busy. Please retry shortly.");
    this.name = "ImageProcessingBusyError";
  }
}

export class ImagePipelineBusyError extends Error {
  constructor() {
    super("Image processing is busy. Please retry shortly.");
    this.name = "ImagePipelineBusyError";
  }
}

export class ImagePipelineTimeoutError extends Error {
  constructor() {
    super("Image processing queue wait timed out.");
    this.name = "ImagePipelineTimeoutError";
  }
}

export class ImageTooLargeError extends Error {
  constructor(message = "Image exceeds the 40 MB input limit.") {
    super(message);
    this.name = "ImageTooLargeError";
  }
}

export class OutputTooLargeError extends Error {
  constructor(message = "Requested output dimensions exceed the supported limit.") {
    super(message);
    this.name = "OutputTooLargeError";
  }
}

export class InvalidImageError extends Error {
  constructor(message = "Invalid output dimensions.") {
    super(message);
    this.name = "InvalidImageError";
  }
}

// --- Sharp job pool (decode/encode concurrency) --------------------------------------

let activeJobs = 0;
const waitingJobs: (() => void)[] = [];

async function runImageJob<T>(run: () => Promise<T>): Promise<T> {
  if (activeJobs >= 2) {
    if (waitingJobs.length >= 4) throw new ImageProcessingBusyError();
    await new Promise<void>((resolve) => waitingJobs.push(resolve));
  } else {
    activeJobs += 1;
  }
  try {
    return await run();
  } finally {
    const next = waitingJobs.shift();
    if (next) next();
    else activeJobs -= 1;
  }
}

// --- Pipeline admission (bounds source acquisition + processing together) ------------

const MAX_ACTIVE_PIPELINES = 2;
const MAX_WAITING_PIPELINES = 4;
const PIPELINE_WAIT_MS = 10_000;

let activePipelines = 0;
const pipelineWaiters: (() => void)[] = [];

/**
 * Admission guard for a whole render pipeline: fetch/read the original, then process it.
 * Waiting callers hold only a closure, never a source buffer, and a disconnected request
 * leaves the queue immediately. Acquiring this token is not recursive, so an inner
 * Sharp job never waits on the pipeline it already owns.
 */
export async function runImagePipeline<T>(
  work: () => Promise<T>,
  signal?: AbortSignal
): Promise<T> {
  if (activePipelines >= MAX_ACTIVE_PIPELINES) {
    if (pipelineWaiters.length >= MAX_WAITING_PIPELINES) throw new ImagePipelineBusyError();

    await new Promise<void>((resolve, reject) => {
      const grant = () => {
        clearTimeout(timer);
        signal?.removeEventListener("abort", onAbort);
        resolve();
      };
      const onAbort = () => {
        clearTimeout(timer);
        const index = pipelineWaiters.indexOf(grant);
        if (index >= 0) pipelineWaiters.splice(index, 1);
        reject(signal?.reason ?? new Error("Image pipeline aborted while waiting."));
      };
      const timer = setTimeout(() => {
        const index = pipelineWaiters.indexOf(grant);
        if (index >= 0) pipelineWaiters.splice(index, 1);
        reject(new ImagePipelineTimeoutError());
      }, PIPELINE_WAIT_MS);

      if (signal?.aborted) {
        onAbort();
        return;
      }
      signal?.addEventListener("abort", onAbort, { once: true });
      pipelineWaiters.push(grant);
    });
  } else {
    activePipelines += 1;
  }

  try {
    return await work();
  } finally {
    const next = pipelineWaiters.shift();
    if (next) next();
    else activePipelines -= 1;
  }
}

// --- Geometry ------------------------------------------------------------------------

function boundOutputDimensions(width: number, height: number): { width: number; height: number } {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    throw new InvalidImageError("Output dimensions must be positive integers.");
  }
  if (width > MAX_OUTPUT_SIDE || height > MAX_OUTPUT_SIDE || width * height > MAX_OUTPUT_PIXELS) {
    throw new OutputTooLargeError();
  }
  return { width, height };
}

export interface OutputDimensionRequest {
  width?: number;
  height?: number;
  fit: "cover" | "contain" | "inside";
  preview: boolean;
}

/**
 * Computes the exact output geometry from oriented source dimensions before any resize.
 * Missing dimensions are derived from the source aspect ratio, so a height-only request
 * cannot bypass the width or pixel ceiling.
 */
export function resolveOutputDimensions(
  input: { width: number; height: number },
  requested: OutputDimensionRequest
): { width: number; height: number } {
  const srcWidth = Math.max(1, Math.round(input.width));
  const srcHeight = Math.max(1, Math.round(input.height));
  const width = requested.width;
  const height = requested.height;

  if (requested.preview) {
    if (!width && !height) {
      const scale = Math.min(1, PREVIEW_MAX_SIDE / srcWidth, PREVIEW_MAX_SIDE / srcHeight);
      return boundOutputDimensions(
        Math.max(1, Math.round(srcWidth * scale)),
        Math.max(1, Math.round(srcHeight * scale))
      );
    }
    const baseWidth = width ?? Math.round((height as number) * (srcWidth / srcHeight));
    const baseHeight = height ?? Math.round(baseWidth * (srcHeight / srcWidth));
    const scale = Math.min(1, PREVIEW_MAX_SIDE / baseWidth, PREVIEW_MAX_SIDE / baseHeight);
    return boundOutputDimensions(
      Math.max(1, Math.round(baseWidth * scale)),
      Math.max(1, Math.round(baseHeight * scale))
    );
  }

  if (!width && !height) return boundOutputDimensions(srcWidth, srcHeight);

  if (requested.fit === "inside") {
    if (width && height) {
      const scale = Math.min(1, width / srcWidth, height / srcHeight);
      return boundOutputDimensions(
        Math.max(1, Math.round(srcWidth * scale)),
        Math.max(1, Math.round(srcHeight * scale))
      );
    }
    const scale = width
      ? Math.min(1, width / srcWidth)
      : Math.min(1, (height as number) / srcHeight);
    return boundOutputDimensions(
      Math.max(1, Math.round(srcWidth * scale)),
      Math.max(1, Math.round(srcHeight * scale))
    );
  }

  const outputWidth = width ?? Math.round((height as number) * (srcWidth / srcHeight));
  const outputHeight = height ?? Math.round(outputWidth * (srcHeight / srcWidth));
  return boundOutputDimensions(outputWidth, outputHeight);
}

// --- Decode/encode helpers -----------------------------------------------------------

function image(input: Buffer) {
  if (input.byteLength > MAX_IMAGE_BYTES) throw new ImageTooLargeError();
  return sharp(input, {
    limitInputPixels: MAX_INPUT_PIXELS,
    failOn: "error",
    sequentialRead: true,
  }).timeout({ seconds: 10 });
}

export function normalizeQuality(raw: number | undefined): number {
  const value = raw ?? 92;
  if (!Number.isFinite(value)) return 92;
  return Math.max(60, Math.min(100, Math.round(value)));
}

export function normalizeStoredFormat(format: string | undefined): StoredImageFormat | null {
  if (!format) return null;
  if (format === "jpeg" || format === "jpg") return "jpg";
  if (format === "png") return "png";
  if (format === "webp") return "webp";
  return null;
}

export function contentTypeForFormat(format: StoredImageFormat): string {
  if (format === "jpg") return "image/jpeg";
  return `image/${format}`;
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
  if (ratio >= 1.45) return "3:2";
  if (ratio >= 1.15) return "4:3";
  if (ratio >= 0.85) return "1:1";
  return "9:16";
}

/**
 * Reads only image metadata (including EXIF orientation) so callers can decide whether a
 * transformation is needed before paying for a color analysis pass.
 */
export async function inspectImageMetadata(inputBuffer: Buffer): Promise<DecodedImageMetadata> {
  const meta = await runImageJob(() => image(inputBuffer).metadata());
  if (!meta.width || !meta.height) throw new InvalidImageError("Image dimensions are unavailable.");
  const rotated = meta.orientation !== undefined && meta.orientation >= 5 && meta.orientation <= 8;
  const width = rotated ? meta.height : meta.width;
  const height = rotated ? meta.width : meta.height;
  return {
    width,
    height,
    aspectRatio: computeAspectRatioLabel(width, height),
    format: meta.format ?? "unknown",
  };
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

/**
 * Inspect the final stored artwork exactly once. When a caller already decoded the
 * metadata (for example after deciding a crop is unnecessary), pass it in so only the
 * color analysis pass runs.
 */
export async function inspectWallpaperBuffer(
  inputBuffer: Buffer,
  options: { metadata?: DecodedImageMetadata } = {}
): Promise<ProcessedImageMetadata> {
  const meta = options.metadata ?? (await inspectImageMetadata(inputBuffer));
  const { colors, isOledDark } = await extractDominantColors(inputBuffer);
  return {
    width: meta.width,
    height: meta.height,
    aspectRatio: meta.aspectRatio,
    dominantColors: colors,
    isOledDark,
    format: meta.format,
  };
}

export async function processSmartDownload(inputBuffer: Buffer, options: SmartDownloadOptions) {
  return runImageJob(async () => {
    const { width, height } = options;
    for (const value of [width, height]) {
      if (value !== undefined && (!Number.isInteger(value) || value < 1 || value > MAX_OUTPUT_SIDE)) {
        throw new InvalidImageError("Invalid output dimensions.");
      }
    }
    if (width && height) boundOutputDimensions(width, height);

    const quality = normalizeQuality(options.quality);
    let pipeline = image(inputBuffer).rotate();
    if (width || height) {
      pipeline = pipeline.resize({
        width,
        height,
        fit: options.fit ?? "cover",
        position: "centre",
        withoutEnlargement: options.fit === "inside",
      });
    }
    if (options.format === "png") pipeline = pipeline.png({ compressionLevel: 1, adaptiveFiltering: false });
    else if (options.format === "jpg") pipeline = pipeline.jpeg({ quality });
    else pipeline = pipeline.webp({ quality, effort: 0 });

    const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });
    if (
      info.width > MAX_OUTPUT_SIDE ||
      info.height > MAX_OUTPUT_SIDE ||
      info.width * info.height > MAX_OUTPUT_PIXELS
    ) {
      throw new OutputTooLargeError("Rendered output exceeds the supported pixel limit.");
    }

    return {
      buffer: data,
      contentType: options.format === "jpg" ? "image/jpeg" : `image/${options.format}`,
      extension: options.format,
      width: info.width,
      height: info.height,
    };
  });
}

/**
 * Reads a response body up to `maxBytes`. Content-Length is only an early hint; the
 * stream is aborted as soon as the actual byte count crosses the limit.
 */
export async function readBoundedBody(
  response: Response,
  maxBytes: number,
  signal?: AbortSignal
): Promise<Buffer> {
  const declared = Number(response.headers.get("content-length") ?? Number.NaN);
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new ImageTooLargeError(`Response body exceeds the ${maxBytes} byte limit.`);
  }
  try {
    return await readBoundedStream(response.body, maxBytes, signal);
  } catch (error) {
    rethrowBoundedBody(error);
  }
}

/** Maps a bounded-body failure onto the same typed image error used by routes. */
export function rethrowBoundedBody(error: unknown): never {
  if (error instanceof BoundedBodyError) throw new ImageTooLargeError(error.message);
  throw error;
}
