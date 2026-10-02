import { NextResponse } from "next/server";
import { recordSignIn, requireApiUser } from "@/lib/auth";
import { handleRouteError, clientIp } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    await recordSignIn(user.id, clientIp(request));
    return NextResponse.json({
      ok: true,
      onboardingCompleted: Boolean(user.onboardingCompletedAt),
    });
  } catch (error) {
    return handleRouteError(error, "auth.signed_in");
  }
}
