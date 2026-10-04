import "server-only";

import { getAppUrl } from "@/lib/env";

export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function requestOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && sameOrigin(request)) return origin;
  return getAppUrl();
}
