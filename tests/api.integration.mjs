import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());
const base = process.env.BENCHMARK_URL ?? "http://localhost:3000";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(base).hostname));
assert.ok(!process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.R2_ACCOUNT_ID && !process.env.FAL_KEY, "Integration fixtures require local demo mode");
const get = (path, init) => fetch(`${base}${path}`, { ...init, signal: AbortSignal.timeout(45000) });
const slug = "vice-boulevard-twilight-4k";

test("width-only preview preserves landscape aspect ratio", async () => {
  const response = await get(`/api/download?slug=${slug}&w=1200&preview=1`);
  assert.equal(response.status, 200);
  const meta = await sharp(Buffer.from(await response.arrayBuffer())).metadata();
  assert.deepEqual([meta.width, meta.height], [1200, 675]);
});
test("oversized preview is bounded to 1200px and WebP", async () => {
  const response = await get(`/api/download?slug=${slug}&w=3840&h=2160&format=png&preview=1`);
  assert.equal(response.status, 200);
  const meta = await sharp(Buffer.from(await response.arrayBuffer())).metadata();
  assert.deepEqual([meta.width, meta.height, meta.format], [1200, 675, "webp"]);
});
test("native download matches advertised original dimensions", async () => {
  const response = await get(`/api/download?slug=${slug}&format=png`);
  assert.equal(response.status, 200);
  const meta = await sharp(Buffer.from(await response.arrayBuffer())).metadata();
  assert.deepEqual([meta.width, meta.height], [3840, 2160]);
});
for (const query of ["w=bad", "h=-1", "w=0", "w=1.5", "w=999999", "q=NaN", "format=exe", "fit=bad"]) {
  test(`download rejects invalid ${query}`, async () => {
    const response = await get(`/api/download?slug=${slug}&${query}`);
    await response.arrayBuffer();
    assert.equal(response.status, 400);
  });
}
test("repeat previews support ETag validation", async () => {
  const path = `/api/download?slug=${slug}&w=600&preview=1`;
  const first = await get(path);
  await first.arrayBuffer();
  const etag = first.headers.get("etag");
  assert.ok(etag);
  const repeated = await get(path, { headers: { "if-none-match": etag } });
  assert.equal(repeated.status, 304);
});
test("admin rejects corrupt image with a client error", async () => {
  const form = new FormData();
  form.set("file", new Blob(["not a png"], { type: "image/png" }), "bad.png");
  form.set("title", "Bad upload");
  form.set("description", "This deliberately corrupt local fixture verifies a controlled image validation error.");
  const response = await get("/api/admin/upload", { method: "POST", headers: { authorization: `Bearer ${process.env.ADMIN_UPLOAD_SECRET}` }, body: form });
  await response.arrayBuffer();
  assert.equal(response.status, 400);
});
test("DMCA and generation reject malformed payloads", async () => {
  for (const path of ["/api/dmca", "/api/ai/generate"]) {
    const response = await get(path, { method: "POST", headers: { "content-type": "application/json" }, body: "{" });
    assert.equal(response.status, 400);
    assert.ok((await response.json()).error);
  }
});
test("admin rejects unsupported SVG uploads with 415", async () => {
  const form = new FormData();
  form.set("file", new Blob(["<svg xmlns='http://www.w3.org/2000/svg'/>"], { type: "image/svg+xml" }), "vec.svg");
  form.set("title", "Vector upload");
  form.set("description", "This SVG fixture verifies that unsupported vector uploads are rejected with a 415 status.");
  const response = await get("/api/admin/upload", { method: "POST", headers: { authorization: `Bearer ${process.env.ADMIN_UPLOAD_SECRET}` }, body: form });
  await response.arrayBuffer();
  assert.equal(response.status, 415);
});
test("admin rejects oversized uploads with 413", async () => {
  const form = new FormData();
  form.set("file", new Blob([Buffer.alloc(41 * 1024 * 1024)], { type: "image/png" }), "big.png");
  form.set("title", "Oversized upload");
  form.set("description", "This oversized fixture verifies that uploads above the 40 MB limit are rejected with 413.");
  const response = await get("/api/admin/upload", { method: "POST", headers: { authorization: `Bearer ${process.env.ADMIN_UPLOAD_SECRET}` }, body: form });
  await response.arrayBuffer();
  assert.equal(response.status, 413);
});
test("collections index renders", async () => {
  const response = await get("/collections");
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.ok(html.includes("Wallpaper Collections"));
});
test("demo-image returns 404 for an unknown slug", async () => {
  const response = await get("/api/demo-image/definitely-not-a-real-slug");
  await response.arrayBuffer();
  assert.equal(response.status, 404);
});
