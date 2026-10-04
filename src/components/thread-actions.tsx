"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { NO_AUTO_MESSAGE } from "@/lib/copy";

type Proposal = {
  id: string;
  kind: string;
  reason: string;
  status: string;
  blockedReason: string | null;
  risk?: string | null;
};

export function ThreadActions({
  threadId,
  suggestedAction,
  wouldContact,
  futureSelf = false,
  postponementCount = 0,
  pendingProposal = null,
  documentHref = null,
}: {
  threadId: string;
  suggestedAction: string;
  wouldContact: boolean;
  futureSelf?: boolean;
  postponementCount?: number;
  pendingProposal?: Proposal | null;
  documentHref?: string | null;
}) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [remindAt, setRemindAt] = useState("");
  const [when, setWhen] = useState("");
  const [postponeOpen, setPostponeOpen] = useState(false);

  async function act(action: string, extra?: Record<string, unknown>) {
    setBusy(true);
    setMessage(null);
    const method = action === "delete" ? "DELETE" : "POST";
    const response = await fetch(`/api/threads/${threadId}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body:
        action === "delete"
          ? undefined
          : JSON.stringify({ action, note: note || undefined, ...extra }),
    });
    const payload = (await response.json()) as { error?: string; message?: string };
    setBusy(false);
    if (!response.ok) {
      setMessage(payload.error ?? "That did not take.");
      return;
    }
    if (action === "delete") {
      router.push("/memory");
      router.refresh();
      return;
    }
    if (action === "resolve") {
      setMessage("done.");
    }
    if (payload.message) setMessage(payload.message);
    setPostponeOpen(false);
    router.refresh();
  }

  async function saveReminder(event: React.FormEvent) {
    event.preventDefault();
    if (!remindAt) return;
    setBusy(true);
    setMessage(null);
    const response = await fetch(`/api/threads/${threadId}/reminder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ remindAt: new Date(remindAt).toISOString() }),
    });
    const payload = (await response.json()) as { error?: string };
    setBusy(false);
    if (!response.ok) {
      setMessage(payload.error ?? "The reminder did not save.");
      return;
    }
    setMessage("Reminder kept.");
    router.refresh();
  }

  const repeated = postponementCount >= 1;

  return (
    <div className="mt-14 max-w-4xl">
      <p className="label mb-3">Next moment</p>
      <p className="font-display text-3xl leading-tight tracking-tight">{suggestedAction}</p>
      {postponementCount > 0 ? (
        <p className="mt-3 text-sm text-ink-soft">
          This has moved {postponementCount} time{postponementCount === 1 ? "" : "s"}.
        </p>
      ) : null}
      {wouldContact ? (
        <p className="mt-4 text-sm leading-relaxed text-ink-soft">{NO_AUTO_MESSAGE}</p>
      ) : null}

      {pendingProposal ? (
        <div className="mt-8 rounded-md border border-line bg-paper p-5">
          <p className="label">Still paused</p>
          <p className="mt-3 font-display text-2xl tracking-tight">{pendingProposal.reason}</p>
          <p className="mt-3 text-sm text-ink-faint">Risk {pendingProposal.risk ?? "medium"}</p>
          {pendingProposal.status === "BLOCKED" ? (
            <p className="mt-3 text-sm text-ink-soft">
              {pendingProposal.blockedReason ?? "That looked important, so I left it alone."} Nothing
              changed.
            </p>
          ) : (
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                disabled={busy}
                onClick={() => act("approve_proposal", { proposalId: pendingProposal.id })}
                className="min-h-11 rounded-md bg-ink px-4 text-sm text-paper disabled:opacity-60"
              >
                Move it
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => act("reject_proposal", { proposalId: pendingProposal.id })}
                className="min-h-11 rounded-md border border-line px-4 text-sm"
              >
                Not now
              </button>
            </div>
          )}
        </div>
      ) : null}

      {postponeOpen ? (
        <div className="mt-8 rounded-md border border-line bg-paper/80 p-5">
          {repeated ? (
            <>
              <p className="font-display text-2xl tracking-tight">This keeps moving.</p>
              <p className="mt-3 text-ink-soft">Want to make it smaller?</p>
              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    act("postpone", {
                      note: documentHref
                        ? "Open the known document and write the first sentence."
                        : "Don't finish the whole thing. Open it. Write the first sentence.",
                    })
                  }
                  className="min-h-11 rounded-md bg-ink px-4 text-sm text-paper"
                >
                  Break it down
                </button>
                {documentHref ? (
                  <a href={documentHref} className="inline-flex min-h-11 items-center rounded-md border border-line px-4 text-sm">
                    Open document
                  </a>
                ) : null}
                <button type="button" onClick={() => setWhen("")} className="sr-only">
                  Choose another time
                </button>
              </div>
            </>
          ) : (
            <p className="font-display text-2xl tracking-tight">When instead?</p>
          )}
          <label className="mt-5 flex flex-col gap-2 text-sm text-ink-soft" htmlFor="still-postpone-when">
            Choose another time
            <input
              id="still-postpone-when"
              type="datetime-local"
              value={when}
              onChange={(event) => setWhen(event.target.value)}
              className="min-h-11 rounded-md border border-line bg-paper px-3"
            />
          </label>
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={busy || !when}
              onClick={() => act("postpone", { when: new Date(when).toISOString() })}
              className="min-h-11 rounded-md bg-ink px-4 text-sm text-paper disabled:opacity-60"
            >
              Keep this time
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => act("postpone")}
              className="min-h-11 rounded-md border border-line px-4 text-sm"
            >
              Keep it for tomorrow evening
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => act("dismiss")}
              className="min-h-11 px-4 text-sm text-ink-soft"
            >
              Let it go
            </button>
          </div>
        </div>
      ) : null}

      <form onSubmit={saveReminder} className="mt-8 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-2 text-sm text-ink-soft" htmlFor="still-reminder">
          Reminder
          <input
            id="still-reminder"
            type="datetime-local"
            value={remindAt}
            onChange={(event) => setRemindAt(event.target.value)}
            className="min-h-11 rounded-md border border-line bg-paper px-3"
          />
        </label>
        <button type="submit" disabled={busy} className="min-h-11 rounded-md border border-line px-4 text-sm">
          Keep this reminder
        </button>
      </form>

      <label className="mt-6 flex flex-col gap-2 text-sm text-ink-soft" htmlFor="still-thread-note">
        A note, if you want
        <textarea
          id="still-thread-note"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={3}
          className="rounded-md border border-line bg-paper px-3 py-2"
        />
      </label>
      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => setPostponeOpen(true)}
          className="min-h-11 rounded-md border border-line px-4 text-sm"
        >
          Not today
        </button>
        {futureSelf ? (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => act("open")}
              className="min-h-11 rounded-md bg-ink px-4 text-sm text-paper disabled:opacity-60"
            >
              Still want this
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => act("dismiss")}
              className="min-h-11 rounded-md border border-line px-4 text-sm text-ink-soft"
            >
              Let it go
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => act("approve_suggestion")}
              className="min-h-11 rounded-md bg-ink px-4 text-sm text-paper disabled:opacity-60"
            >
              I will do this
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => act("resolve", { resolutionKind: "FULFILLED" })}
              className="min-h-11 rounded-md border border-line px-4 text-sm"
            >
              This is done
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => act("dismiss")}
              className="min-h-11 rounded-md border border-line px-4 text-sm text-ink-soft"
            >
              Let it go
            </button>
          </>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={() => act("delete")}
          className="min-h-11 px-4 text-sm text-danger"
        >
          Forget this memory
        </button>
      </div>
      {message ? (
        <p className="mt-4 whitespace-pre-wrap text-sm text-ink-soft" role="status" aria-live="polite">
          {message}
        </p>
      ) : null}
    </div>
  );
}
