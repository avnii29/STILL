"use client";

import { useEffect, useState } from "react";

const DISMISS_KEY = "still-install-dismissed";

export function PwaProvider() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.register("/sw.js");
    if (window.location.pathname === "/") return;
    if (window.localStorage.getItem(DISMISS_KEY) === "1") return;

    const onPrompt = (event: Event) => {
      event.preventDefault();
      if (window.localStorage.getItem(DISMISS_KEY) === "1") return;
      setInstallEvent(event as BeforeInstallPromptEvent);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (!show || !installEvent) return null;

  function dismiss() {
    window.localStorage.setItem(DISMISS_KEY, "1");
    setShow(false);
  }

  return (
    <div className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] left-4 z-40 w-[min(22rem,calc(100%-2rem))] rounded-md border border-line bg-paper p-4 shadow-[var(--shadow)] lg:bottom-8 lg:left-auto lg:right-8">
      <p className="text-sm text-ink-soft">Install Still on this device for a quieter home screen.</p>
      <div className="mt-3 flex gap-3">
        <button
          type="button"
          className="min-h-11 rounded-md bg-ink px-3 text-sm text-paper"
          onClick={async () => {
            await installEvent.prompt();
            dismiss();
          }}
        >
          Install
        </button>
        <button type="button" className="min-h-11 px-2 text-sm text-ink-soft" onClick={dismiss}>
          Not now
        </button>
      </div>
    </div>
  );
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
}
