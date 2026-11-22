-- Server-side gallery filtering + pagination.
--
-- The application previously filtered an in-memory snapshot of the top 1,000 rows, so
-- published records outside that window disappeared from search, detail, collection, and
-- sitemap flows. This function applies the complete predicate set before ordering and
-- slicing, so only one bounded page of rows is transferred.
--
-- Semantics intentionally mirror `applyInMemoryFilters` in src/lib/data-provider.ts:
--   * literal case-insensitive substring search (no full-text/trigram substitution)
--   * category aliases including device-trait OR conditions
--   * resolution predicates identical to the demo implementation
--   * exact RGB squared-distance color match at 85 * 85
--   * deterministic ID tie-breaking after the primary sort
--   * 25-row hard ceiling (24-card page + one lookahead row)

create or replace function public.query_wallpapers(
  p_q text default '',
  p_category text default null,
  p_resolution text default null,
  p_device text default null,
  p_source text default null,
  p_color text default null,
  p_textless boolean default false,
  p_oled boolean default false,
  p_sort text default 'popular',
  p_limit integer default 25,
  p_offset integer default 0
)
returns setof public.wallpapers
language sql
stable
security invoker
set search_path = ''
as $$
  select w.*
  from public.wallpapers w
  where w.is_published = true
    and (
      coalesce(p_q, '') = ''
      or strpos(lower(w.title), lower(p_q)) > 0
      or strpos(lower(w.description), lower(p_q)) > 0
      or strpos(lower(w.category_slug), lower(p_q)) > 0
      or exists (
        select 1 from unnest(w.tags) as tag
        where strpos(lower(tag), lower(p_q)) > 0
      )
    )
    and (
      p_category is null
      or w.category_slug = p_category
      or (p_category = 'ultrawide' and 'ultrawide' = any(w.device_types))
      or (p_category = 'mobile' and 'mobile' = any(w.device_types))
      or (p_category = 'minimalist-oled' and w.is_oled_dark)
    )
    and (
      p_resolution is null
      or (p_resolution = '4k' and w.width >= 3840 and w.aspect_ratio = '16:9')
      or (
        p_resolution = 'ultrawide'
        and (w.aspect_ratio = '21:9' or 'ultrawide' = any(w.device_types))
      )
      or (
        p_resolution = 'mobile'
        and (w.aspect_ratio = '9:16' or 'mobile' = any(w.device_types))
      )
      or (p_resolution = 'dual-monitor' and (w.aspect_ratio = '32:9' or w.width >= 3440))
      or (p_resolution = 'oled' and w.is_oled_dark)
    )
    and (p_device is null or p_device = any(w.device_types))
    and (
      p_source is null
      or (
        p_source = 'human'
        and w.source_type in ('original', 'official_press', 'licensed_stock')
      )
      or (p_source = 'ai' and w.source_type = 'ai_generated')
    )
    and (p_textless is not true or w.is_textless)
    and (p_oled is not true or w.is_oled_dark)
    and (
      p_color is null
      or exists (
        select 1
        from unnest(w.dominant_colors) as candidate
        cross join lateral (
          select regexp_replace(candidate, '^#', '') as candidate_hex,
                 regexp_replace(coalesce(p_color, ''), '^#', '') as target_hex
        ) hexes
        cross join lateral (
          select
            case when hexes.candidate_hex ~* '^[0-9a-f]{6}$'
              then ('x' || substr(hexes.candidate_hex, 1, 2))::bit(8)::int else 0 end as r,
            case when hexes.candidate_hex ~* '^[0-9a-f]{6}$'
              then ('x' || substr(hexes.candidate_hex, 3, 2))::bit(8)::int else 0 end as g,
            case when hexes.candidate_hex ~* '^[0-9a-f]{6}$'
              then ('x' || substr(hexes.candidate_hex, 5, 2))::bit(8)::int else 0 end as b,
            case when hexes.target_hex ~* '^[0-9a-f]{6}$'
              then ('x' || substr(hexes.target_hex, 1, 2))::bit(8)::int else 0 end as tr,
            case when hexes.target_hex ~* '^[0-9a-f]{6}$'
              then ('x' || substr(hexes.target_hex, 3, 2))::bit(8)::int else 0 end as tg,
            case when hexes.target_hex ~* '^[0-9a-f]{6}$'
              then ('x' || substr(hexes.target_hex, 5, 2))::bit(8)::int else 0 end as tb
        ) channels
        where hexes.candidate_hex ~* '^[0-9a-f]{6}$'
          and hexes.target_hex ~* '^[0-9a-f]{6}$'
          and power(channels.r - channels.tr, 2)
            + power(channels.g - channels.tg, 2)
            + power(channels.b - channels.tb, 2) <= 7225
      )
    )
  order by
    case when p_sort = 'popular' then w.downloads_count end desc nulls last,
    case when p_sort = 'views' then w.views_count end desc nulls last,
    case when p_sort = 'newest' then w.created_at end desc nulls last,
    w.id asc
  limit least(greatest(coalesce(p_limit, 25), 1), 25)
  offset greatest(coalesce(p_offset, 0), 0)
$$;

revoke all on function public.query_wallpapers(text, text, text, text, text, text, boolean, boolean, text, integer, integer) from public;
grant execute on function public.query_wallpapers(text, text, text, text, text, text, boolean, boolean, text, integer, integer) to anon, authenticated, service_role;

-- Candidate indexes for the bounded page queries. Validate with EXPLAIN (ANALYZE, BUFFERS)
-- against representative data before relying on them, and drop any that are unused.
create index if not exists idx_wallpapers_popular_page
  on public.wallpapers (downloads_count desc, id asc) where is_published = true;
create index if not exists idx_wallpapers_newest_page
  on public.wallpapers (created_at desc, id asc) where is_published = true;
create index if not exists idx_wallpapers_views_page
  on public.wallpapers (views_count desc, id asc) where is_published = true;
