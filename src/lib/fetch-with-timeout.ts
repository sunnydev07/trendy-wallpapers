/** Default deadline for outbound service calls. */
export const DEFAULT_TIMEOUT_MS = 10_000;

export class BoundedBodyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BoundedBodyError";
  }
}

/**
 * fetch with a deadline that also covers reading the response body: the timeout signal
 * is never cleared, so undici aborts a stalled stream instead of hanging the request.
 */
export async function fetchWithTimeout(
  input: string | URL | Request,
  init: RequestInit = {},
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<Response> {
  const signal = init.signal
    ? AbortSignal.any([init.signal, AbortSignal.timeout(timeoutMs)])
    : AbortSignal.timeout(timeoutMs);
  return fetch(input, { ...init, signal });
}

/**
 * Reads a stream while counting actual bytes. An announced size is only an early
 * rejection hint: chunked or dishonest framing still stops at `maxBytes`.
 */
export async function readBoundedStream(
  stream: ReadableStream<Uint8Array> | null | undefined,
  maxBytes: number,
  signal?: AbortSignal
): Promise<Buffer> {
  if (!stream) return Buffer.alloc(0);

  const reader = stream.getReader();

  const chunks: Buffer[] = [];
  let total = 0;
  const onAbort = () => {
    void reader.cancel().catch(() => undefined);
  };
  signal?.addEventListener("abort", onAbort, { once: true });

  try {
    for (;;) {
      if (signal?.aborted) throw signal.reason ?? new Error("Aborted while reading response body.");
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        // Stop the producer too; releasing the lock alone leaves the socket streaming.
        await reader.cancel().catch(() => undefined);
        throw new BoundedBodyError(`Response body exceeds the ${maxBytes} byte limit.`);
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    signal?.removeEventListener("abort", onAbort);
    try {
      reader.releaseLock();
    } catch {
      // A cancelled reader may already be released.
    }
  }

  return Buffer.concat(chunks);
}
