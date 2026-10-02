import { NextResponse } from "next/server";
import { getServerEnv, isDatabaseConfigured } from "@/lib/env";
import { handleRouteError, jsonError } from "@/lib/http";
import { processDueReminders } from "@/lib/threads/reminders";

export const dynamic = "force-dynamic";

function authorized(request: Request) {
  const env = getServerEnv();
  const secret = env.CRON_SECRET;
  if (!secret) return env.NODE_ENV !== "production";
  const header = request.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  try {
    if (!authorized(request)) return jsonError(401, "Still could not run that.");
    if (!isDatabaseConfigured()) {
      return jsonError(503, "I couldn't reach that source.\n\nNothing was changed.");
    }
    const result = await processDueReminders();
    return NextResponse.json(result);
  } catch (error) {
    return handleRouteError(error, "cron.reminders");
  }
}

export async function POST(request: Request) {
  return GET(request);
}
