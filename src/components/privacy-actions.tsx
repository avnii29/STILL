"use client";

import { useState } from "react";

export function PrivacyActions() {
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function exportStill() {
    setBusy(true);
    setMessage(null);
    const response = await fetch("/api/account/export");
    if (!response.ok) {
      setBusy(false);
      setMessage("STILL could not export that yet.");
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "still-export.json";
    link.click();
    URL.revokeObjectURL(url);
    setBusy(false);
    setMessage("Your STILL is downloading.");
  }

  async function deleteSourceData() {
    if (
      !window.confirm(
        "Delete stored conversation excerpts and source messages? Commitments you already kept will remain unless you forget them separately.",
      )
    ) {
      return;
    }
    setBusy(true);
    setMessage(null);
    const response = await fetch("/api/account/source-data", { method: "DELETE" });
    setBusy(false);
    setMessage(response.ok ? "Source excerpts are gone." : "STILL could not delete those excerpts.");
  }

  return (
    <div className="mt-8 flex flex-wrap gap-3">
      <button
        type="button"
        disabled={busy}
        onClick={() => void exportStill()}
        className="min-h-11 rounded-md bg-ink px-4 text-sm text-paper disabled:opacity-60"
      >
        Export my STILL
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => void deleteSourceData()}
        className="min-h-11 rounded-md border border-line px-4 text-sm"
      >
        Delete source data
      </button>
      {message ? (
        <p className="w-full text-sm text-ink-soft" role="status" aria-live="polite">
          {message}
        </p>
      ) : null}
    </div>
  );
}
