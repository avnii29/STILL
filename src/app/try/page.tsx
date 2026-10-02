import type { Metadata } from "next";
import { GuestWorkspace } from "@/components/guest/guest-workspace";
import { getAuthUser, getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Try STILL",
  description: "A real temporary workspace. STILL understands what you said. Nothing is stored on our servers until you keep it.",
};

export default async function TryPage() {
  const authUser = await getAuthUser();
  const user = authUser ? await getCurrentUser().catch(() => null) : null;
  return (
    <GuestWorkspace
      signedIn={Boolean(authUser)}
      onboarded={Boolean(user?.onboardingCompletedAt)}
    />
  );
}
