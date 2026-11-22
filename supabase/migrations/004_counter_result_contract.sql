-- Make view increments report whether a published row was actually affected.
--
-- The API previously returned `counted: true` whenever the RPC promise resolved, even
-- for a missing/unpublished row. The boolean contract lets the route answer truthfully.
--
-- A return-type change cannot use CREATE OR REPLACE, so the function is dropped and
-- recreated. Execute restrictions from 002 are re-applied immediately afterwards.

revoke execute on function public.increment_wallpaper_views(uuid) from public, anon, authenticated;

drop function if exists public.increment_wallpaper_views(uuid);

create function public.increment_wallpaper_views(row_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated_rows integer;
begin
  update public.wallpapers
  set views_count = views_count + 1
  where id = row_id
    and is_published = true;

  get diagnostics updated_rows = row_count;
  return updated_rows > 0;
end;
$$;

revoke execute on function public.increment_wallpaper_views(uuid)
  from public, anon, authenticated;
grant execute on function public.increment_wallpaper_views(uuid) to service_role;
