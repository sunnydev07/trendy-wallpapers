# Trendy-Wallpapers: efficiency and correctness implementation report

- **Date:** 2026-11-22
- **Base commit:** `a1d4b4a` (Harden JSON-LD output, honor resolution device filters, and track views)
- **Mode verified:** credential-free demo mode on Windows / Node `v24.22.1`
- **Benchmark artifact:** `.audit/after-efficiency.json` (local, not committed)

This report records what was implemented from the research plan, the fresh checks that
were actually run, and what remains unverified. It replaces no historical audit files.

## Implemented work

### 1. Trustworthy, isolated baseline

- `scripts/benchmark.mjs` is now read-only by default, with `--include-mutations`
  required for AI/DMCA/upload scenarios.
- Every failure is explicit: an unexpected status is a failure even when the body is
  empty; PNG/preview responses are validated with Sharp.
- Options: `--samples` (max 200), `--concurrency` (max 6), `--cold`, `--out`, `--url`.
- The harness launches its own `next start` on a free loopback port with sanitized empty
  service credentials, a temporary `DEMO_WALLPAPER_STORE`, a temporary `DEMO_UPLOAD_DIR`,
  and a test-only admin secret. Mutating scenarios cannot target `--url` servers.
- Reports contain status distribution, p50/p95/min/max, response bytes, configuration,
  commit, Node version, process RSS, and event-loop delay percentiles.
- `tests/benchmark.test.mjs` covers empty-body failures, percentile math, and bounded args.

### 2. Restricted counter RPCs

- `supabase/migrations/002_counter_rpc_permissions.sql` revokes execute from
  `public`/`anon`/`authenticated`, grants `service_role`, and pins `search_path = ''`.
  The historical initial migration was not edited.

### 3. Atomic paid readiness and quota reservation

- Quota spend is stored in integer units (`100000`/USD); keys use a versioned
  `tw:ai:*_units:v2:*` namespace so float keys are never reinterpreted.
- One Lua evaluation validates counters, checks the identity limit and daily budget, and
  only then increments both. Denied attempts write nothing. Invalid/missing values,
  Redis errors, and ambiguous replies fail closed without retrying the reservation.
- Quota reads use one `MGET`.
- `isPaidGenerationReady()` requires Fal + R2 + Supabase admin + public catalog + Redis.
  Partial live configuration returns `503 SERVICE_UNAVAILABLE` before quota or dispatch.
- Demo accounting checks and reserves synchronously before any `await`.
- `resetDemoQuotaForTests()` plus concurrency/budget tests cover the demo path.

### 4. Canonical filters and primitive memoization

- `normalizeWallpaperFilters()` supplies one canonical shape: default source/device/sort,
  trimmed 200-character search, case-normalized hex, known enums, positive integer page,
  bounded internal limit.
- `filterCacheKey()` is deterministic JSON over the normalized object, so separator
  characters cannot collide (`rain&source=ai` ≠ `q=rain` + `source=ai`).
- `queryCatalog` is keyed by that single primitive string and parses inside the cached
  body. Sorts break ties by ID; `newest` parses timestamps once outside the comparator.

### 5. Complete catalog access and bounded gallery pagination

- `queryWallpapers()` now returns `{ items, page, hasNextPage }`; every caller was
  updated in the same change and no compatibility wrapper remains.
- Demo filtering applies the full predicate set before slicing; live filtering calls the
  new `public.query_wallpapers` SQL function (migration `003`), which applies the same
  substring/category/resolution/device/source/textless/OLED/exact-color semantics before
  ordering and slicing 25 rows for a 24-card page.
- Detail lookup is a direct published-slug query; collections fetch their listed slugs
  directly; sitemap enumeration uses a stable ID cursor in 1,000-row batches;
  `generateStaticParams` prebuilds at most 100 popular slugs and leaves the rest dynamic.
- Only default page-1 home/category/resolution listings are persistently cached for 60 s.
  Deeper pages and arbitrary filter/text/color combinations use request deduplication.
- `GalleryPagination` is a server component that preserves every query parameter and
  works without JavaScript.

### 6. Bounded image work, not only Sharp jobs

- `resolveOutputDimensions()` derives complete geometry from oriented source dimensions
  before resize, enforcing side ≤ 7,680 and pixels ≤ 33,177,600. Previews fit inside a
  1,200×1,200 box and remain WebP. Height-only requests can no longer bypass the width
  clamp; `inside` keys the actual fitted dimensions and never upscales.
- `runImagePipeline()` admits 2 active pipelines with 4 descriptor-only waiters, a 10 s
  queue deadline, abort-aware waiting, and `finally` slot release. It is separate from the
  Sharp job pool.
- HTTP and R2 bodies are counted while streaming and stop at 40 MiB; R2 surfaces typed
  missing-object vs upstream errors. The admin multipart body is bounded at 45 MiB before
  `formData()`.
- Error mapping: 400 invalid/corrupt, 413 oversized input/body/output, 415 unsupported
  media, 503 + `Retry-After` capacity, 404 missing source, 502 upstream, 504 deadline.

### 7. Cheaper, coherent derivative caching

- Cache identity uses the original object key, planned geometry, fit, output format, and
  the effective clamped quality. PNG omits quality.
- `Processed` stores a precomputed ETag, so warm 200/304 responses perform no hashing,
  source reads, or Sharp work.
- Local/curated originals are read with `fs.promises`.
- Filenames use the processed dimensions, not the requested ones.
- Non-versioned slug URLs now use `public, max-age=60, s-maxage=300`; 304s send the same
  coherent headers and ETag. RPC failures returned by the counter are handled.

### 8. Single-pass ingestion and truthful asset identity

- Metadata-only inspection decides crops; color analysis runs once on the final stored
  buffer, and the metadata result is reused when no transformation occurs.
- Stored extension/content type come from decoded metadata, not declared MIME. Uncropped
  provider bytes keep their real format; cropped output is explicitly PNG.
- New asset keys use UUID-derived suffixes. Demo uploads are split into
  `.uploads/originals/` and `.uploads/thumbs/`, with a `DEMO_UPLOAD_DIR` override.
- `scripts/migrate-uploads.mjs` is a deliberate dry-run-first migration for existing flat
  uploads. It was **not** run against the user's files.

### 9. One generation deadline

- A single 80 s request budget (below the 90 s client budget) composes abort signals for
  Fal (`abortSignal`, `timeout`, `onEnqueue`), artwork fetch/body reads, and R2 uploads.
- Dispatch is tracked explicitly. Deadline expiry returns `GENERATION_STATUS_UNKNOWN`
  once dispatch may have occurred; nothing is retried or refunded automatically.
- The ledger insert checks `{ error }`; wallpaper publication still gates success.

### 10. Truthful views and bounded demo maps

- Invalid/oversized IDs are rejected; UUID syntax is required only outside demo mode.
- The view limiter and storage calls live inside the best-effort boundary.
- The view RPC now returns a boolean affected-row result scoped to published rows
  (`004`), and the route returns `{ counted: false }` for unknown rows or RPC errors.
  Dedupe stays claimed on ambiguous failure to avoid double counting.
- Demo limiter/dedupe maps sweep expired entries at the 10,000-key cap and deny new tracked
  work rather than evicting live quota records.

### 11. Filter continuity and lean client props

- The home search form carries active filters as hidden fields; changing any
  filter/search/sort deletes `page`; sort-only state now reveals Reset.
- Auto-Fit validates side and pixel limits before rendering a download link, with an
  explicit explanation for unsupported screens.
- `DevicePreviewStage` and `SmartDownloadPanel` accept `Pick<Wallpaper, …>` slices.
- Canonical URLs were added for home/category/resolution/detail; filtered/search
  combinations are `noindex, follow` while primary pages stay indexable.

## Fresh verification (executed 2026-11-22)

| Check | Command | Result |
|---|---|---|
| Typecheck | `npm run typecheck` | exit 0 |
| Lint | `npm run lint` | exit 0 |
| Unit tests | `npm test` | 63 tests, 63 pass, 0 fail |
| Production build | `npm run build` | exit 0 |
| API integration | `npm run test:api` against harness-launched isolated server | 18 tests, 18 pass |
| Read-only benchmark | `node scripts/benchmark.mjs --samples=10 --cold=1 --concurrency=1,2 --out=.audit/after-efficiency.json` | exit 0, zero failures |

Benchmark highlights (serial localhost HTTP, 10 warm samples, production build, demo data):

- Homepage `p50 43.0 ms`, `p95 63.4 ms`, max `63.4 ms`
- Detail page `p50 10.6 ms`, `p95 18.4 ms`
- Cached preview `p50 4.2 ms`, `p95 6.0 ms`; concurrency 2 preview `p95 5.9 ms`
- Process-cold first request on `/`: `116.9 ms`
- All statuses `200`; zero unexpected failures

These are HTTP timings from one machine and are not browser Core Web Vitals, p95 under
production traffic, or a capacity estimate.

## Not verified / limitations

- SQL migrations `002`–`004` were written but **not applied** to any database. Live
  filter parity, `EXPLAIN (ANALYZE, BUFFERS)` plans, and privilege assertions still need
  an explicitly approved isolated/staging database.
- The Redis Lua reservation was not executed against Upstash. Demo-path atomicity is
  covered by tests; distributed behavior and malformed-value handling on a real instance
  remain unverified.
- The paid Fal/R2/Supabase path requires credentials and was not exercised. Deadline and
  status handling are code-reviewed and mocked by types, not live-tested.
- Browser LCP/INP/CLS, keyboard walkthroughs, and visual regressions were not measured.
  No screenshots were requested.
- Existing `.uploads` files were not moved. `scripts/migrate-uploads.mjs` defaults to a
  dry run; flat-root reads remain as a compatibility path until migration is approved.
- `after()` was not adopted for deferred counter work; the existing detached best-effort
  call now inspects the RPC result instead.
- Index candidates in `003` still need production-representative plan validation.

## Rollback notes

1. Revert the application commit to restore the previous query/route contracts. The old
   catalog snapshot defect (records beyond the first 1,000) returns with it.
2. Database rollback: drop `public.query_wallpapers(...)` and the three new indexes.
   Keep `002`'s execute restrictions in place — never reopen public counter writes.
3. `004` changed the view RPC return type; rolling it back requires recreating the old
   `void` function, and the route then reports `counted: false` until re-upgraded.
4. Quota keys use a new versioned integer namespace. Do not roll back into an empty
   accounting namespace mid-budget; reconcile spend at a UTC boundary.
5. Upload migration is reversible per file: move files from `originals/`/`thumbs/` back
   to the flat root only after confirming the previous read path is restored.
