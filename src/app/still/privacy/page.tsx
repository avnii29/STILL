import type { Metadata } from "next";
import { GuestPrivacy } from "@/components/guest/guest-privacy";
import { getServerEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Guest privacy · STILL",
};

export default function StillGuestPrivacyPage() {
  const env = getServerEnv();
  return <GuestPrivacy aiProvider={env.AI_PROVIDER ?? "none"} />;
}
