"use client";

import { useState } from "react";

type Policy = {
  rememberReminders: boolean;
  rememberCommitments: boolean;
  rememberPossible: boolean;
  rememberDeadlines: boolean;
  rememberResolution: boolean;
  rememberContext: boolean;
  autoRememberClear: boolean;
};

export function MemoryPolicyForm(initial: Policy) {
  const [state, setState] = useState(initial);
  const [message, setMessage] = useState<string | null>(null);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const response = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state),
    });
    setMessage(response.ok ? "Saved." : "Could not save that.");
  }

  function toggle(key: keyof Policy) {
    setState((current) => ({ ...current, [key]: !current[key] }));
  }

  return (
    <form onSubmit={save} className="mt-12 max-w-xl space-y-5">
      <Toggle
        checked={state.rememberReminders}
        onChange={() => toggle("rememberReminders")}
        label="Explicit reminder requests"
      />
      <Toggle
        checked={state.rememberCommitments}
        onChange={() => toggle("rememberCommitments")}
        label="Clear commitments"
      />
      <Toggle
        checked={state.rememberPossible}
        onChange={() => toggle("rememberPossible")}
        label="Possible commitments"
        note="These still need confirmation."
      />
      <Toggle
        checked={state.rememberDeadlines}
        onChange={() => toggle("rememberDeadlines")}
        label="Commitment deadlines"
      />
      <Toggle
        checked={state.rememberResolution}
        onChange={() => toggle("rememberResolution")}
        label="Resolution history"
      />
      <Toggle
        checked={state.rememberContext}
        onChange={() => toggle("rememberContext")}
        label="General conversation context"
        note="Off by default. STILL does not need this to keep a promise alive."
      />
      <Toggle
        checked={state.autoRememberClear}
        onChange={() => toggle("autoRememberClear")}
        label="Automatically remember clear commitments"
        note="High-confidence promises can be stored without a prompt. You can still undo."
      />
      <button type="submit" className="min-h-11 rounded-md bg-ink px-4 text-sm text-paper">
        Save
      </button>
      {message ? <p className="text-sm text-ink-soft">{message}</p> : null}
    </form>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  note,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  note?: string;
}) {
  return (
    <label className="flex items-start gap-3 text-sm">
      <input type="checkbox" checked={checked} onChange={onChange} className="mt-1" />
      <span>
        {label}
        {note ? <span className="mt-1 block text-ink-faint">{note}</span> : null}
      </span>
    </label>
  );
}
