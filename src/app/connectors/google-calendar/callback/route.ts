import { NextResponse } from "next/server";
import { ensureAppUser, getAuthUser } from "@/lib/auth";
import {
  googleRedirectUri,
  readCalendarMetadata,
} from "@/lib/connectors/google-calendar";
import { connectGoogleCalendar, GoogleAuthExpiredError } from "@/lib/connectors/google-calendar-sync";
import { getAppUrl } from "@/lib/env";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const back = new URL("/integrations", getAppUrl());
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (url.searchParams.get("error") || !code || !state) {
    back.searchParams.set("calendar", "denied");
    return NextResponse.redirect(back);
  }

  const prisma = getPrisma();
  const account = await prisma.integrationAccount.findUnique({ where: { linkCode: state } });
  const authUser = await getAuthUser();
  if (!authUser) {
    const signIn = new URL("/auth/sign-in", getAppUrl());
    signIn.searchParams.set("next", "/integrations");
    return NextResponse.redirect(signIn);
  }
  const user = await ensureAppUser(authUser);
  if (!account || account.userId !== user.id || account.provider !== "CALENDAR") {
    back.searchParams.set("calendar", "denied");
    return NextResponse.redirect(back);
  }

  try {
    await connectGoogleCalendar({
      userId: user.id,
      code,
      redirectUri: googleRedirectUri(getAppUrl()),
      lookbackDays: readCalendarMetadata(account.metadata).lookbackDays ?? 7,
    });
    back.searchParams.set("calendar", "synced");
  } catch (error) {
    back.searchParams.set("calendar", error instanceof GoogleAuthExpiredError ? "expired" : "error");
    await prisma.integrationAccount.update({
      where: { id: account.id },
      data: {
        status: "ERROR",
        linkCode: null,
        lastError: error instanceof Error ? error.message : "Google Calendar failed.",
      },
    });
  }
  return NextResponse.redirect(back);
}
