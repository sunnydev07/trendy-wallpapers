import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "node:http";
import {
  BoundedBodyError,
  fetchWithTimeout,
  readBoundedStream,
} from "../src/lib/fetch-with-timeout.ts";
import { readBoundedJson } from "../src/lib/request-body.ts";

function startServer(handler) {
  return new Promise((resolve) => {
    const server = createServer(handler);
    server.listen(0, "127.0.0.1", () => resolve({ server, port: server.address().port }));
  });
}

test("resolves a normal response", async () => {
  const { server, port } = await startServer((req, res) => {
    res.writeHead(200, { "content-type": "application/json" });
    res.end('{"ok":true}');
  });
  try {
    const response = await fetchWithTimeout(`http://127.0.0.1:${port}/`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true });
  } finally { server.close(); }
});

test("aborts when the server never sends headers", async () => {
  const { server, port } = await startServer(() => { /* hang */ });
  try {
    await assert.rejects(
      () => fetchWithTimeout(`http://127.0.0.1:${port}/`, {}, 150),
      (error) => error.name === "TimeoutError" || error.name === "AbortError"
    );
  } finally { server.close(); }
});

test("deadline also covers reading the response body", async () => {
  const { server, port } = await startServer((req, res) => {
    res.writeHead(200, { "content-type": "text/plain" });
    res.write("partial");
    // Never end the response: body consumption must time out too.
  });
  try {
    const response = await fetchWithTimeout(`http://127.0.0.1:${port}/`, {}, 200);
    await assert.rejects(
      () => response.text(),
      (error) => error.name === "TimeoutError" || error.name === "AbortError"
    );
  } finally { server.close(); }
});

test("byte-limit overflow cancels the producer instead of only releasing the lock", async () => {
  let cancelled = false;
  const stream = new ReadableStream({
    pull(controller) {
      controller.enqueue(new Uint8Array(64 * 1024));
    },
    cancel() {
      cancelled = true;
    },
  });

  await assert.rejects(() => readBoundedStream(stream, 32 * 1024), BoundedBodyError);
  assert.equal(cancelled, true);
});

test("bounded JSON reads accept small bodies and reject oversize ones", async () => {
  const small = new Request("http://localhost/api/test", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ok: true }),
  });
  assert.deepEqual(await readBoundedJson(small, 1024), { ok: true });

  const declared = new Request("http://localhost/api/test", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ padding: "x".repeat(2048) }),
  });
  await assert.rejects(() => readBoundedJson(declared, 1024), BoundedBodyError);

  const chunked = new Request("http://localhost/api/test", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(JSON.stringify({ padding: "x".repeat(4096) })));
        controller.close();
      },
    }),
    duplex: "half",
  });
  await assert.rejects(() => readBoundedJson(chunked, 1024), BoundedBodyError);
});

test("honours a caller-provided abort signal", async () => {
  const { server, port } = await startServer(() => {});
  const controller = new AbortController();
  controller.abort();
  try {
    await assert.rejects(() => fetchWithTimeout(`http://127.0.0.1:${port}/`, { signal: controller.signal }));
  } finally { server.close(); }
});
