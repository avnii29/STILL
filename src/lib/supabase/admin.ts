import "server-only";

import { createClient } from "@supabase/supabase-js";
import { getServerEnv, isServiceRoleConfigured } from "@/lib/env";

export function createSupabaseAdminClient() {
  if (!isServiceRoleConfigured()) {
    throw new Error("Service role is not configured.");
  }
  const env = getServerEnv();
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
