# Critical Bug & Error Fix Plan — Trendy-Wallpapers

> **For agentic workers:** use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to implement task-by-task. Steps use checkboxes.

**Goal:** Fix the highest-impact functional, security, monetization and UX defects found in the current codebase, without regressing the verified performance work (production pages < 65 ms, previews ~5 ms, CLS 0).

**Current verified state:** `npm run typecheck` clean, `npm run lint` clean, 34 unit tests + 14 API tests pass, 39 wallpapers render in demo mode. The bugs below are therefore **not** build failures — they are behavioural, security and product gaps.

**Tech stack:** Next.js 15.5 (App Router, Turbopack dev), React 19, TypeScript strict, Sharp, Supabase/R2/Upstash/Fal (optional), Node `node:test` suites in `tests/`.

**Constraints:** no new runtime dependencies; keep `typecheck`/`lint` green after every task; every fix needs a failing test or reproducible check first; do not read or print `.env.local` values.

---

## Evidence summary

| # | Severity | Defect | Evidence |
|---|---|---|---|
| P0-1 | Critical (security/perf) | Public compute endpoint `/api/download` has **no abuse protection**; arbitrary 8K PNG encodes can be forced by anyone | `src/app/api/download/route.ts` (no rate limit; 2-job queue + 4 waiters in `src/lib/image-processing.ts:36`) |
| P0-2 | Critical (security) | Admin upload buffers the entire file before any size check; accepts `image/svg+xml` and mislabels it `.png` | `src/app/api/admin/upload/route.ts:101` (`file.arrayBuffer()`), type gate `image/*`, `originalExt` jpeg→jpg else png |
| P0-3 | Critical (monetization) | **Live AdSense can never render**: `adUnitId` is only referenced inside the component, no caller passes it, so every slot is permanently a placeholder | `src/components/AdSlot.tsx:10,47`; no `adUnitId` in any caller |
| P0-4 | Critical (deployment) | 21 licensed/AI wallpapers live only in gitignored `.uploads/` + `.demo-wallpapers.json`; a fresh clone or serverless deploy loses them and their pages 404 | `.gitignore` entries; `src/lib/seed-data.ts` demo store |
| P0-5 | Major (UX) | No `error.tsx`/`global-error.tsx` anywhere — any SSR/DB failure yields the default crash screen with no retry | `ls src/app/error.tsx` → not found |
| P1-6 | Major (console) | `next/image` previews use query-string URLs (`/api/download?…`) which are unconfigured in `images.localPatterns` (warning on detail + AI output, required in Next 16) | `src/lib/data-provider.ts:54`, `admin/upload/route.ts:205`, `ai/generate/route.ts:352` |
| P1-7 | Major (data) | Download counter increments on **every cached 200**, so repeat/bot hits inflate stats | `src/app/api/download/route.ts:170` |
| P1-8 | Major (SEO/UX) | `/collections` index returns **404** | `curl /collections` → 404 |
| P2-9 | Hardening | Image backpressure error returns **500** instead of 503 + `Retry-After` | `src/lib/image-processing.ts:27`, download catch |
| P2-10 | Hardening | Demo store writes the whole JSON synchronously per generation (non-atomic; corruption on crash) | `src/lib/seed-data.ts` `persistDemoWallpapers` |
| P2-11 | Hardening | `/api/demo-image/[slug]` serves any file in `.uploads` without checking the wallpaper exists/is published | `src/app/api/demo-image/[slug]/route.ts` |
| P2-12 | A11y/tooling | No `aria-current` on active nav link; `next lint` deprecated | `src/components/Navbar.tsx`, `package.json` |

---

## P0-1 — Protect the public download endpoint

**Files:** `src/app/api/download/route.ts`, `src/lib/redis.ts`, `src/lib/image-processing.ts`, `tests/api.integration.mjs`

- [ ] Write failing tests: 30 unique uncached requests from one IP → the 25th+ returns `429`; `ImageProcessingBusyError` maps to `503` with `Retry-After: 3`.
- [ ] Add `limitDownloadRequests(identifier)` in `src/lib/redis.ts` reusing the existing Upstash/demo fallback pattern (fixed window, e.g. 20 renders/min/IP, previews exempt when served from cache).
- [ ] Enforce the limit **before** Sharp work, keyed on the existing hashed-IP helper; return `{ error, code: "RATE_LIMITED" }` with status 429.
- [ ] Map `ImageProcessingBusyError` → `503` + `Retry-After` header in the download catch block (keep other errors at 500/404).
- [ ] Optional allowlist: only accept `w`/`h` from the preset ladder {320,480,600,1200,1440,1920,2560,3440,3840,5120,7680} when `preview=1`, to stop cache-key explosion.
- [ ] Re-run `npm run test:api`; confirm the first 20 requests still succeed and timings in `npm run benchmark` stay within baseline.

**Acceptance:** 429 on burst abuse, 503 on saturation, no change to legitimate preview latency.

## P0-2 — Bound and whitelist admin uploads

**Files:** `src/app/api/admin/upload/route.ts`, `tests/api.integration.mjs`

- [ ] Failing test: a `Content-Length`/file larger than 40 MB returns `413`; an SVG upload returns `415`.
- [ ] Reject early: if `file.size > 40 * 1024 * 1024` return 413 **before** `arrayBuffer()`; also reject when the request `content-length` exceeds 45 MB (multipart overhead) before parsing.
- [ ] Whitelist `image/jpeg`, `image/png`, `image/webp`; map `webp`→`webp` extension or transcode to PNG once and store that buffer consistently (never store SVG bytes under a `.png` name).
- [ ] Add `Cache-Control: no-store` on the route response and keep bearer auth as-is.
- [ ] Verify with the corrupt-image 400 test plus the new 413/415 cases.

**Acceptance:** no unbounded buffering, no mislabeled vector uploads, existing 200 path unchanged.

## P0-3 — Make AdSense actually render (monetization)

**Files:** `src/components/AdSlot.tsx`, `src/lib/env.ts`, `.env.example`, `src/app/page.tsx`, `src/app/ai-generator/page.tsx`, `src/app/wallpaper/[slug]/page.tsx`, `src/app/collections/[slug]/page.tsx`, `src/app/guides/page.tsx`, `src/components/MasonryGrid.tsx`

- [ ] Add `NEXT_PUBLIC_ADSENSE_SLOT_INFEED`, `NEXT_PUBLIC_ADSENSE_SLOT_DETAIL`, `NEXT_PUBLIC_ADSENSE_SLOT_GUIDE`, `NEXT_PUBLIC_ADSENSE_SLOT_STUDIO` (numeric IDs) to `.env.example` with comments.
- [ ] Add `getAdSenseSlotIds()` to `src/lib/env.ts` returning a validated map (`/^\d{6,}$/`).
- [ ] Pass the mapped `adUnitId` at every call site (in-feed uses chunk-specific ids or the shared in-feed id).
- [ ] Keep the placeholder frame whenever client or slot id is missing/invalid (current behaviour) and document that both are required.
- [ ] Verify: with no env vars, placeholders keep `min-height` and 48 px margins; with test client+slot ids, the rendered `<ins>` carries the numeric `data-ad-slot`.

**Acceptance:** ads render only with valid ids; zero new layout shift; `npm run lint` clean.

## P0-4 — Make curated content portable (deploy-safe)

**Files:** `src/lib/seed-data.ts`, `src/lib/data-provider.ts`, `.gitignore`, `public/curated/` (new), `src/data/curated-wallpapers.ts` (new), `README.md`

Choose **Option A** (recommended, keeps demo self-contained) — do not silently fall back to in-memory content in production.

- [ ] Add a one-off migration script (run locally, then delete or keep in `scripts/`): move `.uploads/*.jpg|png` to `public/curated/originals/` and thumbnails to `public/curated/thumbs/`, and emit `src/data/curated-wallpapers.ts` exporting typed `Wallpaper[]` (title, description, tags, license attribution, dimensions, source_type `licensed_stock`).
- [ ] Serve those wallpapers from `getDemoWallpapers()` as `[...runtimeDemo, ...CURATED, ...SEED]` with `thumb_url=/curated/thumbs/<slug>.webp` and `preview_url` using the bounded preview route from P1-6.
- [ ] `/api/download` reads curated originals from `public/curated/originals` before the SVG fallback (path-traversal-safe slug check).
- [ ] Remove `.uploads/` and `.demo-wallpapers.json` from the content path for curated items; keep `.demo-wallpapers.json` **only** for ephemeral AI experiments and document that AI demo output is local-only.
- [ ] Un-ignore `public/curated/` and `src/data/curated-wallpapers.ts`; commit them so a fresh clone shows all 17 licensed wallpapers.
- [ ] Document in `README.md`: production requires Supabase + R2 for AI/admin publishing; filesystem persistence is dev-only and not valid on serverless.

**Acceptance:** `git clone` → `npm run build` shows the same 17 licensed wallpapers and all detail pages 200; no content depends on ignored files.

## P0-5 — Add branded error boundaries

**Files:** `src/app/error.tsx`, `src/app/global-error.tsx`, `src/app/wallpaper/[slug]/error.tsx`, `src/app/not-found.tsx` (new)

- [ ] Add client `error.tsx` with retry (`reset()`), the existing dark design tokens, and a link back to the gallery; `global-error.tsx` for root failures.
- [ ] Add a styled `not-found.tsx` (currently the default 404) linking to `/` and `/guides`.
- [ ] Test by temporarily forcing `getWallpaperBySlug` to throw and confirming the branded boundary renders with a working retry, then revert.

**Acceptance:** no default Next crash screen; retry works; no console errors.

## P1-6 — Remove `next/image` localPatterns warnings

**Files:** `next.config.ts` **or** new `src/app/api/preview/[slug]/route.ts` + preview URL producers (`data-provider.ts`, `admin/upload/route.ts`, `ai/generate/route.ts`)

- [ ] Prefer the path-based route `/api/preview/[slug]?w=…` **only if** `localPatterns` cannot express the query shape; otherwise set `images.localPatterns` to allow `/api/download` with the exact query pattern used (`slug`, `w`, `format`, `preview`).
- [ ] If the route is used, serve `<=1200px` WebP via the existing cached pipeline, keep ETag/304, and point every `preview_url` at it.
- [ ] Verify in a clean browser context: zero `next-image-unconfigured-localpatterns` warnings on `/`, detail and AI output.

**Acceptance:** zero image warnings; previews still ≤1200 px WebP.

## P1-7 — Stop download-stat inflation

**Files:** `src/app/api/download/route.ts`, `src/lib/redis.ts`

- [ ] Only increment when the render was **not** served from the in-memory cache (track a `cached` flag from `loadProcessed`), and skip when `preview=1` (already true).
- [ ] Optionally dedupe per IP+slug per day with the existing demo/Upstash helpers.
- [ ] Test: two identical non-preview downloads → counter RPC called once (mock `incrementDownloadCount` or assert via a test-only counter).

**Acceptance:** repeat hits do not inflate counts; first download still counts.

## P1-8 — Add the `/collections` index page

**Files:** `src/app/collections/page.tsx` (new), `src/app/sitemap.ts`

- [ ] Server component listing every collection from `getAllCollections()` with title, subtitle, curator note, item count and a thumbnail strip.
- [ ] Add `CollectionPage` JSON-LD and a sitemap entry.
- [ ] Verify `/collections` returns 200 and each card links to a valid collection detail page.

## P2 — Hardening & polish (do after P0/P1)

- [ ] **P2-9** `503 + Retry-After` for `ImageProcessingBusyError` (bundled with P0-1 if convenient).
- [ ] **P2-10** Atomic demo-store writes: write to `*.tmp` then `rename`, and debounce 250 ms; add a test that a partially written file never breaks boot.
- [ ] **P2-11** `/api/demo-image/[slug]`: look up the wallpaper via `getWallpaperBySlug` and return 404 when missing/unpublished before reading the file.
- [ ] **P2-12** `aria-current="page"` on the active nav link; migrate `npm run lint` from `next lint` to `eslint src` and confirm the same zero-warning result.
- [ ] **P2-13** Rename the filter label "Human & Official" → "Human & Licensed" now that `licensed_stock` exists.
- [ ] **P2-14** Add regression tests for: ad slot config, upload 413/415, preview route, `/collections` 200, error boundary retry.

---

## Verification (run after each task, and in full at the end)

```bash
npm run typecheck
npm run lint
npm test
npm run test:api
npm run build
npm run start        # then, in another shell:
node scripts/benchmark.mjs .audit/after-fixes.json
```

Browser (clean isolated context — the user's default profile has an unrelated `tradepay-pwa-v3` service worker on :3000):
- [ ] Home, one detail page, `/collections`, `/category/nature-cosmos`, `/ai-generator`, `/dmca` → 200, no console errors, CLS 0.
- [ ] Detail page ad placeholder still ≥48 px from download controls.
- [ ] All 17 licensed wallpapers render thumbnails with no broken images.

## Out of scope

- Connecting real Supabase/R2/Upstash/Fal credentials (still unverified against live services).
- Adding new wallpaper content or categories.
- Redesigning the UI beyond the fixes listed.
