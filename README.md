# Trendy-Wallpapers

A high-performance **Next.js 15 (App Router, TypeScript strict)** wallpaper discovery, Smart Download, and AI Wallpaper Studio platform engineered for viral gaming traffic (GTA 6 / Vice City Neon, Cyberpunk, True OLED), programmatic SEO, zero-egress R2 media delivery, and first-try Google AdSense approval.

## Architecture Highlights

- **Dark-Mode-First Obsidian Glass UI:** Deep `#0B0D12` canvas, translucent glass cards (`bg-white/[0.04] backdrop-blur-xl`), Electric Vice Neon (`#FF2E93` → `#00F0FF`) CTAs, and strict zero-CLS (`aspect-ratio` + reserved `min-height` AdSlots).
- **Graceful Local Demo Mode:** Boots immediately with zero credentials using 18 curated seeded wallpapers, procedural SVG artwork, Sharp-transcoded `/api/download`, and simulated AI Studio responses. Populating `.env.local` seamlessly activates live Supabase, Cloudflare R2, Upstash Redis, and Fal.ai.
- **Thumbnail-Only Grids:** Masonry grids and related sections strictly load `<= 600px` thumbnails; full 4K/8K or custom cropped files are served exclusively through `/api/download` with immutable CDN cache headers.
- **Strict AI Transparency:** Every wallpaper carries `source_type` (`original` | `ai_generated` | `official_press`) with a prominent **All | Human & Official | AI Generated** filter pill.
- **AI Unit Economics & Circuit Breaker:** Upstash Redis enforces 2 free generations/day per hashed anonymous IP, 5/day per signed-in user, and a hard daily USD spend cap (`DAILY_AI_BUDGET_USD`, default `$5.00`). Safe AI generations auto-publish to R2 + Supabase for an automated SEO flywheel.
- **AdSense-Ready Editorial & Legal Stack:** 3 original 800+ word MDX guides in `content/guides/` with in-article `<AdSlot />`, 300+ word curated collections, `ImageObject`/`CollectionPage`/`Article` JSON-LD, GDPR/CCPA + AdSense privacy policy, and a live `/dmca` takedown portal.

## Quick Start (Local Demo Mode)

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). No external API keys are required to explore the gallery, interactive device preview stage, Smart Download endpoint, AI Studio simulation, MDX guides, or DMCA form.

## Going Live (Production Cutover)

1. Copy `.env.example` to `.env.local` and populate your credentials.
2. Run `supabase/migrations/001_initial_schema.sql` in your Supabase SQL Editor.
3. Create a Cloudflare R2 bucket with a public custom domain (`NEXT_PUBLIC_R2_PUBLIC_URL`).
4. Configure Upstash Redis (`UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`) and Fal.ai (`FAL_KEY`).
5. Verify strict TypeScript and production builds:

```bash
npm run typecheck
npm run build
```

### Content portability & monetization notes

- **Curated wallpapers are source-controlled.** The freely-licensed photographs live in
  `public/curated/` with typed metadata in `src/data/curated-wallpapers.ts`, so a fresh
  clone or deploy shows them with no external storage. Regenerate after adding licensed
  images with `node scripts/migrate-curated.mjs`.
- **Demo AI/admin output is local-only.** `.demo-wallpapers.json` and `.uploads/` are
  gitignored and filesystem-based; they are **not** valid on serverless hosts. Production
  AI generation and admin publishing require Supabase + R2 (steps above).
- **AdSense renders only when configured.** Set `NEXT_PUBLIC_ADSENSE_CLIENT_ID` *and* the
  numeric `NEXT_PUBLIC_ADSENSE_SLOT_*` IDs; otherwise CLS-reserved placeholders are shown.

## Admin Upload Endpoint

Upload new high-resolution wallpapers (auto-generates `<= 600px` WebP thumbnail, extracts top 5 dominant hex colors, detects True OLED dark status, uploads to R2, and inserts into Supabase):

```bash
curl -X POST http://localhost:3000/api/admin/upload \
  -H "Authorization: Bearer $ADMIN_UPLOAD_SECRET" \
  -F "file=@./master-4k.png" \
  -F "title=Vice City Midnight Rain 4K" \
  -F "description=A 150+ word editorial description of the wallpaper..." \
  -F "category_slug=gta-6-vice-city" \
  -F "source_type=original" \
  -F "tags=vice city,gta 6,4k,neon"
```
