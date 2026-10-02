import type { Metadata } from "next";
import { GuestMemory } from "@/components/guest/guest-memory";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Memory · STILL",
};

export default function StillMemoryPage() {
  return <GuestMemory />;
}
