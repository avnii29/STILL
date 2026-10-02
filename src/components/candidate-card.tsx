"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CandidateCard({
  id,
  title,
  person,
  deadline,
  evidence,
  classification,
  askWhen,
}: {
  id: string;
  title: string;
  person: string | null;
  deadline: string | null;
  evidence: string;
  classification: string;
  askWhen?: boolean;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function act(action: string, when?: string) {
    setBusy(true);
    setMessage(null);
    const response = await fetch(`/api/memory/candidates/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, when }),
    });
    setBusy(false);
    if (!response.ok) {
      setMessage("STILL could not keep that yet.");
      return;
    }
    router.refresh();
  }

  return (
    <article className="border-b border-line py-10 last:border-b-0">
      <p className="label">I found something worth remembering.</p>
      <h2 className="mt-3 font-display text-[clamp(1.8rem,4vw,3rem)] leading-[1.05] tracking-tight">
        {title}
      </h2>
      <p className="mt-4 text-sm text-ink-faint">
        {person ? `to ${person}` : "to you"}
        {deadline ? ` · ${deadline}` : ""}
      </p>
      <blockquote className="mt-5 max-w-xl border-l border-accent/40 pl-4 text-ink-soft">
        “{evidence}”
      </blockquote>
      {classification === "POSSIBLE_COMMITMENT" ? (
        <p className="mt-4 text-sm text-ink-soft">
          Sounds like you might be planning this. Want me to remember it?
        </p>
      ) : null}
      {askWhen ? (
        <p className="mt-4 text-sm text-ink-soft">When should I remind you?</p>
      ) : null}
      <div className="mt-6 flex flex-wrap gap-3">
        {askWhen ? (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => act("when", "later_today")}
              className="min-h-11 rounded-md border border-line px-4 text-sm"
            >
              Later today
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => act("when", "tomorrow")}
              className="min-h-11 rounded-md border border-line px-4 text-sm"
            >
              Tomorrow
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => act("when", "evening")}
              className="min-h-11 rounded-md border border-line px-4 text-sm"
            >
              This evening
            </button>
          </>
        ) : null}
        <button
          type="button"
          disabled={busy}
          onClick={() => act("remember")}
          className="min-h-11 rounded-md bg-ink px-4 text-sm text-paper"
        >
          Remember
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => act("ignore")}
          className="min-h-11 rounded-md border border-line px-4 text-sm"
        >
          Not a commitment
        </button>
      </div>
      {message ? <p className="mt-3 text-sm text-ink-soft">{message}</p> : null}
    </article>
  );
}
