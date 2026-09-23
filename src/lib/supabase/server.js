import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

/**
 * Supabase client for use inside Server Components, Server Actions, and
 * route handlers. Reads/writes the session via the request's cookies, so
 * `supabase.auth.getUser()` reflects whoever is actually signed in.
 *
 * Still uses only the public URL + anon key — the admin's permissions come
 * from their authenticated session plus the RLS policies in
 * supabase/migrations/0001_init.sql, not from an elevated key.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component render, where cookies can't be
            // written. Harmless as long as middleware.js is also refreshing
            // the session on every request (it is) — see middleware.js.
          }
        },
      },
    }
  );
}
