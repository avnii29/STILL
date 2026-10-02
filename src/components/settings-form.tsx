"use client";

import { useState } from "react";

export function SettingsForm({
  displayName,
  timezone,
  emailNotifications,
  webPushEnabled,
  followUpDays,
}: {
  displayName: string;
  timezone: string;
  emailNotifications: boolean;
  webPushEnabled: boolean;
  followUpDays: number;
}) {
  const [state, setState] = useState({
    displayName,
    timezone,
    emailNotifications,
    webPushEnabled,
    followUpDays,
  });
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

  return (
    <form onSubmit={save} className="flex max-w-md flex-col gap-5">
      <label className="flex flex-col gap-2 text-sm text-ink-soft" htmlFor="still-display-name">
        What to call you
        <input
          id="still-display-name"
          autoComplete="nickname"
          value={state.displayName}
          onChange={(event) => setState({ ...state, displayName: event.target.value })}
          className="min-h-12 rounded-md border border-line bg-paper px-3"
        />
      </label>
      <label className="flex flex-col gap-2 text-sm text-ink-soft" htmlFor="still-timezone">
        Timezone
        <input
          id="still-timezone"
          autoComplete="off"
          value={state.timezone}
          onChange={(event) => setState({ ...state, timezone: event.target.value })}
          className="min-h-12 rounded-md border border-line bg-paper px-3"
        />
      </label>
      <label className="flex items-center gap-3 text-sm">
        <input
          type="checkbox"
          checked={state.emailNotifications}
          onChange={(event) =>
            setState({ ...state, emailNotifications: event.target.checked })
          }
        />
        Email when something still needs you
      </label>
      <label className="flex flex-col gap-2 text-sm text-ink-soft">
        Days before a gentle follow-up
        <input
          type="number"
          min={1}
          max={30}
          value={state.followUpDays}
          onChange={(event) =>
            setState({ ...state, followUpDays: Number(event.target.value) })
          }
          className="min-h-12 rounded-md border border-line bg-paper px-3"
        />
      </label>
      <button type="submit" className="min-h-11 w-fit rounded-md bg-ink px-4 text-sm text-paper">
        Save
      </button>
      {message ? (
        <p className="text-sm text-ink-soft" role="status" aria-live="polite">
          {message}
        </p>
      ) : null}
    </form>
  );
}
