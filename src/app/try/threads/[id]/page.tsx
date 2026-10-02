import type { Metadata } from "next";
import { GuestThreadView } from "@/components/guest/guest-thread";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Temporary thread · STILL",
};

export default async function GuestThreadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <GuestThreadView id={id} />;
}
