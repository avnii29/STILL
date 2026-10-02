import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { writeAuditLog } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function POST() {
  if (isSupabaseConfigured()) {
    const user = await getCurrentUser();
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
    if (user) {
      await writeAuditLog({
        userId: user.id,
        action: "AUTH_SIGN_OUT",
        target: "session",
      });
    }
  }
  return NextResponse.json({ ok: true });
}
