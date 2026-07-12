import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PROTECTED_ROUTES = ["/onboarding", "/post-login"];
const AUTH_ROUTES = ["/auth/login", "/auth/signup", "/auth/forgot-password"];

function matchesRoute(pathname: string, routes: string[]): boolean {
  return routes.some((route) => {
    if (pathname === route) return true;
    if (route === "/edit" && pathname.endsWith("/edit")) return true;
    return false;
  });
}

export async function proxy(request: NextRequest) { 
  // 1. Create the singular base response instance
  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  // 2. Initialize Supabase with clean cookie pass-throughs
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Mutate the original request object
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          
          // ✅ FIX: Directly mutate the existing response object. 
          // Do NOT assign response = NextResponse.next() here.
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // 3. Securely check the active user session
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // 4. Handle Redirection Logic cleanly without re-running cookie layers
  const isProtectedRoute =
    matchesRoute(pathname, PROTECTED_ROUTES) || pathname.endsWith("/edit");
    
  if (!user && isProtectedRoute) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const isAuthRoute = matchesRoute(pathname, AUTH_ROUTES);
  if (user && isAuthRoute) {
    return NextResponse.redirect(new URL("/post-login", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|auth/callback|auth/reset-callback).*)",
  ],
};
