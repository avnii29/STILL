import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAppUrl, isSupabaseConfigured } from "@/lib/env";
import { getCurrentUser, openAppAccess, recordSignIn } from "@/lib/auth";
import { safeAuthNext } from "@/lib/auth/policy";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/app";

  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(new URL("/login", getAppUrl()));
  }

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      logger.warn("auth.callback.failed", { error: error.message });
      return NextResponse.redirect(new URL("/login?error=auth", getAppUrl()));
    }
  }

  try {
    const user = await getCurrentUser();
    if (user) {
      await openAppAccess(user.id);
      await recordSignIn(user.id);
    }
  } catch (error) {
    logger.warn("auth.callback.provision_failed", {
      error: error instanceof Error ? error.message : "unknown",
    });
  }

  const destination = safeAuthNext(next);
  return NextResponse.redirect(new URL(destination, getAppUrl()));
}
