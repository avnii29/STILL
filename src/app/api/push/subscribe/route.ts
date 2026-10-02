import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { handleRouteError } from "@/lib/http";
import { getPrisma } from "@/lib/prisma";
import { pushSubscriptionSchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    const body = pushSubscriptionSchema.parse(await request.json());
    const prisma = getPrisma();
    await prisma.pushSubscription.upsert({
      where: { endpoint: body.endpoint },
      update: {
        p256dh: body.keys.p256dh,
        auth: body.keys.auth,
        userAgent: request.headers.get("user-agent"),
      },
      create: {
        userId: user.id,
        endpoint: body.endpoint,
        p256dh: body.keys.p256dh,
        auth: body.keys.auth,
        userAgent: request.headers.get("user-agent"),
      },
    });
    await prisma.userPreference.update({
      where: { userId: user.id },
      data: { webPushEnabled: true },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error, "push.subscribe");
  }
}
