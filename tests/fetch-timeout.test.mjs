import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "node:http";
import { fetchWithTimeout } from "../src/lib/fetch-with-timeout.ts";

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

test("honours a caller-provided abort signal", async () => {
  const { server, port } = await startServer(() => {});
  const controller = new AbortController();
  controller.abort();
  try {
    await assert.rejects(() => fetchWithTimeout(`http://127.0.0.1:${port}/`, { signal: controller.signal }));
  } finally { server.close(); }
});
