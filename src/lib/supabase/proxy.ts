import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { safeAuthNext } from "@/lib/auth/policy";
import { getServerEnv, getSupabaseAnonKey, isSupabaseConfigured } from "@/lib/env";

const PUBLIC_PREFIXES = [
  "/",
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/auth",
  "/api/health",
  "/legal",
  "/legal/privacy",
  "/legal/terms",
  "/legal/cookies",
];

const AUTH_PAGES = ["/login", "/signup", "/auth/sign-in", "/auth/sign-up"];

export function isPublicPath(pathname: string) {
  if (PUBLIC_PREFIXES.includes(pathname)) return true;
  if (pathname.startsWith("/auth/")) return true;
  if (pathname.startsWith("/legal")) return true;
  if (pathname === "/try" || pathname.startsWith("/try/")) return true;
  if (pathname === "/still" || pathname.startsWith("/still/")) return true;
  if (pathname.startsWith("/api/health")) return true;
  if (pathname.startsWith("/api/extract")) return true;
  if (pathname.startsWith("/api/cron/")) return true;
  if (pathname.startsWith("/api/integrations/telegram/webhook")) return true;
  if (pathname.startsWith("/api/integrations/whatsapp/webhook")) return true;
  if (pathname.startsWith("/api/integrations/instagram/webhook")) return true;
  if (pathname === "/webhooks/google-calendar") return true;
  if (pathname === "/connectors/google-calendar/callback") return true;
  if (pathname === "/demo" || pathname.startsWith("/demo/")) return true;
  if (pathname === "/how" || pathname === "/help" || pathname === "/contact") return true;
  if (pathname === "/accessibility" || pathname === "/status") return true;
  if (pathname.startsWith("/api/demo")) return true;
  if (/\.(?:svg|png|jpg|jpeg|gif|webp|mp4|webm|ico)$/i.test(pathname)) return true;
  return false;
}

function signInUrl(request: NextRequest, pathname: string) {
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", safeAuthNext(pathname));
  return url;
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });
  const pathname = request.nextUrl.pathname;

  if (!isSupabaseConfigured()) {
    if (!isPublicPath(pathname) && !pathname.startsWith("/api/")) {
      return NextResponse.redirect(signInUrl(request, pathname));
    }
    return supabaseResponse;
  }

  const env = getServerEnv();
  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL!,
    getSupabaseAnonKey()!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
          Object.entries(headers).forEach(([key, value]) => {
            supabaseResponse.headers.set(key, value);
          });
        },
      },
    },
  );

  const { data } = await supabase.auth.getUser();
  const user = data.user;

  if (!user && !isPublicPath(pathname) && !pathname.startsWith("/api/")) {
    return NextResponse.redirect(signInUrl(request, pathname));
  }

  if (user && AUTH_PAGES.includes(pathname)) {
    const destination = safeAuthNext(request.nextUrl.searchParams.get("next"));
    const url = request.nextUrl.clone();
    const parsed = new URL(destination, request.url);
    url.pathname = parsed.pathname;
    url.search = parsed.search;
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
