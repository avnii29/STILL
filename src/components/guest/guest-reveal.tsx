"use client";

import { displayTitle } from "@/lib/guest/parse";
import type { Extraction } from "@/lib/agents/extract";

export function GuestReveal({
  extraction,
  original,
  busy,
  message,
  onKeep,
  onEdit,
  onDismiss,
}: {
  extraction: Extraction;
  original: string;
  busy: boolean;
  message?: string | null;
  onKeep: () => void;
  onEdit: () => void;
  onDismiss: () => void;
}) {
  const found = extraction.is_commitment || extraction.uncertain;
  const title = displayTitle(extraction.normalized_commitment || extraction.commitment_text);

  return (
    <div className="max-w-xl">
      <p className="text-lg leading-relaxed text-ink-soft">{original}</p>
      <div className="still-thread-line mt-10 origin-left" />
      <h2 className="mt-10 font-display text-[clamp(2.2rem,6vw,4.2rem)] leading-[0.92] tracking-tight">
        {title}
      </h2>
      {extraction.person ? (
        <p className="mt-6 font-display text-4xl tracking-tight">{extraction.person.toUpperCase()}</p>
      ) : null}
      {extraction.deadline ? (
        <p className="mt-2 font-display text-4xl tracking-tight text-ink-soft">
          {extraction.deadline.toUpperCase()}
        </p>
      ) : null}
      <p className="mt-12 font-display text-2xl tracking-tight">
        {found ? "I found something worth keeping." : "STILL will not invent a commitment from this."}
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        {found ? (
          <button
            type="button"
            disabled={busy}
            onClick={onKeep}
            className="min-h-12 rounded-md bg-ink px-5 text-sm text-paper disabled:opacity-60"
          >
            Keep this
          </button>
        ) : null}
        <button type="button" onClick={onEdit} className="min-h-12 px-4 text-sm">
          Edit
        </button>
        <button type="button" onClick={onDismiss} className="min-h-12 px-4 text-sm text-ink-soft">
          Not this
        </button>
      </div>
      {message ? (
        <p className="mt-6 whitespace-pre-wrap text-sm text-ink-soft" role="status" aria-live="polite">
          {message}
        </p>
      ) : null}
    </div>
  );
}
