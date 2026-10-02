"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const MEMORY = [
  { key: "rememberCommitments", label: "Clear commitments" },
  { key: "rememberReminders", label: "Explicit reminders" },
  { key: "rememberDeadlines", label: "Deadlines" },
  { key: "rememberResolution", label: "Resolution history" },
] as const;

const PLACES = ["Telegram", "WhatsApp", "Instagram", "Email", "Calendar", "Voice"] as const;

export function OnboardingForm({ defaultName }: { defaultName: string }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [displayName, setDisplayName] = useState(defaultName);
  const [memory, setMemory] = useState({
    rememberCommitments: true,
    rememberReminders: true,
    rememberDeadlines: true,
    rememberResolution: true,
  });
  const [notify, setNotify] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function finish() {
    setBusy(true);
    setMessage(null);
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    const settings = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        displayName,
        timezone,
        emailNotifications: notify,
        webPushEnabled: false,
        followUpDays: 3,
        ...memory,
        rememberPossible: false,
        rememberContext: false,
        autoRememberClear: false,
      }),
    });
    if (!settings.ok) {
      setBusy(false);
      setMessage("STILL could not save that yet.");
      return;
    }
    const complete = await fetch("/api/onboarding/complete", { method: "POST" });
    if (!complete.ok) {
      setBusy(false);
      setMessage("STILL could not finish beginning. Try again.");
      return;
    }
    setBusy(false);
    setStep(4);
  }

  return (
    <div className="mt-10 max-w-md">
      {step === 0 ? (
        <>
          <label className="flex flex-col gap-2 text-sm text-ink-soft">
            What should STILL call you
            <input
              required
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              className="min-h-12 rounded-md border border-line bg-paper px-3"
            />
          </label>
          <h2 className="mt-10 font-display text-3xl tracking-tight">What should STILL remember?</h2>
          <ul className="mt-6 space-y-3">
            {MEMORY.map((item) => (
              <li key={item.key}>
                <label className="flex items-center gap-3 text-sm">
                  <input
                    type="checkbox"
                    checked={memory[item.key]}
                    onChange={() =>
                      setMemory((current) => ({ ...current, [item.key]: !current[item.key] }))
                    }
                  />
                  {item.label}
                </label>
              </li>
            ))}
          </ul>
          <button
            type="button"
            disabled={!displayName.trim()}
            onClick={() => setStep(1)}
            className="mt-8 min-h-12 rounded-md bg-ink px-5 text-sm text-paper disabled:opacity-60"
          >
            Continue
          </button>
        </>
      ) : null}

      {step === 1 ? (
        <>
          <h2 className="font-display text-3xl tracking-tight">Where do your commitments happen?</h2>
          <ul className="mt-6 space-y-3 text-ink-soft">
            {PLACES.map((place) => (
              <li key={place}>{place}</li>
            ))}
          </ul>
          <p className="mt-6 text-sm text-ink-faint">
            You can connect a source later. STILL works with type, speak, and paste.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="min-h-12 rounded-md bg-ink px-5 text-sm text-paper"
            >
              Continue
            </button>
            <button type="button" onClick={() => setStep(2)} className="min-h-12 px-4 text-sm">
              Skip for now
            </button>
          </div>
        </>
      ) : null}

      {step === 2 ? (
        <>
          <h2 className="font-display text-3xl tracking-tight">When should STILL reach you?</h2>
          <label className="mt-6 flex items-center gap-3 text-sm">
            <input type="checkbox" checked={notify} onChange={() => setNotify((value) => !value)} />
            A quiet notice when something still needs you
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={() => void finish()}
            className="mt-8 min-h-12 rounded-md bg-ink px-5 text-sm text-paper disabled:opacity-60"
          >
            Continue
          </button>
        </>
      ) : null}

      {step === 4 ? (
        <>
          <p className="label">Done</p>
          <h2 className="mt-4 font-display text-4xl tracking-tight">Welcome to STILL.</h2>
          <p className="mt-4 text-ink-soft">nothing is hanging right now.</p>
          <button
            type="button"
            onClick={() => {
              router.push("/home");
              router.refresh();
            }}
            className="mt-8 min-h-12 rounded-md bg-ink px-5 text-sm text-paper"
          >
            Enter
          </button>
        </>
      ) : null}

      {message ? (
        <p className="mt-6 text-sm text-ink-soft" role="status" aria-live="polite">
          {message}
        </p>
      ) : null}
    </div>
  );
}
