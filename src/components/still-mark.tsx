"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

export function StillMark({
  className,
  href = "/",
  wordmark = true,
  size = 36,
  title = "Still",
}: {
  className?: string;
  href?: string;
  wordmark?: boolean;
  size?: number;
  title?: string;
}) {
  return (
    <Link
      href={href}
      className={cn("inline-flex items-center gap-2.5 text-ink no-underline", className)}
    >
      <span
        className="relative shrink-0 overflow-hidden rounded-full bg-paper"
        style={{ width: size, height: size }}
      >
        {/* Plain img avoids next/image hydration mismatch inside client trees. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/still-mark.png"
          alt=""
          width={size}
          height={size}
          className="size-full object-cover"
          suppressHydrationWarning
        />
      </span>
      {wordmark ? (
        <span className="font-display text-2xl leading-none tracking-tight">{title}</span>
      ) : (
        <span className="sr-only">{title}</span>
      )}
    </Link>
  );
}
