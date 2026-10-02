"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ExtractionReveal } from "@/components/extraction-reveal";

type Mode = "TEXT" | "VOICE" | "PASTE";

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

export function CaptureStudio({ defaultMode = "TEXT" }: { defaultMode?: Mode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requested = searchParams.get("mode")?.toUpperCase();
  const initial: Mode =
    requested === "VOICE" || requested === "PASTE" || requested === "TEXT" ? requested : defaultMode;
  const [mode, setMode] = useState<Mode>(initial);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [extraction, setExtraction] = useState<Extraction | null>(null);
  const [micAllowed, setMicAllowed] = useState(false);

  useEffect(() => {
    if (mode !== "VOICE" || !micAllowed) return;
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
      return;
    }
    const instance = new SpeechRecognition();
    instance.lang = "en-US";
    instance.interimResults = true;
    instance.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript ?? "")
        .join(" ");
      setNote(transcript);
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
      /* write instead */
    }
    return () => {
      try {
        instance.stop();
      } catch {
        /* already stopped */
      }
    };
  }, [mode, micAllowed]);

  async function look(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    const response = await fetch("/api/detect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note, sourceKind: mode }),
    });
    const payload = (await response.json()) as {
      error?: string;
      extraction?: Extraction;
      uncertain?: boolean;
    };
    setBusy(false);
    if (!response.ok) {
      setMessage(
        payload.error ?? "I couldn't understand this yet.\n\nYour note is safe.\n\nTry again.",
      );
      return;
    }
    if (payload.extraction) setExtraction(payload.extraction);
    if (payload.uncertain || payload.extraction?.uncertain) {
      setMessage("Still is not sure this is a commitment. It will not invent certainty.");
    }
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
    setBusy(false);
    if (!response.ok) {
      setMessage(payload.error ?? "Still could not keep that.");
      return;
    }
    const first = payload.threadIds?.[0];
    router.push(first ? `/threads/${first}` : "/home");
    router.refresh();
  }

  if (extraction) {
    return (
      <ExtractionReveal
        extraction={extraction}
        original={note}
        busy={busy}
        message={message}
        onRemember={() => void remember()}
        onEdit={() => setExtraction(null)}
      />
    );
  }

  return (
    <form onSubmit={look} className="max-w-xl">
      <div className="flex gap-3 text-sm">
        {(["TEXT", "VOICE", "PASTE"] as const).map((item) => (
          <button
            key={item}
            type="button"
            aria-pressed={mode === item}
            onClick={() => {
              if (item === "VOICE" && !micAllowed) {
                setMode("VOICE");
                return;
              }
              setMode(item);
            }}
            className={mode === item ? "text-ink" : "text-ink-soft"}
          >
            {item === "TEXT" ? "Type" : item === "VOICE" ? "Speak" : "Paste"}
          </button>
        ))}
      </div>
      {mode === "VOICE" && !micAllowed ? (
        <div className="mt-8 max-w-xl rounded-md border border-line bg-paper/80 p-5">
          <p className="font-display text-2xl tracking-tight">Use your microphone?</p>
          <p className="mt-3 text-ink-soft">
            STILL will listen so you can say something you want remembered. Audio is not stored.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => {
                void fetch("/api/consent", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ purpose: "microphone", source: "capture" }),
                });
                setMicAllowed(true);
              }}
              className="min-h-11 rounded-md bg-ink px-4 text-sm text-paper"
            >
              Use the microphone
            </button>
            <button type="button" onClick={() => setMode("TEXT")} className="min-h-11 px-4 text-sm">
              Type instead
            </button>
          </div>
        </div>
      ) : null}
      <label className="mt-8 flex flex-col gap-2 text-sm text-ink-soft" htmlFor="still-capture">
        {mode === "VOICE"
          ? listening
            ? "Listening… audio is not stored"
            : "What you said"
          : mode === "PASTE"
            ? "A conversation"
            : "What still matters"}
        <textarea
          id="still-capture"
          required
          minLength={8}
          maxLength={4000}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={mode === "PASTE" ? 10 : 6}
          placeholder={
            mode === "PASTE"
              ? "Me: I told Rahul I'd send the database schema tomorrow.\nRahul: Thanks."
              : "I'll send Rahul the revised dataset tomorrow."
          }
          className="rounded-md border border-line bg-paper px-3 py-3 text-base text-ink"
        />
      </label>
      <button
        type="submit"
        disabled={busy}
        className="mt-6 min-h-12 rounded-md bg-ink px-5 text-sm text-paper disabled:opacity-60"
      >
        Remember
      </button>
      {message ? (
        <p className="mt-6 whitespace-pre-wrap text-sm text-ink-soft" role="status">
          {message}
        </p>
      ) : null}
    </form>
  );
}
