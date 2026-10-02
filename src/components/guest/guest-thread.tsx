"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { KeepThis } from "@/components/guest/keep-this";
import { StatusChip } from "@/components/status-chip";
import { formatQuietDateLong, sourceDisplayName } from "@/lib/copy";
import { displayTitle } from "@/lib/guest/parse";
import { deleteMemory, listMemories, updateMemory } from "@/lib/guest/store";
import type { GuestThread } from "@/lib/guest/types";

export function GuestThreadView({ id }: { id: string }) {
  const router = useRouter();
  const [thread, setThread] = useState<GuestThread | null>(null);
  const [missing, setMissing] = useState(false);
  const [when, setWhen] = useState("");
  const [moment, setMoment] = useState<"reminder" | "sync" | null>(null);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const panelId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    void (async () => {
      const found = (await listMemories()).find((item) => item.id === id && item.status !== "DISMISSED");
      if (!found) {
        setMissing(true);
        return;
      }
      setThread(found);
    })();
  }, [id]);

  useEffect(() => {
    if (!evidenceOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setEvidenceOpen(false);
        buttonRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [evidenceOpen]);

  if (missing) {
    return (
      <div className="mt-10">
        <p className="font-display text-4xl tracking-tight">This thread is no longer here.</p>
        <Link href="/still" className="mt-8 inline-flex min-h-12 items-center text-sm">
          Back to today
        </Link>
      </div>
    );
  }

  if (!thread) {
    return <p className="label mt-16">opening thread</p>;
  }

  return (
    <div className="mt-4">
      <Link href="/still" className="text-sm text-ink-soft">
        today
      </Link>
      <p className="label mt-10">{thread.person ?? "Future you"}</p>
      <h1 className="mt-4 max-w-3xl font-display text-[clamp(2.6rem,6vw,5.4rem)] leading-[0.95] tracking-tight">
        {displayTitle(thread.title)}
      </h1>
      <p className="mt-5 flex flex-wrap items-center gap-3 text-sm text-ink-soft">
        <StatusChip
          status={thread.status === "RESOLVED" ? "RESOLVED" : thread.status === "POSTPONED" ? "POSTPONED" : "OPEN"}
        />
        {thread.dueAt ? <span>due {formatQuietDateLong(thread.dueAt)}</span> : null}
      </p>

      <ol className="mt-12 max-w-2xl space-y-8">
        <li>
          <p className="label">You said</p>
          <blockquote className="mt-3 border-l border-accent/40 pl-4 text-lg leading-relaxed">
            “{thread.evidence}”
          </blockquote>
        </li>
        <li>
          <p className="label">Remembered</p>
          <p className="mt-3 font-display text-3xl tracking-tight">{displayTitle(thread.title)}</p>
        </li>
        <li>
          <p className="label">When</p>
          <p className="mt-3 text-lg text-ink-soft">
            {thread.deadline ?? (thread.dueAt ? formatQuietDateLong(thread.dueAt) : "No time named yet.")}
          </p>
        </li>
        <li>
          <p className="label">Where it came from</p>
          <p className="mt-3 text-lg text-ink-soft">{sourceDisplayName(thread.sourceKind)} · this device</p>
        </li>
      </ol>

      {thread.status !== "RESOLVED" ? (
        <>
          <form
            className="mt-12 max-w-md"
            onSubmit={(event) => {
              event.preventDefault();
              if (!when) return;
              const dueAt = new Date(when).toISOString();
              void updateMemory(id, {
                status: "POSTPONED",
                dueAt,
                postponedUntil: dueAt,
                deadline: "postponed",
              }).then((next) => {
                if (next) setThread(next);
              });
            }}
          >
            <label className="flex flex-col gap-2 text-sm text-ink-soft" htmlFor="guest-when">
              When instead?
              <input
                id="guest-when"
                type="datetime-local"
                value={when}
                onChange={(event) => setWhen(event.target.value)}
                className="min-h-12 rounded-md border border-line bg-paper/85 px-3 text-ink"
              />
            </label>
            <button type="submit" className="mt-4 min-h-12 rounded-md border border-line px-5 text-sm">
              Postpone here
            </button>
          </form>
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => {
                void updateMemory(id, { status: "RESOLVED", resolvedAt: new Date().toISOString() }).then((next) => {
                  if (next) setThread(next);
                });
              }}
              className="min-h-12 rounded-md bg-ink px-5 text-sm text-paper"
            >
              Resolve
            </button>
            <button type="button" onClick={() => setMoment("reminder")} className="min-h-12 px-4 text-sm">
              Remind me
            </button>
            <button
              type="button"
              onClick={() => {
                void deleteMemory(id).then(() => router.push("/still"));
              }}
              className="min-h-12 px-4 text-sm text-ink-soft"
            >
              Let go
            </button>
          </div>
        </>
      ) : (
        <p className="mt-12 font-display text-3xl tracking-tight">done.</p>
      )}

      <section className="mt-16 max-w-2xl border-t border-line pt-8">
        <button
          ref={buttonRef}
          type="button"
          className="text-left text-sm text-ink-soft"
          onClick={() => setEvidenceOpen((value) => !value)}
          aria-expanded={evidenceOpen}
          aria-controls={panelId}
        >
          Why did STILL remember this?
        </button>
        {evidenceOpen ? (
          <div id={panelId} className="mt-6 space-y-4 text-base leading-relaxed text-ink-soft">
            <p className="label">You said</p>
            <blockquote className="border-l border-accent/40 pl-4 text-ink">“{thread.evidence}”</blockquote>
            <p className="label">STILL kept</p>
            <p>
              {displayTitle(thread.title)}
              {thread.person ? ` · ${thread.person}` : ""}
              {thread.deadline ? ` · ${thread.deadline}` : ""}
            </p>
            <p className="text-sm">
              This reading came from wording patterns on the STILL server. The thread itself stays on
              this device until you choose to keep it.
            </p>
          </div>
        ) : null}
      </section>

      {moment === "reminder" ? <KeepThis reason="reminder" onDismiss={() => setMoment(null)} /> : null}
      {moment === "sync" ? <KeepThis reason="sync" onDismiss={() => setMoment(null)} /> : null}
    </div>
  );
}
