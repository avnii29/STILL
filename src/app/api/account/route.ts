import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { handleRouteError } from "@/lib/http";
import { writeAuditLog } from "@/lib/audit";
import { getPrisma } from "@/lib/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isServiceRoleConfigured, isSupabaseConfigured } from "@/lib/env";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function DELETE() {
  try {
    const user = await requireApiUser();
    const prisma = getPrisma();

    await writeAuditLog({
      userId: user.id,
      action: "ACCOUNT_DELETED",
      target: "account",
      metadata: { deleting: true },
    });

    await prisma.auditLog.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });

    let authUserRemoved = false;
    if (isServiceRoleConfigured()) {
      const admin = createSupabaseAdminClient();
      const { error } = await admin.auth.admin.deleteUser(user.id);
      if (error) {
        logger.warn("account.auth_delete_failed", { error: error.message });
      } else {
        authUserRemoved = true;
      }
    }

    if (isSupabaseConfigured()) {
      const supabase = await createSupabaseServerClient();
      await supabase.auth.signOut();
    }

    return NextResponse.json({ ok: true, authUserRemoved });
  } catch (error) {
    return handleRouteError(error, "account.delete");
  }
}
