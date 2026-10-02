"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatQuietDateLong } from "@/lib/copy";

export function EvidenceDrawer({
  evidence,
  source,
  timestamp,
  interpretedBy,
  context,
  stored,
  person,
  deadline,
  threadId,
}: {
  evidence: string;
  source: string;
  timestamp: Date | string;
  interpretedBy: string;
  context: string;
  stored?: string;
  person?: string | null;
  deadline?: string | null;
  threadId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();
  const panelId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function forget() {
    if (!threadId) return;
    const response = await fetch(`/api/threads/${threadId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "dismiss" }),
    });
    if (!response.ok) {
      setMessage("STILL could not forget that yet.");
      return;
    }
    router.push("/memory");
    router.refresh();
  }

  return (
    <section className="mt-16 max-w-2xl border-t border-line pt-8">
      <button
        ref={buttonRef}
        type="button"
        className="text-left text-sm text-ink-soft"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={panelId}
      >
        Why did STILL remember this?
      </button>
      {open ? (
        <div id={panelId} className="mt-6 space-y-4 text-base leading-relaxed text-ink-soft">
          <p className="label">You said</p>
          <blockquote className="border-l border-accent/40 pl-4 text-ink">“{evidence}”</blockquote>
          <p className="label">STILL kept</p>
          <p>
            {stored ?? evidence}
            {person ? ` · ${person}` : ""}
            {deadline ? ` · ${deadline}` : ""}
          </p>
          <p className="label">Source</p>
          <p>
            {source}
            {timestamp ? ` · ${formatQuietDateLong(timestamp)}` : ""}
          </p>
          <p className="whitespace-pre-wrap">{context}</p>
          <p className="text-sm text-ink-soft">
            {interpretedBy === "heuristic"
              ? "This reading came from wording patterns, not a model."
              : "A language model helped interpret this. It does not control what you keep."}
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            {threadId ? (
              <button
                type="button"
                onClick={forget}
                className="min-h-11 rounded-md border border-line px-4 text-sm"
              >
                Forget this memory
              </button>
            ) : null}
            <a href="#correct" className="inline-flex min-h-11 items-center px-4 text-sm">
              Correct
            </a>
            <a href="#source" className="inline-flex min-h-11 items-center px-4 text-sm">
              View source
            </a>
          </div>
          {message ? (
            <p className="text-sm" role="status">
              {message}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
