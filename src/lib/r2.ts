import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getR2PublicBaseUrl, isR2Configured } from "./env";

let r2ClientSingleton: S3Client | null = null;

/** Object operations are bounded so a stalled R2 call cannot hold a request open. */
const R2_TIMEOUT_MS = 20_000;

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
}

export async function uploadToR2({
  key,
  body,
  contentType,
  cacheControl = "public, max-age=31536000, immutable",
}: UploadToR2Params): Promise<{ key: string; url: string }> {
  const client = getR2Client();
  if (!client) {
    throw new Error("Cloudflare R2 is not configured in environment variables.");
  }

  const cleanKey = key.replace(/^\/+/, "");

  await client.send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: cleanKey,
      Body: body,
      ContentType: contentType,
      CacheControl: cacheControl,
    }),
    { abortSignal: AbortSignal.timeout(R2_TIMEOUT_MS) }
  );

  return {
    key: cleanKey,
    url: getR2PublicUrl(cleanKey),
  };
}

export async function fetchFromR2(key: string): Promise<Buffer | null> {
  const client = getR2Client();
  if (!client) return null;

  const cleanKey = key.replace(/^\/+/, "");

  try {
    const response = await client.send(
      new GetObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME!,
        Key: cleanKey,
      }),
      { abortSignal: AbortSignal.timeout(R2_TIMEOUT_MS) }
    );

    if (!response.Body) return null;
    const bytes = await response.Body.transformToByteArray();
    return Buffer.from(bytes);
  } catch {
    return null;
  }
}
