import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { VISITOR_COOKIE_NAME } from "@/lib/analytics/visitor";
import {
  SESSION_COOKIE_NAME,
  SESSION_WINDOW_SECONDS,
} from "@/lib/analytics/session";

const PROTECTED_ROUTES = ["/onboarding", "/post-login"];
const AUTH_ROUTES = ["/auth/login", "/auth/signup", "/auth/forgot-password", "/auth/verify-reset", "/auth/reset-password"];
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/**
 * Cookie consent, mirrored from the client banner. The banner stores the
 * choice in localStorage (invisible to middleware), so CookieConsentBanner
 * also writes it here. Values: 'accepted' | 'declined'. Absent = undecided.
 */
const CONSENT_COOKIE_NAME = "kq_consent";

function matchesRoute(pathname: string, routes: string[]): boolean {
  // Exact match only. Suffix-style routes (e.g. "/{username}/edit") are
  // handled explicitly at the call site via pathname.endsWith("/edit").
  return routes.includes(pathname);
}

function randomId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export async function proxy(request: NextRequest) {
  const nextAction = request.headers.get("next-action");
  if (nextAction === "x" || nextAction === "test" || (nextAction && nextAction.length < 5)) {
    return new NextResponse("Unauthorized Access Attempt", { status: 400 });
  }

  // Create the singular base response instance
  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const { pathname } = request.nextUrl;

  // Auth is only CHECKED on routes that need it (protected/auth pages), and
  // only REFRESHED on requests that actually carry a Supabase session cookie.
  //
  // supabase.auth.getUser() is a NETWORK round-trip to Supabase Auth for
  // signed-in users, so running it on every request (the old behaviour) put
  // that latency on the landing page, every public card and every asset
  // fetch. The matcher below also excludes all static assets, so the proxy
  // now only touches real navigations / RSC fetches:
  //   - anonymous visitors (the majority: QR scanners, crawlers, landing)
  //     → zero auth work, just the consent-cookie logic below;
  //   - signed-in visitors → getUser() still refreshes their expiring session
  //     cookies on every page render (the @supabase/ssr pattern — browser
  //     clients can't renew HttpOnly cookies themselves), and route
  //     protection works exactly as before.
  const isProtectedRoute =
    matchesRoute(pathname, PROTECTED_ROUTES) || pathname.endsWith("/edit");
  const isAuthRoute = matchesRoute(pathname, AUTH_ROUTES);
  const hasAuthCookies = request.cookies
    .getAll()
    .some((cookie) => cookie.name.startsWith("sb-"));

  if (isProtectedRoute || isAuthRoute || hasAuthCookies) {
    // Initialize Supabase with clean cookie pass-throughs
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

    // Securely check the active user session (also refreshes expiring tokens)
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Handle Redirection Logic cleanly without re-running cookie layers
    if (!user && isProtectedRoute) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    if (user && isAuthRoute) {
      return NextResponse.redirect(new URL("/post-login", request.url));
    }
  }

  // Anonymous analytics cookies (visitor + session) — CONSENT-GATED.
  //    Must be set here (middleware) because Server Components cannot
  //    modify cookies. Setting on `request.cookies` makes the value visible
  //    to the downstream page on THIS request; `response.cookies` persists
  //    it in the browser.
  //
  //    • kq_vid — stable visitor id (1 year). Powers unique/returning counts.
  //    • kq_sid — 30-minute SLIDING session. Refreshed on every request so
  //      the session survives while the visitor stays active; after 30 min
  //      of inactivity it expires and the next visit starts a new session.
  //      This is what de-duplicates profile views (one per visitor/session).
  //
  //    Privacy: both are HttpOnly first-party random UUIDs (no PII), and are
  //    only set AFTER the visitor accepts cookies. "Necessary only" visitors
  //    get no analytics cookies; their page views still count as anonymous
  //    aggregate events but can't be attributed to a visitor or session.
  const consent = request.cookies.get(CONSENT_COOKIE_NAME)?.value;

  if (consent === "accepted") {
    if (!request.cookies.get(VISITOR_COOKIE_NAME)?.value) {
      const newId = randomId();
      request.cookies.set(VISITOR_COOKIE_NAME, newId);
      response.cookies.set(VISITOR_COOKIE_NAME, newId, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: ONE_YEAR_SECONDS,
        path: "/",
      });
    }

    // Always (re)set the session cookie — same value slides the window
    // forward, new value starts a fresh session.
    const sessionId = request.cookies.get(SESSION_COOKIE_NAME)?.value ?? randomId();
    request.cookies.set(SESSION_COOKIE_NAME, sessionId);
    response.cookies.set(SESSION_COOKIE_NAME, sessionId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: SESSION_WINDOW_SECONDS,
      path: "/",
    });
  } else if (consent === "declined") {
    // Respect the "Necessary only" choice: drop any analytics cookies.
    response.cookies.delete(VISITOR_COOKIE_NAME);
    response.cookies.delete(SESSION_COOKIE_NAME);
  }
  // No decision yet → the banner is showing; analytics cookies wait.

  return response;
}

export const config = {
  matcher: [
    // Run ONLY on real navigations / RSC fetches. Everything that is pure
    // static payload skips the proxy entirely — previously every image, icon,
    // the service worker script and the manifest paid proxy + (for signed-in
    // users) a Supabase Auth round-trip:
    //   - Next.js pipelines (_next/static, _next/image)
    //   - public/ assets: /icons/*, /banners/*, root-level images (banner.png,
    //     k-white.png, favicons, …), the Serwist service worker (/serwist/*),
    //     the web app manifest and SEO files (robots, sitemap, llms.txt)
    //   - anything ending in a static-asset extension
    //   - the precached PWA shell pages (/launch, /offline) — server-rendered
    //     once, then served by the service worker; the consent cookie they
    //     need is written client-side and read on the next proxied navigation.
    // Route protection is unaffected: protected/auth routes and all profile
    // pages still match.
    "/((?!api|_next/static|_next/image|favicon\\.ico|auth/callback|serwist/|icons/|banners/|manifest\\.webmanifest|robots\\.txt|sitemap\\.xml|llms\\.txt|launch|offline|.*\\.(?:png|jpe?g|svg|webp|ico|css|js|map|txt|xml|webmanifest)$).*)",
  ],
};
