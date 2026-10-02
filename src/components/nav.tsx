"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, MessagesSquare, BookOpen, Settings, Search } from "lucide-react";
import { StillMark } from "@/components/still-mark";
import { cn } from "@/lib/utils";

const PRIMARY = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/threads", label: "Threads", icon: MessagesSquare },
  { href: "/memory", label: "Memory", icon: BookOpen },
  { href: "/settings", label: "Settings", icon: Settings },
];

const MORE = [
  { href: "/people", label: "People" },
  { href: "/noticed", label: "Noticed" },
  { href: "/integrations", label: "Sources" },
  { href: "/activity", label: "Activity" },
];

function isActive(pathname: string, href: string) {
  if (href === "/home") return pathname === "/home" || pathname === "/app";
  if (href === "/threads") return pathname.startsWith("/threads") || pathname.startsWith("/app/threads");
  if (href === "/memory") return pathname === "/memory" || pathname === "/app/memory";
  if (href === "/settings") return pathname.startsWith("/settings") || pathname.startsWith("/app/settings");
  if (href === "/integrations") {
    return pathname.startsWith("/integrations") || pathname.startsWith("/app/integrations");
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SideNav() {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 hidden h-dvh w-[220px] shrink-0 flex-col border-r border-line px-6 py-8 lg:flex">
      <StillMark href="/home" title="STILL" />
      <nav aria-label="Primary" className="mt-14 flex flex-col gap-1">
        {[...PRIMARY, ...MORE].map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-md px-3 py-2 text-[0.95rem] transition-colors",
                active ? "bg-accent-soft text-ink" : "text-ink-soft hover:bg-paper hover:text-ink",
              )}
              aria-current={active ? "page" : undefined}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/95 px-2 pb-safe pt-2 backdrop-blur lg:hidden"
    >
      <ul className="grid grid-cols-4">
        {PRIMARY.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "flex min-h-12 flex-col items-center justify-center gap-1 rounded-md text-[0.65rem] tracking-wide uppercase",
                  active ? "text-accent" : "text-ink-soft",
                )}
                aria-current={active ? "page" : undefined}
              >
                <Icon className="size-5" aria-hidden="true" />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function MobileTopBar() {
  return (
    <div className="flex items-center justify-between px-1 pb-6 lg:hidden">
      <StillMark href="/home" title="STILL" />
        <Link href="/app/search" className="inline-flex size-11 items-center justify-center text-ink-soft">
          <Search className="size-5" aria-hidden="true" />
          <span className="sr-only">Search</span>
        </Link>
    </div>
  );
}
