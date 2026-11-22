import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { readBoundedStream } from "./fetch-with-timeout";
import { getR2PublicBaseUrl, isR2Configured } from "./env";

let r2ClientSingleton: S3Client | null = null;

/** Object operations are bounded so a stalled R2 call cannot hold a request open. */
const R2_TIMEOUT_MS = 20_000;
export const MAX_R2_OBJECT_BYTES = 40 * 1024 * 1024;

export class R2UpstreamError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "R2UpstreamError";
  }
}

export class R2ObjectTooLargeError extends Error {
  constructor(message = "Stored artwork exceeds the 40 MB limit.") {
    super(message);
    this.name = "R2ObjectTooLargeError";
  }
}

export function getR2Client(): S3Client | null {
  if (!isR2Configured()) return null;
  if (r2ClientSingleton) return r2ClientSingleton;

  r2ClientSingleton = new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID!}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
    maxAttempts: 2,
  });
  return r2ClientSingleton;
}

export function getR2PublicUrl(key: string): string {
  const base = getR2PublicBaseUrl();
  const cleanKey = key.replace(/^\/+/, "");
  if (!base) return `/${cleanKey}`;
  return `${base}/${cleanKey}`;
}

export interface UploadToR2Params {
  key: string;
  body: Buffer | Uint8Array;
  contentType: string;
  cacheControl?: string;
  signal?: AbortSignal;
}

export async function uploadToR2({
  key,
  body,
  contentType,
  cacheControl = "public, max-age=31536000, immutable",
  signal,
}: UploadToR2Params): Promise<{ key: string; url: string }> {
  const client = getR2Client();
  if (!client) {
    throw new Error("Cloudflare R2 is not configured in environment variables.");
  }

  const cleanKey = key.replace(/^\/+/, "");
  const timeout = AbortSignal.timeout(R2_TIMEOUT_MS);
  const abortSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;

  await client.send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: cleanKey,
      Body: body,
      ContentType: contentType,
      CacheControl: cacheControl,
    }),
    { abortSignal }
  );

  return {
    key: cleanKey,
    url: getR2PublicUrl(cleanKey),
  };
}

function isMissingObject(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { name?: string; Code?: string; $metadata?: { httpStatusCode?: number } };
  return (
    candidate.name === "NoSuchKey" ||
    candidate.Code === "NoSuchKey" ||
    candidate.$metadata?.httpStatusCode === 404
  );
}

/**
 * Returns null only when the object genuinely does not exist. Timeouts, transport
 * failures, and oversized bodies throw typed errors so callers do not convert an
 * infrastructure failure into a synthetic demo image.
 */
export async function fetchFromR2(
  key: string,
  options: { signal?: AbortSignal } = {}
): Promise<Buffer | null> {
  const client = getR2Client();
  if (!client) return null;

  const cleanKey = key.replace(/^\/+/, "");
  const timeout = AbortSignal.timeout(R2_TIMEOUT_MS);
  const abortSignal = options.signal
    ? AbortSignal.any([options.signal, timeout])
    : timeout;

  try {
    const response = await client.send(
      new GetObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME!,
        Key: cleanKey,
      }),
      { abortSignal }
    );

    if (!response.Body) return null;
    const declared = Number(response.ContentLength ?? Number.NaN);
    if (Number.isFinite(declared) && declared > MAX_R2_OBJECT_BYTES) {
      throw new R2ObjectTooLargeError();
    }

    const body = await readBoundedStream(
      response.Body.transformToWebStream(),
      MAX_R2_OBJECT_BYTES,
      // Include the 20s R2 deadline: a stalled body must not outlive the request budget.
      abortSignal
    );
    return body.byteLength > 0 ? body : null;
  } catch (error) {
    if (error instanceof R2ObjectTooLargeError) throw error;
    if (isMissingObject(error)) return null;
    const message = error instanceof Error ? error.message : "Unknown R2 failure.";
    throw new R2UpstreamError(`Stored artwork could not be read: ${message}`);
  }
}
