import "server-only";

import type { User as AuthUser } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { getPrisma } from "@/lib/prisma";
import { isDatabaseConfigured, isSupabaseConfigured } from "@/lib/env";
import { logger } from "@/lib/logger";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { writeAuditLog } from "@/lib/audit";

export type AppUser = {
  id: string;
  email: string;
  displayName: string | null;
  timezone: string;
  onboardingCompletedAt: Date | null;
  emailNotifications: boolean;
  webPushEnabled: boolean;
};

export async function getAuthUser(): Promise<AuthUser | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    logger.warn("auth.getUser.failed", { error: error.message });
    return null;
  }
  return data.user;
}

export async function ensureAppUser(authUser: AuthUser): Promise<AppUser> {
  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL is required.");
  }
  const prisma = getPrisma();
  const email = authUser.email;
  if (!email) {
    throw new Error("Authenticated user has no email.");
  }

  const user = await prisma.user.upsert({
    where: { id: authUser.id },
    update: { email },
    create: {
      id: authUser.id,
      email,
      profile: {
        create: {
          displayName: authUser.user_metadata?.full_name ?? email.split("@")[0],
          timezone: "UTC",
        },
      },
      preference: {
        create: {},
      },
    },
    include: { profile: true, preference: true },
  });

  if (!user.profile) {
    await prisma.profile.create({
      data: {
        userId: user.id,
        displayName: email.split("@")[0],
      },
    });
  }
  if (!user.preference) {
    await prisma.userPreference.create({ data: { userId: user.id } });
  }

  const fresh = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    include: { profile: true, preference: true },
  });

  return {
    id: fresh.id,
    email: fresh.email,
    displayName: fresh.profile?.displayName ?? null,
    timezone: fresh.profile?.timezone ?? "UTC",
    onboardingCompletedAt: fresh.profile?.onboardingCompletedAt ?? null,
    emailNotifications: fresh.preference?.emailNotifications ?? true,
    webPushEnabled: fresh.preference?.webPushEnabled ?? false,
  };
}

export async function loadAppUserById(userId: string): Promise<AppUser | null> {
  if (!isDatabaseConfigured()) return null;
  const prisma = getPrisma();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { profile: true, preference: true },
  });
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    displayName: user.profile?.displayName ?? null,
    timezone: user.profile?.timezone ?? "UTC",
    onboardingCompletedAt: user.profile?.onboardingCompletedAt ?? null,
    emailNotifications: user.preference?.emailNotifications ?? true,
    webPushEnabled: user.preference?.webPushEnabled ?? false,
  };
}

export async function getCurrentUser(): Promise<AppUser | null> {
  const authUser = await getAuthUser();
  if (!authUser) return null;
  return ensureAppUser(authUser);
}

export class AuthRequiredError extends Error {
  constructor() {
    super("AUTH_REQUIRED");
    this.name = "AuthRequiredError";
  }
}

export async function requireUser(): Promise<AppUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/auth/sign-in");
  }
  return user;
}

export async function requireApiUser(): Promise<AppUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthRequiredError();
  return user;
}

export async function requireOnboardedUser(): Promise<AppUser> {
  const user = await requireUser();
  if (!user.onboardingCompletedAt) {
    redirect("/onboarding");
  }
  return user;
}

export async function recordSignIn(userId: string, ip?: string) {
  await writeAuditLog({
    userId,
    action: "AUTH_SIGN_IN",
    target: "session",
    ip,
  });
}
