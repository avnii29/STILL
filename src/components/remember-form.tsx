"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function RememberForm({ self = false }: { self?: boolean }) {
  const router = useRouter();
  const [personName, setPersonName] = useState("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    const response = await fetch("/api/remember", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        note,
        personName: self ? undefined : personName || undefined,
        isSelf: self,
      }),
    });
    const payload = (await response.json()) as { error?: string; threadIds?: string[] };
    setBusy(false);
    if (!response.ok) {
      setMessage(payload.error ?? "Still could not keep that.");
      return;
    }
    const count = payload.threadIds?.length ?? 0;
    if (count === 0) {
      setMessage("Still kept the note, but did not find an unfinished thread in that language.");
      setNote("");
      router.refresh();
      return;
    }
    setNote("");
    router.refresh();
    router.push(self ? "/app/future" : "/app/threads");
  }

  return (
    <form onSubmit={onSubmit} className="flex max-w-xl flex-col gap-4">
      {!self ? (
        <label className="flex flex-col gap-2 text-sm text-ink-soft">
          With whom
          <input
            value={personName}
            onChange={(event) => setPersonName(event.target.value)}
            className="min-h-12 rounded-md border border-line bg-paper px-3"
          />
        </label>
      ) : null}
      <label className="flex flex-col gap-2 text-sm text-ink-soft">
        {self ? "What you told yourself" : "What still matters"}
        <textarea
          required
          minLength={8}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={5}
          className="rounded-md border border-line bg-paper px-3 py-3"
        />
      </label>
      <button
        type="submit"
        disabled={busy}
        className="min-h-12 w-fit rounded-md bg-ink px-5 text-sm text-paper disabled:opacity-60"
      >
        Keep this
      </button>
      {message ? (
        <p className="text-sm text-ink-soft" role="status" aria-live="polite">
          {message}
        </p>
      ) : null}
    </form>
  );
}
