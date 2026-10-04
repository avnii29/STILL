"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { ConnectorCapabilities, LiveStatus } from "@/lib/ingestion/types";

const LIVE_DOT: Record<LiveStatus, string> = {
  LIVE: "●",
  CONNECTED: "●",
  SYNCING: "●",
  CONNECTING: "○",
  DEGRADED: "!",
  AUTH_EXPIRED: "!",
  ERROR: "!",
  NOT_CONNECTED: "○",
  DISCONNECTED: "○",
  NOT_YET_CONFIGURED: "○",
};

export function ProviderCard({
  id,
  title,
  capability,
  alternative,
  available,
  limited,
  connectable,
  liveStatus,
  capabilities,
  unavailableReason,
  lastEventLabel,
  watching,
  scan,
  detail,
}: {
  id: string;
  title: string;
  capability: string;
  alternative: string;
  available: boolean;
  limited: boolean;
  connectable: boolean;
  liveStatus: LiveStatus;
  capabilities: ConnectorCapabilities;
  unavailableReason?: string;
  lastEventLabel?: string | null;
  watching?: number | null;
  scan?: string | null;
  detail?: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const [lookbackDays, setLookbackDays] = useState(7);
  const [customLookback, setCustomLookback] = useState(14);

  const holding = ["LIVE", "CONNECTED", "SYNCING", "DEGRADED", "CONNECTING"].includes(liveStatus);
  const showDisconnect = holding || liveStatus === "AUTH_EXPIRED" || liveStatus === "ERROR";
  const previewCopy =
    id === "CALENDAR"
      ? {
          will: "Read events needed to identify scheduling conflicts around your commitments.",
          willNot: "Cancel or move events without your approval. Calendar cannot notify you.",
          action: "Continue to Google",
        }
      : id === "TELEGRAM"
        ? {
            will: "Process messages you explicitly send or forward to the official STILL bot.",
            willNot: "Read private chats the bot is not in, or write to anyone on your behalf.",
            action: "Connect Telegram",
          }
        : {
            will: capability,
            willNot: "Silently read a personal inbox or act outside what you approve.",
            action: `Connect ${title}`,
          };

  async function connect() {
    setBusy(true);
    setMessage(null);
    if (id === "CALENDAR") {
      const days = lookbackDays === 0 ? customLookback : lookbackDays;
      const response = await fetch("/api/connectors/google-calendar/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lookbackDays: days }),
      });
      const payload = (await response.json()) as { url?: string; message?: string };
      setBusy(false);
      if (!response.ok || !payload.url) {
        setMessage(payload.message ?? "Google Calendar is not yet configured.");
        return;
      }
      window.location.assign(payload.url);
      return;
    }
    const response = await fetch("/api/integrations/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: id }),
    });
    const payload = (await response.json()) as {
      ok?: boolean;
      message?: string;
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
          : payload.message ?? "Authorization started.",
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

  const statusLabel = liveStatus.replaceAll("_", " ").toLowerCase();

  return (
    <li className="py-8">
      <p className="text-[0.68rem] tracking-[0.18em] uppercase text-ink-faint">
        <span aria-hidden="true">{LIVE_DOT[liveStatus]} </span>
        {statusLabel}
        {available || limited ? ` · ${limited ? "limited" : "available"}` : ""}
      </p>
      <h2 className="mt-2 font-display text-3xl tracking-tight">{title}</h2>
      <p className="mt-3 max-w-xl text-ink-soft">{capability}</p>
      {detail ? <p className="mt-2 max-w-xl text-sm text-ink-soft">{detail}</p> : null}
      {lastEventLabel ? <p className="mt-2 text-sm text-ink-faint">Last event {lastEventLabel}</p> : null}
      {typeof watching === "number" ? (
        <p className="mt-1 text-sm text-ink-faint">Watching {watching} calendars</p>
      ) : null}
      {scan ? <p className="mt-2 max-w-xl text-sm text-ink-soft">{scan}</p> : null}
      {unavailableReason ? <p className="mt-2 max-w-xl text-sm text-ink-faint">{unavailableReason}</p> : null}
      <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs tracking-[0.14em] uppercase text-ink-faint">
        <li>Read {capabilities.read ? "yes" : "—"}</li>
        <li>Write {capabilities.write ? "yes" : "—"}</li>
        <li>Realtime {capabilities.realtime ? "yes" : "—"}</li>
        <li>Notify {capabilities.notifications ? "yes" : "—"}</li>
        <li>Search {capabilities.search ? "yes" : "—"}</li>
      </ul>
      <p className="mt-3 max-w-xl text-sm text-ink-soft">{alternative}</p>
      <div className="mt-6 flex flex-wrap gap-3">
        {connectable && !holding && !preview ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => setPreview(true)}
            className="min-h-11 rounded-md bg-ink px-4 text-sm text-paper"
          >
            {liveStatus === "AUTH_EXPIRED" ? `Reconnect ${title}` : `Review ${title} permission`}
          </button>
        ) : null}
        {preview && !holding ? (
          <div className="w-full max-w-xl rounded-md border border-line bg-paper/80 p-5">
            <p className="label">STILL would like permission to</p>
            <p className="mt-3">{previewCopy.will}</p>
            <p className="label mt-6">STILL will not</p>
            <p className="mt-3">{previewCopy.willNot}</p>
            {id === "CALENDAR" ? (
              <fieldset className="mt-6">
                <legend className="label">How far back should STILL look?</legend>
                <div className="mt-3 flex flex-col gap-2 text-sm">
                  {[
                    [1, "Today"],
                    [7, "7 days"],
                    [30, "30 days"],
                  ].map(([days, label]) => (
                    <label key={label} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name={`lookback-${id}`}
                        checked={lookbackDays === days}
                        onChange={() => setLookbackDays(Number(days))}
                      />
                      {label}
                    </label>
                  ))}
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name={`lookback-${id}`}
                      checked={lookbackDays === 0}
                      onChange={() => setLookbackDays(0)}
                    />
                    Choose
                    <input
                      type="number"
                      min={1}
                      max={90}
                      value={customLookback}
                      onChange={(event) => setCustomLookback(Number(event.target.value))}
                      className="min-h-10 w-20 rounded-md border border-line bg-paper px-2"
                      aria-label="Custom lookback days"
                    />
                    days
                  </label>
                </div>
              </fieldset>
            ) : null}
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
        {showDisconnect ? (
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
