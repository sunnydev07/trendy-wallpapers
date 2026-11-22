import { BoundedBodyError, readBoundedStream } from "./fetch-with-timeout";

/**
 * Reads a request JSON body with a hard byte ceiling. Content-Length is only an early
 * hint; the stream is counted and cancelled at the limit, so chunked or dishonest
 * framing cannot force an unbounded buffer. Callers map the thrown error to their own
 * 400 response.
 */
export async function readBoundedJson(request: Request, maxBytes: number): Promise<unknown> {
  const declared = Number(request.headers.get("content-length") ?? Number.NaN);
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new BoundedBodyError(`Request body exceeds the ${maxBytes} byte limit.`);
  }

  const body = await readBoundedStream(request.body, maxBytes);
  return JSON.parse(body.toString("utf8"));
}
