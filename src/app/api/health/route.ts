import { NextResponse } from "next/server";
import { checkDatabase } from "@/lib/prisma";
import { isDatabaseConfigured, isSupabaseConfigured, getServerEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET() {
  const env = getServerEnv();
  const db = isDatabaseConfigured() ? await checkDatabase() : { ok: false, error: "DATABASE_URL missing" };

  return NextResponse.json({
    ok: db.ok && isSupabaseConfigured(),
    service: "still",
    database: db.ok,
    auth: isSupabaseConfigured(),
    ai: env.AI_PROVIDER,
    email: env.EMAIL_PROVIDER,
    googleAuth: env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === "true",
  });
}
