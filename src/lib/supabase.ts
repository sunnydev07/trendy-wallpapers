import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { isSupabaseAdminConfigured, isSupabaseConfigured } from "./env";
import { fetchWithTimeout } from "./fetch-with-timeout";

let publicClientSingleton: SupabaseClient | null = null;
let adminClientSingleton: SupabaseClient | null = null;

/**
 * Stateless anonymous client for public catalog reads. Deliberately cookie-free so
 * `cookies()` is never touched during static generation or cached public rendering.
 */
export function getSupabasePublicClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  if (publicClientSingleton) return publicClientSingleton;

  publicClientSingleton = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
      global: { fetch: fetchWithTimeout },
    }
  );
  return publicClientSingleton;
}

/**
 * Cookie-bound client for authenticated request identity only.
 */
export async function getSupabaseServerClient(): Promise<SupabaseClient | null> {
  if (!isSupabaseConfigured()) return null;

  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Read-only Server Component contexts cannot mutate cookies.
          }
        },
      },
      global: { fetch: fetchWithTimeout },
    }
  );
}

/**
 * Service-role client for privileged writes (admin uploads, AI auto-publish, DMCA inserts).
 * Never import or expose in client components.
 */
export function getSupabaseAdminClient(): SupabaseClient | null {
  if (!isSupabaseAdminConfigured()) return null;
  if (adminClientSingleton) return adminClientSingleton;

  adminClientSingleton = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      global: { fetch: fetchWithTimeout },
    }
  );
  return adminClientSingleton;
}
