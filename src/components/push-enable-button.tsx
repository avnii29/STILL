"use client";

import { useState } from "react";

export function PushEnableButton({ vapidPublicKey }: { vapidPublicKey?: string }) {
  const [message, setMessage] = useState<string | null>(null);

  if (!vapidPublicKey) {
    return (
      <p className="text-sm text-ink-soft">
        Web push needs VAPID keys in the environment before the browser can subscribe.
      </p>
    );
  }

  if (typeof window !== "undefined" && !("Notification" in window)) {
    return <p className="text-sm text-ink-soft">This browser does not support web push.</p>;
  }

  async function enable() {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setMessage("Permission was not granted.");
      return;
    }
    const registration = await navigator.serviceWorker.register("/sw.js");
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey!),
    });
    const json = subscription.toJSON();
    await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        endpoint: json.endpoint,
        keys: json.keys,
      }),
    });
    setMessage("This browser can now be nudged.");
  }

  return (
    <div>
      <button
        type="button"
        onClick={enable}
        className="min-h-11 rounded-md border border-line px-4 text-sm"
      >
        Enable web push
      </button>
      {message ? <p className="mt-3 text-sm text-ink-soft">{message}</p> : null}
    </div>
  );
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}
