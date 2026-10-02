import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAppUrl, isSupabaseConfigured } from "@/lib/env";
import { getCurrentUser, recordSignIn } from "@/lib/auth";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/home";

  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(new URL("/auth/sign-in", getAppUrl()));
  }

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      logger.warn("auth.callback.failed", { error: error.message });
      return NextResponse.redirect(new URL("/auth/sign-in?error=auth", getAppUrl()));
    }
  }

  try {
    const user = await getCurrentUser();
    if (user) await recordSignIn(user.id);
    const safeNext =
      next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/api/") ? next : "/home";
    const destination =
      safeNext.startsWith("/still") || safeNext.startsWith("/try")
        ? safeNext
        : user && !user.onboardingCompletedAt
          ? "/onboarding"
          : safeNext;
    return NextResponse.redirect(new URL(destination, getAppUrl()));
  } catch (error) {
    logger.warn("auth.callback.provision_failed", {
      error: error instanceof Error ? error.message : "unknown",
    });
  }

  const fallback =
    next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/api/") ? next : "/home";
  return NextResponse.redirect(new URL(fallback, getAppUrl()));
}
