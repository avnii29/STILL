import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AuthRequiredError } from "@/lib/auth";
import { logger } from "@/lib/logger";

export function jsonError(status: number, message: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

export function handleRouteError(error: unknown, context: string) {
  if (error instanceof AuthRequiredError) {
    return jsonError(401, "Sign in first.");
  }
  if (error instanceof ZodError) {
    return jsonError(400, "Invalid request", { issues: error.issues });
  }
  logger.error("route.error", {
    context,
    error: error instanceof Error ? error.message : "unknown",
  });
  return jsonError(500, "Something went wrong.");
}

export function clientIp(request: Request): string | undefined {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    undefined
  );
}
