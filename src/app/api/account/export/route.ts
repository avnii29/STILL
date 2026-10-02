import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { handleRouteError } from "@/lib/http";
import { exportUserStill } from "@/lib/privacy/export";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireApiUser();
    const payload = await exportUserStill(user.id);
    await writeAuditLog({
      userId: user.id,
      action: "DATA_EXPORTED",
      target: "account",
    });
    return NextResponse.json(payload, {
      headers: {
        "Content-Disposition": "attachment; filename=\"still-export.json\"",
      },
    });
  } catch (error) {
    return handleRouteError(error, "account.export");
  }
}
