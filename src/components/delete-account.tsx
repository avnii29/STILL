"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DeleteAccount({ email }: { email: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function remove() {
    setBusy(true);
    const response = await fetch("/api/account", { method: "DELETE" });
    const payload = (await response.json()) as { error?: string };
    setBusy(false);
    if (!response.ok) {
      setMessage(payload.error ?? "Still could not delete that.");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <section className="mt-20 max-w-md border-t border-line pt-10">
      <p className="label mb-3">Delete my STILL</p>
      <p className="text-sm leading-relaxed text-ink-soft">
        This removes your account, memories, evidence, people, reminders, connected-source
        identifiers, and consent receipts. Integrations are disconnected. This cannot be undone.
      </p>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-6 min-h-11 text-sm text-danger"
        >
          Delete my STILL
        </button>
      ) : (
        <div className="mt-6">
          <label className="flex flex-col gap-2 text-sm text-ink-soft">
            Type {email} to confirm
            <input
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              className="min-h-12 rounded-md border border-line bg-paper px-3"
            />
          </label>
          <button
            type="button"
            disabled={busy || confirm !== email}
            onClick={remove}
            className="mt-4 min-h-11 rounded-md bg-danger px-4 text-sm text-paper disabled:opacity-50"
          >
            Delete my STILL forever
          </button>
        </div>
      )}
      {message ? <p className="mt-4 text-sm text-ink-soft">{message}</p> : null}
    </section>
  );
}
