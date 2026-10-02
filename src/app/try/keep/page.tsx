import type { Metadata } from "next";
import { GuestKeepPage } from "@/components/guest/guest-keep-page";
import { getAuthUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Keep this · STILL",
};

export default async function KeepPage() {
  const user = await getAuthUser();
  return <GuestKeepPage signedIn={Boolean(user)} />;
}
