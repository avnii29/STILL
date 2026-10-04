import type { ReactNode } from "react";
import { TimeLandscape } from "@/components/landscape";
import { GuestHeader } from "@/components/guest/guest-header";
import { getAuthUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function StillGuestLayout({ children }: { children: ReactNode }) {
  const user = await getAuthUser();
  return (
    <div className="relative min-h-dvh overflow-hidden still-guest-world">
      <TimeLandscape />
      <div className="relative z-10 flex min-h-dvh flex-col">
        <GuestHeader signedIn={Boolean(user)} />
        <main id="main" className="still-frame w-full flex-1 pb-20 pt-8">
          {children}
        </main>
      </div>
    </div>
  );
}
