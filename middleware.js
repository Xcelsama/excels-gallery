import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

/**
 * Runs before every matched request. Two jobs:
 *  1. Refresh the Supabase auth cookie so sessions don't silently expire.
 *  2. Gate everything under /admin (except the login page itself) behind
 *     an actual signed-in user, before any page/layout even renders.
 *
 * This is defense-in-depth on top of, not instead of, the RLS policies in
 * supabase/migrations/0001_init.sql, even if a request slipped past this
 * middleware, Postgres would still refuse an unauthenticated write.
 */
export async function middleware(request) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getUser() re-validates the token against Supabase rather than trusting
  // whatever the cookie claims, which matters for a route guard like this.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isAdminRoute = pathname.startsWith("/admin");
  const isLoginRoute = pathname.startsWith("/admin/login");

  if (isAdminRoute && !isLoginRoute && !user) {
    const loginUrl = new URL("/admin/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  if (isLoginRoute && user) {
    const adminUrl = new URL("/admin", request.url);
    return NextResponse.redirect(adminUrl);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match everything except static assets and image files, so the
     * session cookie stays fresh across normal navigation without doing
     * unnecessary work on every asset request.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|avif)$).*)",
  ],
};
