import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { handleRouteError } from "@/lib/http";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const user = await requireApiUser();
    const prisma = getPrisma();
    await prisma.profile.update({
      where: { userId: user.id },
      data: { onboardingCompletedAt: new Date() },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error, "onboarding.complete");
  }
}
