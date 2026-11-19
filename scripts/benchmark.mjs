import { writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import sharp from "sharp";
import nextEnv from "@next/env";

export const routes = [
  "/", "/wallpaper/vice-boulevard-twilight-4k", "/ai-generator",
  "/category/gta-6-vice-city", "/resolution/4k", "/collections/vice-city-midnight-pack",
  "/guides", "/guides/4k-vs-oled-wallpaper-optimization-guide", "/about", "/contact",
  "/privacy-policy", "/terms", "/dmca", "/sitemap.xml", "/robots.txt",
];

const base = process.env.BENCHMARK_URL ?? "http://localhost:3000";
if (!["localhost", "127.0.0.1"].includes(new URL(base).hostname)) {
  throw new Error("This mutating demo benchmark only accepts a local server.");
}
nextEnv.loadEnvConfig(process.cwd());
if (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.FAL_KEY || process.env.R2_ACCOUNT_ID) {
  throw new Error("Only run the mutating benchmark with demo credentials.");
}
const results = [];
async function measure(path, init, expected = 200, image = false) {
  const start = performance.now();
  try {
    const response = await fetch(`${base}${path}`, { ...init, signal: AbortSignal.timeout(60000) });
    const bytes = Buffer.from(await response.arrayBuffer());
    const ms = +(performance.now() - start).toFixed(1);
    const result = { route: path, method: init?.method ?? "GET", status: response.status, ms, bytes: bytes.length };
    if (image && response.ok) {
      const metadata = await sharp(bytes).metadata();
      result.image = { format: metadata.format, width: metadata.width, height: metadata.height };
    }
    if (response.status !== expected) result.failure = bytes.toString().slice(0, 180);
    results.push(result);
    return { result, text: bytes.toString(), response };
  } catch (error) {
    const result = { route: path, ms: +(performance.now() - start).toFixed(1), failure: error.message };
    results.push(result);
    return { result };
  }
}
const pageTimings = [];
for (const route of routes) {
  const first = await measure(route);
  const warm = [];
  for (let i = 0; i < 3; i++) warm.push((await measure(route)).result.ms);
  pageTimings.push({ route, status: first.result.status, firstMs: first.result.ms, medianMs: [...warm].sort((a,b)=>a-b)[1], maxMs: Math.max(...warm) });
}
const download = "/api/download?slug=vice-boulevard-twilight-4k&w=1200&format=webp&preview=1";
await measure(download, undefined, 200, true);
await measure(download, undefined, 200, true);
await measure("/api/download?slug=vice-boulevard-twilight-4k&w=3840&h=2160&format=png", undefined, 200, true);
await measure("/api/download", undefined, 400);
await measure("/api/ai/generate");
const generated = await measure("/api/ai/generate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ prompt: "Neon coastal horizon with glowing palms and a dark ocean", aspectRatio: "16:9", style: "vice-city" }) });
if (generated.result.status === 200) {
  const json = JSON.parse(generated.text);
  if (json.wallpaper?.slug) await measure(`/wallpaper/${json.wallpaper.slug}`);
}
await measure("/api/dmca", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ wallpaperUrl: `${base}/wallpaper/vice-boulevard-twilight-4k`, reporterName: "Audit Test", reporterEmail: "audit@example.com", claimDetails: "Local demo validation of the copyright reporting form.", goodFaithConfirmed: true }) });
const png = await sharp({ create: { width: 640, height: 360, channels: 3, background: "#172033" } }).png().toBuffer();
const form = new FormData();
form.set("file", new Blob([png], { type: "image/png" }), "audit.png");
form.set("title", "Audit local upload");
form.set("description", "Local demo upload verification using a generated image, without publishing any external content.");
await measure("/api/admin/upload", { method: "POST", headers: { authorization: `Bearer ${process.env.ADMIN_UPLOAD_SECRET ?? ""}` }, body: form });
const report = { date: new Date().toISOString(), base, pageTimings, results };
if (process.argv[2]) await writeFile(process.argv[2], JSON.stringify(report, null, 2));
console.table(pageTimings);
console.table(results.filter(r => r.route.startsWith("/api/")));
if (results.some(r => r.failure)) process.exitCode = 1;
