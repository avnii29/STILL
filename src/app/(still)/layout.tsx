import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { dayPeriod } from "@/config/operator";
import { requireOnboardedUser } from "@/lib/auth";
import { hourInTimezone } from "@/lib/copy";

export const dynamic = "force-dynamic";

export default async function StillLayout({ children }: { children: ReactNode }) {
  const user = await requireOnboardedUser();
  return (
    <AppShell userId={user.id} period={dayPeriod(hourInTimezone(user.timezone))}>
      {children}
    </AppShell>
  );
}
