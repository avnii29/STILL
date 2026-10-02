"use client";

import { useState } from "react";

export function RetentionForm({
  conversationRetention,
}: {
  conversationRetention: string;
}) {
  const [value, setValue] = useState(conversationRetention || "EVIDENCE_ONLY");
  const [message, setMessage] = useState<string | null>(null);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const response = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationRetention: value }),
    });
    setMessage(response.ok ? "Saved." : "Could not save that.");
  }

  return (
    <form onSubmit={save} className="mt-10 max-w-xl space-y-4">
      <p className="label">Conversation retention</p>
      {[
        {
          id: "NONE",
          label: "Don't retain source conversations",
        },
        {
          id: "EVIDENCE_ONLY",
          label: "Retain only required evidence",
        },
        {
          id: "RETAIN_SOURCE",
          label: "Retain source conversations",
        },
      ].map((option) => (
        <label key={option.id} className="flex items-center gap-3 text-sm">
          <input
            type="radio"
            name="retention"
            checked={value === option.id}
            onChange={() => setValue(option.id)}
          />
          {option.label}
        </label>
      ))}
      <p className="text-sm text-ink-faint">
        Default is evidence only. STILL does not need the rest of the conversation to remember a
        commitment.
      </p>
      <button type="submit" className="min-h-11 rounded-md bg-ink px-4 text-sm text-paper">
        Save
      </button>
      {message ? <p className="text-sm text-ink-soft">{message}</p> : null}
    </form>
  );
}
