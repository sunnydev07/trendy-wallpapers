-- Trendy-Wallpapers Initial PostgreSQL Schema & RLS Policies
-- Run in Supabase SQL Editor or via `supabase db push`

create extension if not exists "pgcrypto";

create type wallpaper_source_type as enum ('original', 'ai_generated', 'official_press');

create table public.wallpapers (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text not null, -- 150+ words for SEO context & AdSense value
  source_type wallpaper_source_type not null default 'original',
  category_slug text not null,
  tags text[] not null default '{}',
  dominant_colors text[] not null default '{}', -- top 5 hex codes e.g. ['#0B0D12', '#FF2E93']
  width integer not null,
  height integer not null,
  aspect_ratio text not null, -- e.g. '16:9', '21:9', '9:16'
  device_types text[] not null default '{}', -- e.g. ['desktop', 'ultrawide', 'mobile']
  r2_original_key text not null,
  r2_thumb_key text not null,
  downloads_count integer not null default 0,
  views_count integer not null default 0,
  is_textless boolean not null default true,
  is_oled_dark boolean not null default false,
  attribution_text text not null default 'Original Artwork — Trendy-Wallpapers',
  is_published boolean not null default true,
  created_at timestamptz not null default now()
);

create index idx_wallpapers_category on public.wallpapers (category_slug) where is_published = true;
create index idx_wallpapers_source on public.wallpapers (source_type) where is_published = true;
create index idx_wallpapers_tags on public.wallpapers using gin (tags);
create index idx_wallpapers_colors on public.wallpapers using gin (dominant_colors);
create index idx_wallpapers_downloads on public.wallpapers (downloads_count desc);
create index idx_wallpapers_created on public.wallpapers (created_at desc) where is_published = true;

create table public.ai_generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null,
  ip_hash text not null,
  prompt text not null,
  style_preset text not null,
  aspect_ratio text not null,
  model_used text not null,
  cost_usd numeric(10, 5) not null default 0.00300,
  wallpaper_id uuid references public.wallpapers(id) on delete set null,
  created_at timestamptz not null default now()
);

create index idx_ai_generations_ip_created on public.ai_generations (ip_hash, created_at desc);

create table public.dmca_reports (
  id uuid primary key default gen_random_uuid(),
  wallpaper_id uuid references public.wallpapers(id) on delete set null,
  wallpaper_url text not null,
  reporter_name text not null,
  reporter_email text not null,
  claim_details text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create index idx_dmca_reports_status on public.dmca_reports (status, created_at desc);

create or replace function public.increment_wallpaper_downloads(row_id uuid)
returns void language plpgsql security definer as $$
begin
  update public.wallpapers set downloads_count = downloads_count + 1 where id = row_id;
end;
$$;

create or replace function public.increment_wallpaper_views(row_id uuid)
returns void language plpgsql security definer as $$
begin
  update public.wallpapers set views_count = views_count + 1 where id = row_id;
end;
$$;

-- Row Level Security (RLS)
alter table public.wallpapers enable row level security;
alter table public.ai_generations enable row level security;
alter table public.dmca_reports enable row level security;

-- Public read access for published wallpapers only
create policy "Public can view published wallpapers"
  on public.wallpapers
  for select
  using (is_published = true);

-- Service role full access for administrative uploads & AI auto-publish
create policy "Service role manages wallpapers"
  on public.wallpapers
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- Service role manages AI generation logs
create policy "Service role manages ai_generations"
  on public.ai_generations
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- Authenticated users can read their own AI generation history
create policy "Users can view own ai_generations"
  on public.ai_generations
  for select
  using (auth.uid() = user_id);

-- Service role manages DMCA reports (inserted via validated API route)
create policy "Service role manages dmca_reports"
  on public.dmca_reports
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
