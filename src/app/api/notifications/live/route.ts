import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { handleRouteError } from "@/lib/http";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireApiUser();
    const prisma = getPrisma();
    const since = new Date(Date.now() - 10 * 60 * 1000);
    const notifications = await prisma.notification.findMany({
      where: {
        userId: user.id,
        channel: "IN_APP",
        status: "SENT",
        createdAt: { gte: since },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, title: true, body: true, href: true, createdAt: true },
    });
    return NextResponse.json({
      notifications: notifications.map((item) => ({
        ...item,
        createdAt: item.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    return handleRouteError(error, "notifications.live");
  }
}
