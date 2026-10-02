"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { displayTitle } from "@/lib/guest/parse";
import { listMemories } from "@/lib/guest/store";
import type { GuestThread } from "@/lib/guest/types";

export function GuestMemory() {
  const [threads, setThreads] = useState<GuestThread[] | null>(null);

  useEffect(() => {
    void listMemories().then(setThreads);
  }, []);

  if (!threads) return <p className="label mt-16">memory</p>;

  const kept = threads.filter((item) => item.status !== "DISMISSED");

  return (
    <div className="mt-6">
      <p className="label">memory</p>
      <h1 className="mt-4 font-display text-[clamp(2.6rem,6vw,4.8rem)] leading-[0.95] tracking-tight">
        what stayed.
      </h1>
      {kept.length === 0 ? (
        <p className="mt-8 max-w-md text-lg text-ink-soft">
          Nothing is stored on this device yet. When you keep something, it waits here.
        </p>
      ) : (
        <ol className="mt-12">
          {kept.map((thread) => (
            <li key={thread.id} className="border-b border-line py-6">
              <Link href={`/still/threads/${thread.id}`} className="font-display text-3xl tracking-tight">
                {displayTitle(thread.title)}
              </Link>
              <p className="mt-2 text-sm text-ink-soft">
                {thread.status === "RESOLVED" ? "done" : "still here"}
                {thread.person ? ` · ${thread.person}` : ""}
              </p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
