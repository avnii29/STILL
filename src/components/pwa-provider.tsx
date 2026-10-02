"use client";

import { useEffect, useState } from "react";

export function PwaProvider() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.register("/sw.js");

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (!show || !installEvent) return null;

  return (
    <div className="fixed inset-x-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] z-50 mx-auto max-w-md rounded-md border border-line bg-paper p-4 shadow-[var(--shadow)] lg:bottom-8">
      <p className="text-sm text-ink-soft">Install Still on this device for a quieter home screen.</p>
      <div className="mt-3 flex gap-3">
        <button
          type="button"
          className="min-h-10 rounded-md bg-ink px-3 text-sm text-paper"
          onClick={async () => {
            await installEvent.prompt();
            setShow(false);
          }}
        >
          Install
        </button>
        <button type="button" className="text-sm text-ink-soft" onClick={() => setShow(false)}>
          Not now
        </button>
      </div>
    </div>
  );
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
}
