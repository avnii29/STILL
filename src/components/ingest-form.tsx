"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function IngestForm() {
  const router = useRouter();
  const [personName, setPersonName] = useState("");
  const [conversationText, setConversationText] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    const response = await fetch("/api/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        personName: personName || undefined,
        conversationText,
      }),
    });
    const payload = (await response.json()) as {
      threadIds?: string[];
      error?: string;
      interpretedBy?: string;
    };
    setBusy(false);
    if (!response.ok) {
      setMessage(payload.error ?? "Still could not read that.");
      return;
    }
    const count = payload.threadIds?.length ?? 0;
    if (count === 0) {
      setMessage("Still did not find an unfinished human thread in that language.");
    } else {
      setMessage(
        count === 1
          ? "Still noticed something. It is waiting for you to look."
          : "Still noticed a few things. They are waiting for you to look.",
      );
      setConversationText("");
      router.refresh();
      router.push("/threads");
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex max-w-2xl flex-col gap-4">
      <label className="flex flex-col gap-2 text-sm text-ink-soft">
        Who was this with? Optional.
        <input
          value={personName}
          onChange={(event) => setPersonName(event.target.value)}
          className="min-h-12 rounded-md border border-line bg-paper px-3 text-ink"
          placeholder="A name you actually use"
        />
      </label>
      <label className="flex flex-col gap-2 text-sm text-ink-soft">
        Authorized conversation
        <textarea
          required
          minLength={8}
          value={conversationText}
          onChange={(event) => setConversationText(event.target.value)}
          rows={10}
          className="rounded-md border border-line bg-paper px-3 py-3 text-ink"
          placeholder={"Me: I'll send you the PDF tonight.\nSam: Thank you."}
        />
      </label>
      <p className="text-sm text-ink-faint">
        Paste only what you are allowed to share with yourself. STILL does not message anyone else.
      </p>
      <button
        type="submit"
        disabled={busy}
        className="min-h-12 w-fit rounded-md bg-ink px-5 text-sm text-paper disabled:opacity-60"
      >
        {busy ? "Reading…" : "Let Still read this"}
      </button>
      {message ? <p className="text-sm text-ink-soft">{message}</p> : null}
    </form>
  );
}
