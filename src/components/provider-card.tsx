"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export function ProviderCard({
  id,
  title,
  capability,
  alternative,
  available,
  limited,
  connectable,
  status,
  unavailableReason,
}: {
  id: string;
  title: string;
  capability: string;
  alternative: string;
  available: boolean;
  limited: boolean;
  connectable: boolean;
  status: string;
  unavailableReason?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);

  const previewCopy =
    id === "CALENDAR"
      ? {
          will: "Read events needed to identify scheduling conflicts around your commitments.",
          willNot: "Cancel or move events without your approval.",
          action: "Continue to Google",
        }
      : id === "TELEGRAM"
        ? {
            will: "Process messages you explicitly send or forward to the official STILL bot to detect commitments and reminders.",
            willNot: "Read private chats the bot is not in, or write to anyone on your behalf.",
            action: "Connect Telegram",
          }
        : {
            will: capability,
            willNot: "Silently read a personal inbox or act outside what you approve.",
            action: `Connect ${title}`,
          };

  const displayStatus =
    !connectable && !available ? "UNAVAILABLE" : !connectable && available ? "READY" : status;
  const capabilityWord = !available
    ? "UNAVAILABLE"
    : limited
      ? "LIMITED"
      : "AVAILABLE";

  async function connect() {
    setBusy(true);
    setMessage(null);
    const response = await fetch("/api/integrations/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: id }),
    });
    const payload = (await response.json()) as {
      ok?: boolean;
      message?: string;
      alternative?: string;
      deepLink?: string | null;
      linkCode?: string | null;
    };
    setBusy(false);
    if (!response.ok || payload.ok === false) {
      setMessage(payload.message ?? "STILL can't access this source yet.");
      return;
    }
    if (payload.deepLink) setLink(payload.deepLink);
    setMessage(
      payload.deepLink
        ? payload.message ?? "Open the official STILL Telegram bot."
        : payload.linkCode
          ? `In Telegram, start the official STILL bot and send /start ${payload.linkCode}`
          : payload.message ?? "Connected.",
    );
    router.refresh();
  }

  async function disconnect() {
    setBusy(true);
    setMessage(null);
    const response = await fetch("/api/integrations/disconnect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: id }),
    });
    const payload = (await response.json()) as { message?: string };
    setBusy(false);
    setMessage(payload.message ?? "Disconnected.");
    setLink(null);
    router.refresh();
  }

  return (
    <li className="py-8">
      <p className="text-[0.68rem] tracking-[0.18em] uppercase text-ink-faint">
        {displayStatus.replaceAll("_", " ").toLowerCase()}
        {available || limited ? ` · ${capabilityWord.toLowerCase()}` : ""}
      </p>
      <h2 className="mt-2 font-display text-3xl tracking-tight">{title}</h2>
      <p className="mt-3 max-w-xl text-ink-soft">{capability}</p>
      {unavailableReason ? (
        <p className="mt-2 max-w-xl text-sm text-ink-faint">{unavailableReason}</p>
      ) : null}
      <p className="mt-3 max-w-xl text-sm text-ink-soft">{alternative}</p>
      <div className="mt-6 flex flex-wrap gap-3">
        {connectable && displayStatus !== "CONNECTED" && !preview ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => setPreview(true)}
            className="min-h-11 rounded-md bg-ink px-4 text-sm text-paper"
          >
            Review {title} permission
          </button>
        ) : null}
        {preview && displayStatus !== "CONNECTED" ? (
          <div className="w-full max-w-xl rounded-md border border-line bg-paper/80 p-5">
            <p className="label">STILL would like permission to</p>
            <p className="mt-3">{previewCopy.will}</p>
            <p className="label mt-6">STILL will not</p>
            <p className="mt-3">{previewCopy.willNot}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                disabled={busy}
                onClick={connect}
                className="min-h-11 rounded-md bg-ink px-4 text-sm text-paper"
              >
                {previewCopy.action}
              </button>
              <button type="button" onClick={() => setPreview(false)} className="min-h-11 px-4 text-sm">
                Not now
              </button>
            </div>
          </div>
        ) : null}
        {displayStatus === "CONNECTED" || displayStatus === "CONNECTING" ? (
          <button
            type="button"
            disabled={busy}
            onClick={disconnect}
            className="min-h-11 rounded-md border border-line px-4 text-sm"
          >
            Disconnect {title}
          </button>
        ) : null}
        <Link href="/capture?mode=PASTE" className="inline-flex min-h-11 items-center px-4 text-sm">
          Paste a conversation instead
        </Link>
        {link ? (
          <a href={link} className="inline-flex min-h-11 items-center px-4 text-sm" target="_blank" rel="noreferrer">
            Open Telegram
          </a>
        ) : null}
      </div>
      {message ? <p className="mt-3 max-w-xl text-sm text-ink-soft">{message}</p> : null}
    </li>
  );
}
