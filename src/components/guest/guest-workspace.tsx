"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { GuestReveal } from "@/components/guest/guest-reveal";
import { KeepThis } from "@/components/guest/keep-this";
import type { Extraction } from "@/lib/agents/extract";
import { greetingForHour, formatQuietDate } from "@/lib/copy";
import { findConnectedThread, liveThreads, shouldOfferLongTermKeep } from "@/lib/guest/relate";
import { displayTitle, threadFromExtraction } from "@/lib/guest/parse";
import {
  clearGuestDraft,
  createMemory,
  listMemories,
  openGuestStore,
  readGuestDraft,
  storageMode,
  updateMemory,
  type GuestStorageMode,
  type GuestThread,
} from "@/lib/guest/store";
import { shouldPreviewMigration } from "@/lib/guest/client";

type Mode = "TEXT" | "VOICE" | "PASTE";
type Phase = "welcome" | "returning" | "compose" | "found" | "connected" | "home" | "mic";

function needsYouNow(thread: GuestThread, now: Date) {
  if (thread.status === "RESOLVED") return false;
  if (!thread.dueAt) return thread.status === "OPEN";
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  return new Date(thread.dueAt).getTime() <= end.getTime();
}

export function GuestWorkspace({
  signedIn,
  onboarded,
}: {
  signedIn: boolean;
  onboarded: boolean;
}) {
  const router = useRouter();
  const [threads, setThreads] = useState<GuestThread[]>([]);
  const [mode, setMode] = useState<GuestStorageMode>("none");
  const [phase, setPhase] = useState<Phase>("welcome");
  const [inputMode, setInputMode] = useState<Mode>("TEXT");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [extraction, setExtraction] = useState<Extraction | null>(null);
  const [connected, setConnected] = useState<{ thread: GuestThread; kind: "update" | "resolve" } | null>(null);
  const [keepReason, setKeepReason] = useState<"long-term" | "sync" | null>(null);

  useEffect(() => {
    void (async () => {
      await openGuestStore();
      setMode(await storageMode());
      const all = await listMemories();
      const live = liveThreads(all);
      setThreads(all);
      if (signedIn && (await shouldPreviewMigration())) {
        router.replace("/still/keep");
        return;
      }
      if (signedIn && onboarded) {
        router.replace("/home");
        return;
      }
      if (signedIn) {
        router.replace("/onboarding");
        return;
      }
      const draft = await readGuestDraft();
      if (draft) {
        setNote(draft.note);
        if (draft.extraction) {
          setExtraction(draft.extraction);
          setPhase("found");
        } else {
          setPhase("compose");
        }
        await clearGuestDraft();
        return;
      }
      if (live.length > 0) {
        setPhase("returning");
      } else {
        setPhase("welcome");
      }
    })();
  }, [onboarded, router, signedIn]);

  useEffect(() => {
    if (phase !== "compose" || inputMode !== "VOICE") return;
    type Recog = {
      lang: string;
      interimResults: boolean;
      start: () => void;
      stop: () => void;
      onstart: (() => void) | null;
      onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript?: string }>> }) => void) | null;
      onerror: (() => void) | null;
      onend: (() => void) | null;
    };
    const host = window as unknown as {
      SpeechRecognition?: new () => Recog;
      webkitSpeechRecognition?: new () => Recog;
    };
    const SpeechRecognition = host.SpeechRecognition ?? host.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setMessage("This browser cannot listen. Type instead. Audio was not stored.");
      setInputMode("TEXT");
      return;
    }
    const instance = new SpeechRecognition();
    instance.lang = navigator.language || "en-US";
    instance.interimResults = true;
    instance.onresult = (event) => {
      setNote(
        Array.from(event.results)
          .map((result) => result[0]?.transcript ?? "")
          .join(" "),
      );
    };
    instance.onerror = () => {
      setListening(false);
      setMessage("Listening stopped. Audio was not stored.");
    };
    instance.onend = () => setListening(false);
    instance.onstart = () => setListening(true);
    try {
      instance.start();
    } catch {
      setInputMode("TEXT");
    }
    return () => {
      try {
        instance.stop();
      } catch {
        /* already stopped */
      }
    };
  }, [inputMode, phase]);

  const open = liveThreads(threads);

  async function refresh() {
    setThreads(await listMemories());
  }

  async function look(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    const response = await fetch("/api/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note }),
    });
    const payload = (await response.json()) as {
      error?: string;
      extraction?: Extraction;
      limit?: string;
    };
    setBusy(false);
    if (response.status === 429 && payload.limit === "daily") {
      setMessage(payload.error ?? "You've reached today's guest processing limit. Your existing threads are still here.");
      return;
    }
    if (!response.ok || !payload.extraction) {
      setMessage(payload.error ?? "I couldn't understand this yet.\n\nNothing was stored.\n\nTry again.");
      return;
    }
    const link = findConnectedThread(note, payload.extraction, threads);
    setExtraction(payload.extraction);
    if (link) {
      setConnected(link);
      setPhase("connected");
      return;
    }
    setPhase("found");
  }

  async function keepNew() {
    if (!extraction) return;
    await createMemory(threadFromExtraction(note, extraction, inputMode));
    setExtraction(null);
    setNote("");
    await refresh();
    setPhase("home");
  }

  async function updateConnected() {
    if (!connected || !extraction) return;
    await updateMemory(connected.thread.id, {
      note,
      title: extraction.normalized_commitment || connected.thread.title,
      person: extraction.person ?? connected.thread.person,
      deadline: extraction.deadline ?? connected.thread.deadline,
      dueAt: extraction.due_at ?? connected.thread.dueAt,
      evidence: extraction.evidence || note,
    });
    setConnected(null);
    setExtraction(null);
    setNote("");
    await refresh();
    setPhase("home");
  }

  async function resolveConnected() {
    if (!connected) return;
    await updateMemory(connected.thread.id, {
      status: "RESOLVED",
      resolvedAt: new Date().toISOString(),
    });
    setConnected(null);
    setExtraction(null);
    setNote("");
    await refresh();
    setPhase("home");
  }

  const storageNote =
    mode === "memory" ? (
      <p className="mt-8 max-w-md text-sm text-ink-soft">
        This browser isn&apos;t allowing STILL to keep local memory reliably. You can continue for this
        session.
      </p>
    ) : null;

  if (phase === "mic") {
    return (
      <div className="mt-10 max-w-md">
        <h2 className="font-display text-4xl tracking-tight">Use your microphone?</h2>
        <p className="mt-5 text-lg text-ink-soft">
          STILL will listen so you can say something you want remembered. Audio is not stored. The
          words that appear are sent to STILL&apos;s server so the same detector can run.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => {
              setInputMode("VOICE");
              setPhase("compose");
            }}
            className="min-h-12 rounded-md bg-ink px-5 text-sm text-paper"
          >
            Use the microphone
          </button>
          <button
            type="button"
            onClick={() => {
              setInputMode("TEXT");
              setPhase("compose");
            }}
            className="min-h-12 px-4 text-sm"
          >
            Type instead
          </button>
        </div>
      </div>
    );
  }

  if (phase === "connected" && connected && extraction) {
    return (
      <div className="mt-8 max-w-xl">
        <p className="label">This sounds connected.</p>
        <h2 className="mt-4 font-display text-[clamp(2.2rem,6vw,4rem)] leading-[0.95] tracking-tight">
          {displayTitle(connected.thread.title)}
        </h2>
        {connected.kind === "update" ? (
          <p className="mt-6 font-display text-3xl tracking-tight text-ink-soft">
            {connected.thread.deadline ?? "when you said"}
            <span className="mx-3 text-ink">→</span>
            {extraction.deadline ?? "a new time"}
          </p>
        ) : (
          <p className="mt-6 text-lg text-ink-soft">Did this close something?</p>
        )}
        <p className="mt-8 text-ink-soft">{note}</p>
        <div className="mt-10 flex flex-wrap gap-3">
          {connected.kind === "update" ? (
            <>
              <button
                type="button"
                onClick={() => void updateConnected()}
                className="min-h-12 rounded-md bg-ink px-5 text-sm text-paper"
              >
                Update thread
              </button>
              <button type="button" onClick={() => void keepNew()} className="min-h-12 px-4 text-sm">
                Keep separate
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => void resolveConnected()}
                className="min-h-12 rounded-md bg-ink px-5 text-sm text-paper"
              >
                Yes, done
              </button>
              <button type="button" onClick={() => void keepNew()} className="min-h-12 px-4 text-sm">
                No
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => {
              setConnected(null);
              setExtraction(null);
              setNote("");
              setPhase(open.length > 0 ? "home" : "welcome");
            }}
            className="min-h-12 px-4 text-sm text-ink-soft"
          >
            Neither
          </button>
        </div>
      </div>
    );
  }

  if (phase === "found" && extraction) {
    return (
      <div className="mt-8">
        <GuestReveal
          extraction={extraction}
          original={note}
          busy={busy}
          message={message}
          onKeep={() => void keepNew()}
          onEdit={() => {
            setExtraction(null);
            setPhase("compose");
          }}
          onDismiss={() => {
            setExtraction(null);
            setNote("");
            setPhase(open.length > 0 ? "home" : "welcome");
          }}
        />
      </div>
    );
  }

  if (phase === "compose") {
    return (
      <form onSubmit={(event) => void look(event)} className="mt-8 max-w-xl">
        <label className="flex flex-col gap-3 text-sm text-ink-soft" htmlFor="still-guest-note">
          Something you said you&apos;d do...
          <textarea
            id="still-guest-note"
            required
            minLength={8}
            maxLength={4000}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={inputMode === "PASTE" ? 8 : 5}
            placeholder={'I\'ll send the application tomorrow.'}
            className="rounded-md border border-line bg-paper/85 px-3 py-3 text-lg text-ink"
          />
        </label>
        <p className="mt-2 text-sm text-ink-soft">The placeholder is only an example. It is not saved.</p>
        {inputMode === "VOICE" ? (
          <p className="mt-3 text-sm text-ink-soft">
            {listening ? "Listening. Audio is not stored." : "Speak, then remember."}
          </p>
        ) : null}
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={busy}
            className="min-h-12 rounded-md bg-ink px-5 text-sm text-paper disabled:opacity-60"
          >
            Remember
          </button>
          {open.length > 0 ? (
            <button type="button" onClick={() => setPhase("home")} className="min-h-12 px-4 text-sm">
              Back to today
            </button>
          ) : null}
        </div>
        {message ? (
          <p className="mt-6 whitespace-pre-wrap text-sm text-ink-soft" role="status" aria-live="polite">
            {message}
          </p>
        ) : null}
        {storageNote}
      </form>
    );
  }

  if (phase === "home" && open.length > 0) {
    const now = new Date();
    const hour = now.getHours();
    const needs = open.filter((thread) => needsYouNow(thread, now));
    const waiting = open.filter((thread) => !needsYouNow(thread, now));
    return (
      <div className="mt-4">
        <p className="label">today.</p>
        <h1 className="mt-4 font-display text-[clamp(2.8rem,7vw,5.4rem)] leading-[0.9] tracking-tight">
          {greetingForHour(hour)}
        </h1>
        {needs.length > 0 ? (
          <section className="mt-14">
            <ol>
              {needs.map((thread) => (
                <li key={thread.id} className="border-b border-line py-8">
                  <a
                    href={`/still/threads/${thread.id}`}
                    className="thread-need block font-display leading-[1.05] tracking-tight"
                  >
                    {displayTitle(thread.title)}
                  </a>
                  <p className="mt-3 text-sm text-ink-soft">
                    {thread.deadline ?? (thread.dueAt ? formatQuietDate(thread.dueAt) : "when you said")}
                  </p>
                  <div className="still-thread-line mt-6" />
                </li>
              ))}
            </ol>
          </section>
        ) : null}
        {waiting.length > 0 ? (
          <section className={needs.length > 0 ? "mt-16" : "mt-14"}>
            <ol>
              {waiting.map((thread) => (
                <li key={thread.id} className="border-b border-line py-6">
                  <a
                    href={`/still/threads/${thread.id}`}
                    className="thread-wait block font-display leading-tight tracking-tight"
                  >
                    {displayTitle(thread.title)}
                  </a>
                  <p className="mt-2 text-sm text-ink-soft">
                    {thread.deadline ?? (thread.dueAt ? formatQuietDate(thread.dueAt) : "")}
                  </p>
                </li>
              ))}
            </ol>
          </section>
        ) : null}
        <button
          type="button"
          onClick={() => {
            setNote("");
            setPhase("compose");
          }}
          className="mt-12 min-h-12 rounded-md border border-line px-5 text-sm"
        >
          Remember something else
        </button>
        <button
          type="button"
          onClick={() => setKeepReason("sync")}
          className="mt-4 block min-h-11 text-sm text-ink-soft"
        >
          Keep this on my phone too
        </button>
        {keepReason === "sync" ? <KeepThis reason="sync" onDismiss={() => setKeepReason(null)} /> : null}
        {shouldOfferLongTermKeep(threads) && keepReason !== "sync" ? (
          <KeepThis reason="long-term" onDismiss={() => setKeepReason(null)} />
        ) : null}
        {storageNote}
      </div>
    );
  }

  if (phase === "returning" && open.length > 0) {
    return (
      <div className="guest-enter mt-10">
        <p className="guest-enter-still font-display text-5xl tracking-tight">welcome back.</p>
        <p className="guest-enter-ask mt-6 font-display text-[clamp(2rem,5vw,3.4rem)] tracking-tight">
          {open.length === 1 ? "1 thing is still here." : `${open.length} things are still here.`}
        </p>
        <div className="guest-enter-actions mt-10 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setPhase("home")}
            className="min-h-12 rounded-md bg-ink px-5 text-sm text-paper"
          >
            Open today
          </button>
          <button
            type="button"
            onClick={() => setPhase("compose")}
            className="min-h-12 px-4 text-sm"
          >
            Remember something else
          </button>
        </div>
        {storageNote}
      </div>
    );
  }

  return (
    <div className="guest-enter mt-10">
      <p className="guest-enter-still font-display text-6xl tracking-tight">STILL</p>
      <h1 className="guest-enter-ask mt-10 font-display text-[clamp(2.4rem,6vw,4.4rem)] leading-[0.95] tracking-tight">
        what are you still carrying?
      </h1>
      <p className="guest-enter-ask mt-5 max-w-md text-lg text-ink-soft">
        Tell me something you said you&apos;d do.
      </p>
      <div className="guest-enter-actions mt-10 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => {
            setInputMode("TEXT");
            setPhase("compose");
          }}
          className="min-h-12 rounded-md bg-ink px-5 text-sm text-paper"
        >
          Type
        </button>
        <button type="button" onClick={() => setPhase("mic")} className="min-h-12 rounded-md border border-line px-5 text-sm">
          Speak
        </button>
        <button
          type="button"
          onClick={() => {
            setInputMode("PASTE");
            setPhase("compose");
          }}
          className="min-h-12 rounded-md border border-line px-5 text-sm"
        >
          Paste
        </button>
      </div>
      <p className="guest-enter-quiet mt-10 text-sm text-ink-soft">No account needed.</p>
      {storageNote}
    </div>
  );
}
