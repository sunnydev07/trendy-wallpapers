/** Default deadline for outbound service calls. */
export const DEFAULT_TIMEOUT_MS = 10_000;

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
