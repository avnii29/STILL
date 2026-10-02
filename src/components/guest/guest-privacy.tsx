"use client";

import { useEffect, useState } from "react";
import { liveThreads } from "@/lib/guest/relate";
import { clearAll, listMemories, storageMode } from "@/lib/guest/store";
import type { GuestStorageMode } from "@/lib/guest/types";

export function GuestPrivacy({
  aiProvider,
}: {
  aiProvider: "none" | "openai" | "anthropic";
}) {
  const [count, setCount] = useState(0);
  const [mode, setMode] = useState<GuestStorageMode>("none");
  const [confirm, setConfirm] = useState(false);
  const [cleared, setCleared] = useState(false);

  useEffect(() => {
    void (async () => {
      setMode(await storageMode());
      setCount(liveThreads(await listMemories()).length);
    })();
  }, []);

  const remote =
    aiProvider === "none"
      ? "Guest extraction currently runs as wording patterns on the STILL server. No OpenAI or Anthropic request is made unless an operator later sets AI_PROVIDER."
      : `If a language-model provider is configured (${aiProvider === "openai" ? "OpenAI" : "Anthropic"}), candidate snippets may be sent there. Whether that provider trains on API traffic is not a completed fact in this repository.`;

  return (
    <div className="mt-6 max-w-xl">
      <p className="label">Guest privacy</p>
      <h1 className="mt-4 font-display text-[clamp(2.4rem,6vw,4.4rem)] leading-[0.95] tracking-tight">
        what stays here.
      </h1>
      <section className="mt-10 space-y-4 text-lg leading-relaxed text-ink-soft">
        <p>
          Guest memories stay on this device in IndexedDB (<code>still-guest</code>) unless you later
          choose to bring selected threads into an account.
        </p>
        <p>
          The sentence you ask STILL to look at is sent to <code>/api/extract</code> so the same
          detector can run. That is server processing. STILL does not claim that nothing leaves your
          device.
        </p>
        <p>{remote}</p>
        <p>
          The server rate-limits extract requests by network address. It does not store your note as
          analytics. Host logs may keep operational errors. Retention of those logs is not specified
          in this repository.
        </p>
        <p>
          Storage mode now:{" "}
          {mode === "indexeddb"
            ? "IndexedDB on this device"
            : mode === "memory"
              ? "this session only"
              : "checking this browser"}.
          Clearing site data, using private browsing, or uninstalling a PWA may remove guest
          memories.
        </p>
      </section>

      <section className="mt-14 border-t border-line pt-8">
        <h2 className="font-display text-3xl tracking-tight">Forget everything on this device</h2>
        {!confirm ? (
          <button
            type="button"
            onClick={() => setConfirm(true)}
            className="mt-6 min-h-12 rounded-md border border-line px-5 text-sm"
          >
            Clear local STILL
          </button>
        ) : (
          <div className="mt-6">
            <p className="text-ink-soft">
              This removes {count} local thread{count === 1 ? "" : "s"} from this browser.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => {
                  void clearAll().then(() => {
                    setCount(0);
                    setCleared(true);
                    setConfirm(false);
                  });
                }}
                className="min-h-12 rounded-md bg-ink px-5 text-sm text-paper"
              >
                Clear
              </button>
              <button type="button" onClick={() => setConfirm(false)} className="min-h-12 px-4 text-sm">
                Not now
              </button>
            </div>
          </div>
        )}
        {cleared ? (
          <p className="mt-4 text-sm text-ink-soft" role="status">
            This device no longer has guest threads.
          </p>
        ) : null}
      </section>
    </div>
  );
}
