import { spawn, execFileSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import net from "node:net";
import path from "node:path";
import { monitorEventLoopDelay, performance } from "node:perf_hooks";
import { pathToFileURL } from "node:url";
import sharp from "sharp";

/**
 * Read-only by default. Mutating scenarios (AI demo generation, admin upload, DMCA)
 * only run with --include-mutations and only against a server this harness spawns with
 * sanitized demo credentials and temporary stores.
 */

export const READ_ONLY_ROUTES = [
  "/",
  "/wallpaper/vice-boulevard-twilight-4k",
  "/ai-generator",
  "/category/gta-6-vice-city",
  "/resolution/4k",
  "/collections/vice-city-midnight-pack",
  "/guides",
  "/guides/4k-vs-oled-wallpaper-optimization-guide",
  "/about",
  "/contact",
  "/privacy-policy",
  "/terms",
  "/dmca",
  "/sitemap.xml",
  "/robots.txt",
];

export const PREVIEW_PATH =
  "/api/download?slug=vice-boulevard-twilight-4k&w=1200&format=webp&preview=1";

const MAX_SAMPLES = 200;
const MAX_CONCURRENCY = 6;
const ADMIN_SECRET = "benchmark-admin-secret-1234";

export function percentile(values, p) {
  if (!Array.isArray(values) || values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.ceil((p / 100) * sorted.length) - 1;
  const index = Math.min(sorted.length - 1, Math.max(0, rank));
  return Number(sorted[index].toFixed(1));
}

export function summarize(values) {
  if (values.length === 0) return { samples: 0, min: null, p50: null, p95: null, max: null };
  return {
    samples: values.length,
    min: Number(Math.min(...values).toFixed(1)),
    p50: percentile(values, 50),
    p95: percentile(values, 95),
    max: Number(Math.max(...values).toFixed(1)),
  };
}

/**
 * Pass/fail is explicit: an unexpected status never becomes a success because the
 * response body happened to be empty or truthy.
 */
export function classifyResult({ route, method = "GET", status, expected, ms, bytes }) {
  const body = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes ?? []);
  const passed = status === expected;
  const result = { route, method, status, expected, passed, ms, bytes: body.length };
  if (!passed) {
    result.failure = body.toString().slice(0, 180) || "Unexpected HTTP status";
  }
  return result;
}

export function parseArgs(argv) {
  const options = {
    samples: 30,
    concurrency: [1],
    includeMutations: false,
    url: null,
    out: null,
    cold: 3,
  };

  for (const arg of argv) {
    if (arg === "--include-mutations") {
      options.includeMutations = true;
    } else if (arg.startsWith("--samples=")) {
      options.samples = Number.parseInt(arg.slice("--samples=".length), 10);
    } else if (arg.startsWith("--concurrency=")) {
      options.concurrency = arg
        .slice("--concurrency=".length)
        .split(",")
        .map((value) => Number.parseInt(value, 10));
    } else if (arg.startsWith("--url=")) {
      options.url = arg.slice("--url=".length);
    } else if (arg.startsWith("--out=")) {
      options.out = arg.slice("--out=".length);
    } else if (arg.startsWith("--cold=")) {
      options.cold = Number.parseInt(arg.slice("--cold=".length), 10);
    } else {
      throw new Error(`Unknown benchmark argument: ${arg}`);
    }
  }

  if (!Number.isInteger(options.samples) || options.samples < 1 || options.samples > MAX_SAMPLES) {
    throw new Error(`--samples must be an integer between 1 and ${MAX_SAMPLES}.`);
  }
  if (options.concurrency.length === 0) options.concurrency = [1];
  for (const value of options.concurrency) {
    if (!Number.isInteger(value) || value < 1 || value > MAX_CONCURRENCY) {
      throw new Error(`--concurrency values must be between 1 and ${MAX_CONCURRENCY}.`);
    }
  }
  options.concurrency = [...new Set(options.concurrency)].sort((a, b) => a - b);
  if (!Number.isInteger(options.cold) || options.cold < 0 || options.cold > 5) {
    throw new Error("--cold must be between 0 and 5.");
  }
  return options;
}

async function measure(base, route, init, expected = 200, image = false, timeoutMs = 60_000) {
  const method = init?.method ?? "GET";
  const start = performance.now();
  try {
    const response = await fetch(`${base}${route}`, {
      ...init,
      signal: AbortSignal.timeout(timeoutMs),
    });
    const bytes = Buffer.from(await response.arrayBuffer());
    const ms = Number((performance.now() - start).toFixed(1));
    const result = classifyResult({ route, method, status: response.status, expected, ms, bytes });
    if (image && response.ok) {
      try {
        const metadata = await sharp(bytes).metadata();
        result.image = { format: metadata.format, width: metadata.width, height: metadata.height };
      } catch (error) {
        result.passed = false;
        result.failure = `Image validation failed: ${error.message}`;
      }
    }
    return result;
  } catch (error) {
    return {
      route,
      method,
      ms: Number((performance.now() - start).toFixed(1)),
      passed: false,
      failure: error instanceof Error ? error.message : String(error),
    };
  }
}

async function runBatch(base, route, count, concurrency, expected = 200, image = false) {
  const results = [];
  let next = 0;
  async function worker() {
    for (;;) {
      const index = next++;
      if (index >= count) return;
      results.push(await measure(base, route, undefined, expected, image));
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return results;
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close(() => resolve(port));
    });
  });
}

function sanitizedEnv(workDir) {
  const env = { ...process.env };
  for (const key of [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "R2_ACCOUNT_ID",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "NEXT_PUBLIC_R2_PUBLIC_URL",
    "FAL_KEY",
    "UPSTASH_REDIS_REST_URL",
    "UPSTASH_REDIS_REST_TOKEN",
  ]) {
    env[key] = "";
  }
  env.ADMIN_UPLOAD_SECRET = ADMIN_SECRET;
  env.DEMO_WALLPAPER_STORE = path.join(workDir, "demo-store.json");
  env.DEMO_UPLOAD_DIR = path.join(workDir, "uploads");
  env.NEXT_PUBLIC_SITE_URL = "";
  return env;
}

async function startServer(env) {
  const port = await freePort();
  const nextBin = path.join(process.cwd(), "node_modules", "next", "dist", "bin", "next");
  const child = spawn(process.execPath, [nextBin, "start", "-p", String(port)], {
    cwd: process.cwd(),
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  let log = "";
  child.stdout.on("data", (chunk) => {
    log += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    log += chunk.toString();
  });

  const base = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 60_000;
  for (;;) {
    if (child.exitCode !== null) {
      throw new Error(`Benchmark server exited early:\n${log.slice(-800)}`);
    }
    try {
      const response = await fetch(base, { signal: AbortSignal.timeout(2_000) });
      await response.arrayBuffer();
      if (response.ok) return { child, base, log: () => log };
    } catch {
      // Server is still starting.
    }
    if (Date.now() > deadline) {
      throw new Error(`Benchmark server did not become ready:\n${log.slice(-800)}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}

async function stopServer(child) {
  if (!child || child.exitCode !== null) return;
  child.kill("SIGTERM");
  await new Promise((resolve) => {
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      resolve();
    }, 5_000);
    child.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

function gitCommit() {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.url) {
    let hostname;
    try {
      hostname = new URL(options.url).hostname;
    } catch {
      throw new Error("--url must be a valid http://localhost URL.");
    }
    if (!["localhost", "127.0.0.1"].includes(hostname)) {
      throw new Error("Benchmarks only accept a loopback server.");
    }
    if (options.includeMutations) {
      throw new Error("Mutating scenarios require a harness-spawned server; drop --url.");
    }
  }

  const workDir = await mkdtemp(path.join(tmpdir(), "trendy-benchmark-"));
  const env = sanitizedEnv(workDir);
  const resources = {
    rssBytesStart: process.memoryUsage().rss,
    eventLoopDelayMs: null,
    rssBytesEnd: null,
  };
  const cold = [];
  const pageResults = [];
  const concurrencyResults = [];
  const mutationResults = [];

  let session = null;
  try {
    if (!options.url) {
      for (let index = 0; index < options.cold; index += 1) {
        const coldSession = await startServer(env);
        try {
          const first = await measure(coldSession.base, "/", undefined, 200);
          cold.push(first.ms);
        } finally {
          await stopServer(coldSession.child);
        }
      }
      session = await startServer(env);
    }

    const base = options.url ?? session.base;
    const eventLoop = monitorEventLoopDelay({ resolution: 10 });
    eventLoop.enable();

    for (const route of READ_ONLY_ROUTES) {
      for (let warmup = 0; warmup < 3; warmup += 1) {
        await measure(base, route, undefined, 200);
      }
      const samples = await runBatch(base, route, options.samples, 1);
      pageResults.push({
        route,
        statuses: [...new Set(samples.map((sample) => sample.status ?? "error"))],
        timings: summarize(samples.map((sample) => sample.ms)),
        failures: samples.filter((sample) => !sample.passed).map((sample) => sample.failure),
      });
    }

    await measure(base, PREVIEW_PATH, undefined, 200, true);
    const previewSamples = await runBatch(base, PREVIEW_PATH, options.samples, 1, 200, true);
    pageResults.push({
      route: PREVIEW_PATH,
      statuses: [...new Set(previewSamples.map((sample) => sample.status ?? "error"))],
      timings: summarize(previewSamples.map((sample) => sample.ms)),
      failures: previewSamples.filter((sample) => !sample.passed).map((sample) => sample.failure),
      image: previewSamples.find((sample) => sample.image)?.image ?? null,
    });

    for (const concurrency of options.concurrency.filter((value) => value > 1)) {
      for (const route of ["/", PREVIEW_PATH]) {
        const samples = await runBatch(base, route, options.samples, concurrency);
        const statusCounts = samples.reduce((counts, sample) => {
          const key = String(sample.status ?? "error");
          counts[key] = (counts[key] ?? 0) + 1;
          return counts;
        }, {});
        concurrencyResults.push({
          route,
          concurrency,
          requests: samples.length,
          statusCounts,
          timings: summarize(samples.map((sample) => sample.ms)),
          unexpectedFailures: samples.filter(
            (sample) => !sample.passed && sample.status !== 429 && sample.status !== 503
          ).length,
        });
      }
    }

    if (options.includeMutations && session) {
      mutationResults.push(await measure(base, "/api/download", undefined, 400));
      mutationResults.push(
        await measure(base, "/api/ai/generate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            prompt: "Neon coastal horizon with glowing palms and a dark ocean",
            aspectRatio: "16:9",
          }),
        })
      );
      mutationResults.push(
        await measure(base, "/api/dmca", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            wallpaperUrl: `${base}/wallpaper/vice-boulevard-twilight-4k`,
            reporterName: "Audit Test",
            reporterEmail: "audit@example.com",
            claimDetails: "Local demo validation of the copyright reporting form.",
            goodFaithConfirmed: true,
          }),
        })
      );

      const png = await sharp({
        create: { width: 640, height: 360, channels: 3, background: "#172033" },
      })
        .png()
        .toBuffer();
      const form = new FormData();
      form.set("file", new Blob([png], { type: "image/png" }), "audit.png");
      form.set("title", "Audit local upload");
      form.set(
        "description",
        "Local demo upload verification using a generated image, without publishing any external content."
      );
      mutationResults.push(
        await measure(base, "/api/admin/upload", {
          method: "POST",
          headers: { authorization: `Bearer ${ADMIN_SECRET}` },
          body: form,
        })
      );
    }

    eventLoop.disable();
    resources.eventLoopDelayMs = {
      p50: Number((eventLoop.percentile(50) / 1e6).toFixed(2)),
      p95: Number((eventLoop.percentile(95) / 1e6).toFixed(2)),
      max: Number((eventLoop.max / 1e6).toFixed(2)),
    };
    resources.rssBytesEnd = process.memoryUsage().rss;

    const report = {
      date: new Date().toISOString(),
      node: process.version,
      commit: gitCommit(),
      base,
      spawned: !options.url,
      config: {
        samples: options.samples,
        concurrency: options.concurrency,
        coldProcessSamples: options.cold,
        includeMutations: options.includeMutations,
      },
      processColdFirstRequestMs: cold,
      pages: pageResults,
      concurrency: concurrencyResults,
      mutations: mutationResults,
      resources,
      notes: [
        "process-cold means a fresh server process, not a cold disk/CDN/database cache.",
        "Warm samples: 30 by default, serial localhost HTTP, not browser Core Web Vitals.",
        "Mutating scenarios run only with --include-mutations against the harness-spawned server.",
      ],
    };

    if (options.out) await writeFile(options.out, JSON.stringify(report, null, 2));

    console.table(
      pageResults.map((entry) => ({
        route: entry.route,
        statuses: entry.statuses.join(","),
        p50: entry.timings.p50,
        p95: entry.timings.p95,
        max: entry.timings.max,
        failures: entry.failures.length,
      }))
    );
    for (const entry of concurrencyResults) {
      console.log(
        `concurrency ${entry.concurrency} ${entry.route}: p50=${entry.timings.p50}ms p95=${entry.timings.p95}ms statuses=${JSON.stringify(entry.statusCounts)}`
      );
    }
    if (mutationResults.length > 0) {
      console.table(
        mutationResults.map((result) => ({
          route: result.route,
          status: result.status,
          passed: result.passed,
          ms: result.ms,
        }))
      );
    }
    if (cold.length > 0) console.log("process-cold first request ms:", cold.join(", "));

    const failed =
      pageResults.some((entry) => entry.failures.length > 0) ||
      concurrencyResults.some((entry) => entry.unexpectedFailures > 0) ||
      mutationResults.some((result) => !result.passed);
    if (failed) process.exitCode = 1;
  } finally {
    if (session) await stopServer(session.child);
    await rm(workDir, { recursive: true, force: true });
  }
}

const isMain =
  process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isMain) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
