"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function CaptureFab() {
  const pathname = usePathname();
  if (pathname.startsWith("/app/capture") || pathname.startsWith("/capture")) return null;
  return (
    <Link
      href="/capture"
      className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] right-5 z-50 flex size-14 items-center justify-center rounded-full bg-ink text-2xl text-paper shadow-[var(--shadow)] lg:bottom-8 lg:right-10"
      aria-label="Remember something"
    >
      +
    </Link>
  );
}
