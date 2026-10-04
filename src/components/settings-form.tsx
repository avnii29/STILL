"use client";

import { useState } from "react";

export function SettingsForm({
  displayName,
  timezone,
  emailNotifications,
  webPushEnabled,
  followUpDays,
  notifyCommitment,
  notifyDeadline,
  notifyBlocked,
  notifyDeadlineChange,
  notifyResolved,
  notifyMinorContext,
  notifyInApp,
  quietHoursStart,
  quietHoursEnd,
}: {
  displayName: string;
  timezone: string;
  emailNotifications: boolean;
  webPushEnabled: boolean;
  followUpDays: number;
  notifyCommitment: boolean;
  notifyDeadline: boolean;
  notifyBlocked: boolean;
  notifyDeadlineChange: boolean;
  notifyResolved: boolean;
  notifyMinorContext: boolean;
  notifyInApp: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
}) {
  const [state, setState] = useState({
    displayName,
    timezone,
    emailNotifications,
    webPushEnabled,
    followUpDays,
    notifyCommitment,
    notifyDeadline,
    notifyBlocked,
    notifyDeadlineChange,
    notifyResolved,
    notifyMinorContext,
    notifyInApp,
    quietHoursStart,
    quietHoursEnd,
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
        Email
      </label>
      <label className="flex items-center gap-3 text-sm">
        <input
          type="checkbox"
          checked={state.webPushEnabled}
          onChange={(event) => setState({ ...state, webPushEnabled: event.target.checked })}
        />
        Browser, after permission is granted
      </label>
      <fieldset className="space-y-3">
        <legend className="label">Notify me when</legend>
        {(
          [
            ["notifyCommitment", "A commitment is detected"],
            ["notifyDeadline", "A deadline is approaching"],
            ["notifyBlocked", "A commitment appears blocked"],
            ["notifyDeadlineChange", "A deadline changes"],
            ["notifyResolved", "Something is resolved"],
            ["notifyMinorContext", "Every minor context change"],
            ["notifyInApp", "In the app"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={state[key]}
              onChange={(event) => setState({ ...state, [key]: event.target.checked })}
            />
            {label}
          </label>
        ))}
      </fieldset>
      <div className="flex flex-wrap gap-4">
        <label className="flex flex-col gap-2 text-sm text-ink-soft">
          Quiet hours start
          <input
            type="time"
            value={state.quietHoursStart}
            onChange={(event) => setState({ ...state, quietHoursStart: event.target.value })}
            className="min-h-12 rounded-md border border-line bg-paper px-3"
          />
        </label>
        <label className="flex flex-col gap-2 text-sm text-ink-soft">
          Quiet hours end
          <input
            type="time"
            value={state.quietHoursEnd}
            onChange={(event) => setState({ ...state, quietHoursEnd: event.target.value })}
            className="min-h-12 rounded-md border border-line bg-paper px-3"
          />
        </label>
      </div>
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
