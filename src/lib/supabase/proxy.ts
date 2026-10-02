import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getServerEnv, getSupabaseAnonKey, isSupabaseConfigured } from "@/lib/env";

const PUBLIC_PREFIXES = [
  "/",
  "/login",
  "/signup",
  "/forgot-password",
  "/auth",
  "/api/health",
  "/legal",
  "/legal/privacy",
  "/legal/terms",
  "/legal/cookies",
];

const AUTH_PAGES = [
  "/login",
  "/signup",
  "/forgot-password",
  "/auth/sign-in",
  "/auth/sign-up",
  "/auth/forgot-password",
];

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
  if (/\.(?:svg|png|jpg|jpeg|gif|webp|mp4|webm|ico)$/i.test(pathname)) return true;
  return false;
}

function signInUrl(request: NextRequest, pathname: string) {
  const url = request.nextUrl.clone();
  url.pathname = "/auth/sign-in";
  url.searchParams.set("next", pathname);
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
    const next = request.nextUrl.searchParams.get("next");
    const url = request.nextUrl.clone();
    if (next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/api/")) {
      url.pathname = next;
      url.search = "";
      return NextResponse.redirect(url);
    }
    url.pathname = "/home";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
