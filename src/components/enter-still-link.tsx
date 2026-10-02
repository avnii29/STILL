"use client";

import type { MouseEvent, ReactNode } from "react";
import { useRouter } from "next/navigation";

export function EnterStillLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  const router = useRouter();

  function onClick(event: MouseEvent<HTMLAnchorElement>) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    const story = Number(document.documentElement.style.getPropertyValue("--story") || sessionStorage.getItem("still-world-day") || 0);
    sessionStorage.setItem("still-world-day", Number.isFinite(story) ? String(story) : "0");
    document.documentElement.classList.add("still-entering");
    window.setTimeout(() => router.push(href), 420);
  }

  return (
    <a href={href} className={className} onClick={onClick}>
      {children}
    </a>
  );
}