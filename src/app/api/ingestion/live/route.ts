import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { handleRouteError } from "@/lib/http";
import { loadLiveNow } from "@/lib/ingestion/live";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireApiUser();
    return NextResponse.json(await loadLiveNow(user.id));
  } catch (error) {
    return handleRouteError(error, "ingestion.live");
  }
}
