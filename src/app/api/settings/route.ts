import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { handleRouteError } from "@/lib/http";
import { getPrisma } from "@/lib/prisma";
import {
  memoryPolicySchema,
  preferenceUpdateSchema,
  profileUpdateSchema,
  retentionPolicySchema,
} from "@/lib/validation/schemas";
import { writeAuditLog } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  try {
    const user = await requireApiUser();
    const payload = await request.json();
    const prisma = getPrisma();

    if ("displayName" in payload || "timezone" in payload) {
      const body = profileUpdateSchema.parse({
        displayName: payload.displayName,
        timezone: payload.timezone,
      });
      await prisma.profile.update({
        where: { userId: user.id },
        data: {
          ...(body.displayName ? { displayName: body.displayName } : {}),
          ...(body.timezone ? { timezone: body.timezone } : {}),
        },
      });
      await writeAuditLog({
        userId: user.id,
        action: "PROFILE_UPDATE",
        target: "profile",
      });
    }

    if ("emailNotifications" in payload || "webPushEnabled" in payload) {
      const body = preferenceUpdateSchema.parse({
        emailNotifications: payload.emailNotifications,
        webPushEnabled: payload.webPushEnabled,
        followUpDays: payload.followUpDays,
      });
      await prisma.userPreference.update({
        where: { userId: user.id },
        data: {
          emailNotifications: body.emailNotifications,
          webPushEnabled: body.webPushEnabled,
          followUpDays: body.followUpDays,
        },
      });
    }

    if ("rememberReminders" in payload || "autoRememberClear" in payload) {
      const body = memoryPolicySchema.parse({
        rememberReminders: payload.rememberReminders,
        rememberCommitments: payload.rememberCommitments,
        rememberPossible: payload.rememberPossible,
        rememberDeadlines: payload.rememberDeadlines,
        rememberResolution: payload.rememberResolution,
        rememberContext: payload.rememberContext,
        autoRememberClear: payload.autoRememberClear,
      });
      await prisma.userPreference.update({
        where: { userId: user.id },
        data: body,
      });
    }

    if ("conversationRetention" in payload) {
      const body = retentionPolicySchema.parse({
        conversationRetention: payload.conversationRetention,
      });
      await prisma.userPreference.update({
        where: { userId: user.id },
        data: { conversationRetention: body.conversationRetention },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error, "settings");
  }
}
