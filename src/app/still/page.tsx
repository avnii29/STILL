import type { Metadata } from "next";
import { GuestWorkspace } from "@/components/guest/guest-workspace";
import { getAuthUser, getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "STILL",
  description: "Enter STILL. No account needed. Memories stay on this device until you keep them.",
};

export default async function StillGuestPage() {
  const authUser = await getAuthUser();
  const user = authUser ? await getCurrentUser().catch(() => null) : null;
  return (
    <GuestWorkspace
      signedIn={Boolean(authUser)}
      onboarded={Boolean(user?.onboardingCompletedAt)}
    />
  );
}
