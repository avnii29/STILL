"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { displayTitle } from "@/lib/guest/parse";
import { liveThreads } from "@/lib/guest/relate";
import { leaveGuestThreadsHere, migrateSelectedGuestThreads } from "@/lib/guest/client";
import { listMemories } from "@/lib/guest/store";
import type { GuestThread } from "@/lib/guest/types";

export function GuestKeepPage({ signedIn }: { signedIn: boolean }) {
  const router = useRouter();
  const [threads, setThreads] = useState<GuestThread[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [choosing, setChoosing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      const live = liveThreads(await listMemories());
      setThreads(live);
      setSelected(live.map((item) => item.id));
      if (!signedIn && live.length === 0) router.replace("/still");
    })();
  }, [router, signedIn]);

  if (!signedIn) {
    return (
      <div className="mt-10 max-w-xl">
        <p className="label">Your threads are currently staying on this device.</p>
        <h1 className="mt-4 font-display text-[clamp(2.4rem,6vw,4rem)] leading-[0.95] tracking-tight">
          keep what matters.
        </h1>
        <p className="mt-5 text-lg text-ink-soft">Sign in to carry them with you.</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <a
            href="/auth/sign-up?next=%2Fstill%2Fkeep"
            className="inline-flex min-h-12 items-center rounded-md bg-ink px-5 text-sm text-paper"
          >
            Continue with email
          </a>
          <a href="/auth/sign-in?next=%2Fstill%2Fkeep" className="inline-flex min-h-12 items-center px-4 text-sm">
            Sign in
          </a>
          <a href="/still" className="inline-flex min-h-12 items-center px-4 text-sm text-ink-soft">
            Not now
          </a>
        </div>
      </div>
    );
  }

  if (threads.length === 0) {
    return (
      <div className="mt-16">
        <p className="font-display text-4xl tracking-tight">Nothing here to bring.</p>
        <a href="/home" className="mt-8 inline-flex min-h-12 items-center text-sm">
          Open STILL
        </a>
      </div>
    );
  }

  async function migrate(items: GuestThread[]) {
    setBusy(true);
    setMessage(null);
    const result = await migrateSelectedGuestThreads(items);
    setBusy(false);
    if (!result.ok) {
      setMessage(result.error);
      return;
    }
    router.replace(result.threadIds[0] ? `/threads/${result.threadIds[0]}` : "/home");
    router.refresh();
  }

  return (
    <div className="mt-8 max-w-xl">
      <p className="label">Bring your guest threads into your STILL?</p>
      <h1 className="mt-4 font-display text-[clamp(2.4rem,6vw,4.2rem)] leading-[0.95] tracking-tight">
        We found {threads.length} thing{threads.length === 1 ? "" : "s"} you were carrying.
      </h1>
      <p className="mt-5 text-ink-soft">Only what you choose will be uploaded. Nothing moves until you say so.</p>
      <ul className="mt-10 space-y-4">
        {threads.map((thread) => (
          <li key={thread.id} className="border-b border-line py-4">
            {choosing ? (
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={selected.includes(thread.id)}
                  onChange={() => {
                    setSelected((current) =>
                      current.includes(thread.id)
                        ? current.filter((id) => id !== thread.id)
                        : [...current, thread.id],
                    );
                  }}
                  className="mt-2"
                />
                <span>
                  <span className="block font-display text-2xl tracking-tight">{displayTitle(thread.title)}</span>
                  <span className="mt-1 block text-sm text-ink-soft">{thread.evidence}</span>
                </span>
              </label>
            ) : (
              <>
                <p className="font-display text-2xl tracking-tight">{displayTitle(thread.title)}</p>
                <p className="mt-1 text-sm text-ink-soft">{thread.evidence}</p>
              </>
            )}
          </li>
        ))}
      </ul>
      <div className="mt-10 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => void migrate(threads)}
          className="min-h-12 rounded-md bg-ink px-5 text-sm text-paper disabled:opacity-60"
        >
          Bring them with me
        </button>
        {choosing ? (
          <button
            type="button"
            disabled={busy || selected.length === 0}
            onClick={() => void migrate(threads.filter((item) => selected.includes(item.id)))}
            className="min-h-12 rounded-md border border-line px-5 text-sm disabled:opacity-60"
          >
            Bring the selected
          </button>
        ) : (
          <button type="button" onClick={() => setChoosing(true)} className="min-h-12 px-4 text-sm">
            Choose individually
          </button>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            void leaveGuestThreadsHere().then(() => {
              router.replace("/home");
              router.refresh();
            });
          }}
          className="min-h-12 px-4 text-sm text-ink-soft"
        >
          Leave them here
        </button>
      </div>
      {message ? (
        <p className="mt-6 text-sm text-ink-soft" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
