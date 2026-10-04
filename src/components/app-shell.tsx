import type { ReactNode } from "react";
import { BottomNav, MobileTopBar, SideNav } from "@/components/nav";
import { CaptureFab } from "@/components/capture-fab";
import { LiveNotices } from "@/components/live-notices";
import { ThreadsRealtime } from "@/components/threads-realtime";

export function AppShell({
  children,
  userId,
  period = "afternoon",
}: {
  children: ReactNode;
  userId: string;
  period?: "morning" | "afternoon" | "evening" | "night";
}) {
  return (
    <div className="still-app flex min-h-dvh bg-bg" data-period={period}>
      <a href="#still-main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-paper focus:px-3 focus:py-2">
        Skip to content
      </a>
      <SideNav />
      <div className="flex min-w-0 flex-1 flex-col">
        <main id="still-main" className="w-full min-w-0 flex-1 px-[clamp(1.25rem,3.2vw,4rem)] pb-32 pt-6 lg:pb-16 lg:pt-14">
          <MobileTopBar />
          <LiveNotices />
          {children}
        </main>
      </div>
      <BottomNav />
      <CaptureFab />
      <ThreadsRealtime userId={userId} />
    </div>
  );
}
