import { NextResponse } from "next/server";
import { z } from "zod";
import { runDemoStage } from "@/lib/demo/scenario";
import { handleRouteError, jsonError } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  stage: z.enum(["capture", "forward", "followup", "approve"]),
});

export async function POST(request: Request) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "demo";
    const limited = rateLimit(`demo:${ip}`, 30, 10 * 60 * 1000);
    if (!limited.allowed) return jsonError(429, "Give STILL a moment.");
    const body = bodySchema.parse(await request.json());
    return NextResponse.json(runDemoStage(body.stage));
  } catch (error) {
    return handleRouteError(error, "demo.run");
  }
}
