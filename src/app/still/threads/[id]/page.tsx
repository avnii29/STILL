import type { Metadata } from "next";
import { GuestThreadView } from "@/components/guest/guest-thread";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Thread · STILL",
};

export default async function StillGuestThreadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <GuestThreadView id={id} />;
}
