-- Restrict the two SECURITY DEFINER counter functions.
--
-- Default function grants let any client call these RPCs directly, bypassing the
-- application's rate-limited routes. Only the service role that the API routes use may
-- execute them, and the definer functions get a pinned empty search path.
--
-- Do not edit 001_initial_schema.sql: existing installs need this additive migration.

revoke execute on function public.increment_wallpaper_downloads(uuid)
  from public, anon, authenticated;
revoke execute on function public.increment_wallpaper_views(uuid)
  from public, anon, authenticated;

grant execute on function public.increment_wallpaper_downloads(uuid) to service_role;
grant execute on function public.increment_wallpaper_views(uuid) to service_role;

alter function public.increment_wallpaper_downloads(uuid) set search_path = '';
alter function public.increment_wallpaper_views(uuid) set search_path = '';

-- Verification (run against an isolated/staging database):
--   select has_function_privilege('anon', 'public.increment_wallpaper_views(uuid)', 'execute');          -- false
--   select has_function_privilege('authenticated', 'public.increment_wallpaper_downloads(uuid)', 'execute'); -- false
--   select has_function_privilege('service_role', 'public.increment_wallpaper_views(uuid)', 'execute');  -- true
