"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ExtractionReveal } from "@/components/extraction-reveal";

type Mode = "TEXT" | "VOICE" | "PASTE";
type Phase = "welcome" | "ask" | "mic" | "compose" | "found" | "kept";

type Extraction = {
  is_commitment: boolean;
  confidence: number;
  commitment_text: string;
  normalized_commitment: string;
  person: string | null;
  deadline: string | null;
  evidence: string;
  uncertain: boolean;
};

export function FirstRunExperience() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("welcome");
  const [mode, setMode] = useState<Mode>("TEXT");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [extraction, setExtraction] = useState<Extraction | null>(null);
  const [threadId, setThreadId] = useState<string | null>(null);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const first = window.setTimeout(() => setPhase("ask"), reduce ? 0 : 1400);
    return () => window.clearTimeout(first);
  }, []);

  useEffect(() => {
    if (phase !== "compose" || mode !== "VOICE") return;
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
      queueMicrotask(() => {
        setMessage("This browser cannot listen. Type instead. Audio was not stored.");
        setMode("TEXT");
      });
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
      setMessage("Listening stopped. Audio was not stored. Your words are still in the field if any arrived.");
    };
    instance.onend = () => setListening(false);
    instance.onstart = () => setListening(true);
    try {
      instance.start();
    } catch {
      queueMicrotask(() => setMode("TEXT"));
    }
    return () => {
      try {
        instance.stop();
      } catch {
        /* already stopped */
      }
    };
  }, [phase, mode]);

  async function completeProfile() {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ timezone, conversationRetention: "EVIDENCE_ONLY" }),
    });
    await fetch("/api/onboarding/complete", { method: "POST" });
  }

  async function look(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    const response = await fetch("/api/detect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note, sourceKind: mode }),
    });
    const payload = (await response.json()) as { error?: string; extraction?: Extraction };
    setBusy(false);
    if (!response.ok || !payload.extraction) {
      setMessage(
        payload.error ??
          "I couldn't understand this yet.\n\nYour note is safe.\n\nTry again.",
      );
      return;
    }
    setExtraction(payload.extraction);
    setPhase("found");
  }

  async function remember() {
    setBusy(true);
    setMessage(null);
    const response = await fetch("/api/remember", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        note,
        personName: extraction?.person ?? undefined,
        isSelf: !extraction?.person,
        sourceKind: mode,
      }),
    });
    const payload = (await response.json()) as { error?: string; threadIds?: string[] };
    if (!response.ok) {
      setBusy(false);
      setMessage(payload.error ?? "That was not saved. Nothing was invented.");
      return;
    }
    await completeProfile();
    setBusy(false);
    setThreadId(payload.threadIds?.[0] ?? null);
    setPhase("kept");
  }

  async function skip() {
    setBusy(true);
    await completeProfile();
    router.push("/home");
    router.refresh();
  }

  if (phase === "welcome") {
    return (
      <div className="mt-16">
        <p className="font-display text-5xl tracking-tight">welcome.</p>
      </div>
    );
  }

  if (phase === "kept") {
    return (
      <div className="mt-10">
        <p className="font-display text-6xl tracking-tight">kept.</p>
        <p className="mt-6 max-w-md text-lg text-ink-soft">
          STILL has it. You can open the thread, or come back later.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => {
              router.push(threadId ? `/threads/${threadId}` : "/home");
              router.refresh();
            }}
            className="min-h-12 rounded-md bg-ink px-5 text-sm text-paper"
          >
            Open this thread
          </button>
          <button
            type="button"
            onClick={() => {
              router.push("/home");
              router.refresh();
            }}
            className="min-h-12 px-4 text-sm"
          >
            Go to STILL
          </button>
        </div>
      </div>
    );
  }

  if (phase === "found" && extraction) {
    return (
      <div className="mt-10">
        <ExtractionReveal
          extraction={extraction}
          original={note}
          busy={busy}
          message={message}
          onRemember={() => void remember()}
          onEdit={() => {
            setExtraction(null);
            setPhase("compose");
          }}
        />
      </div>
    );
  }

  if (phase === "mic") {
    return (
      <div className="mt-10 max-w-md">
        <h2 className="font-display text-4xl tracking-tight">Use your microphone?</h2>
        <p className="mt-5 text-lg text-ink-soft">
          STILL will listen so you can say something you want remembered. Audio is not stored. Only
          the words that appear in the field can be saved, and only if you choose Remember.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => {
              void fetch("/api/consent", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ purpose: "microphone", source: "first-run" }),
              });
              setMode("VOICE");
              setPhase("compose");
            }}
            className="min-h-12 rounded-md bg-ink px-5 text-sm text-paper"
          >
            Use the microphone
          </button>
          <button type="button" onClick={() => setPhase("ask")} className="min-h-12 px-4 text-sm">
            Type instead
          </button>
        </div>
      </div>
    );
  }

  if (phase === "compose") {
    return (
      <form onSubmit={(event) => void look(event)} className="mt-10 max-w-xl">
        <label className="flex flex-col gap-3 text-sm text-ink-soft" htmlFor="still-first-note">
          Tell me something you said you&apos;d do.
          <textarea
            id="still-first-note"
            required
            minLength={8}
            maxLength={4000}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={mode === "PASTE" ? 8 : 5}
            placeholder={'I\'ll send the application tomorrow.'}
            className="rounded-md border border-line bg-paper px-3 py-3 text-lg text-ink"
          />
        </label>
        {mode === "VOICE" ? (
          <p className="mt-3 text-sm text-ink-soft">
            {listening ? "Listening. Audio is not stored." : "Speak, then remember."}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={busy}
          className="mt-6 min-h-12 rounded-md bg-ink px-5 text-sm text-paper disabled:opacity-60"
        >
          Remember
        </button>
        {message ? (
          <p className="mt-6 whitespace-pre-wrap text-sm text-ink-soft" role="status" aria-live="polite">
            {message}
          </p>
        ) : null}
      </form>
    );
  }

  return (
    <div className="mt-10">
      <p className="font-display text-3xl tracking-tight text-ink-soft">let&apos;s remember something.</p>
      <h2 className="mt-8 font-display text-[clamp(2.4rem,6vw,4.4rem)] leading-[0.95] tracking-tight">
        What are you still carrying?
      </h2>
      <p className="mt-5 max-w-md text-lg text-ink-soft">Tell STILL something you said you&apos;d do.</p>
      <div className="mt-10 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => {
            setMode("TEXT");
            setPhase("compose");
          }}
          className="min-h-12 rounded-md bg-ink px-5 text-sm text-paper"
        >
          Type
        </button>
        <button
          type="button"
          onClick={() => setPhase("mic")}
          className="min-h-12 rounded-md border border-line px-5 text-sm"
        >
          Speak
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("PASTE");
            setPhase("compose");
          }}
          className="min-h-12 rounded-md border border-line px-5 text-sm"
        >
          Paste
        </button>
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={() => void skip()}
        className="mt-10 min-h-11 text-sm text-ink-soft"
      >
        I&apos;ll remember something later
      </button>
    </div>
  );
}
