import type { ReactNode } from "react";
import { BottomNav, MobileTopBar, SideNav } from "@/components/nav";
import { CaptureFab } from "@/components/capture-fab";
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
        <main id="still-main" className="mx-auto w-full max-w-5xl flex-1 px-5 pb-32 pt-6 sm:px-10 lg:pb-16 lg:pt-14">
          <MobileTopBar />
          {children}
        </main>
      </div>
      <BottomNav />
      <CaptureFab />
      <ThreadsRealtime userId={userId} />
    </div>
  );
}
