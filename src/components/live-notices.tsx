"use client";

import { useEffect, useRef, useState } from "react";

type Notice = {
  id: string;
  title: string;
  body: string;
  href: string | null;
};

export function LiveNotices() {
  const [notice, setNotice] = useState<Notice | null>(null);
  const seen = useRef(new Set<string>());

  useEffect(() => {
    let stop = false;
    const pull = () => {
      void fetch("/api/notifications/live")
        .then(async (response) => {
          if (!response.ok || stop) return;
          const payload = (await response.json()) as { notifications?: Notice[] };
          const fresh = (payload.notifications ?? []).filter((item) => !seen.current.has(item.id));
          if (fresh.length === 0 || stop) return;
          for (const item of fresh) seen.current.add(item.id);
          const latest = fresh[0];
          if (!latest) return;
          setNotice(latest);
          if (typeof Notification !== "undefined" && Notification.permission === "granted") {
            for (const item of fresh) {
              new Notification(item.title, { body: item.body });
            }
          }
        })
        .catch(() => undefined);
    };
    const kick = window.setTimeout(pull, 1000);
    const timer = window.setInterval(pull, 4000);
    return () => {
      stop = true;
      window.clearTimeout(kick);
      window.clearInterval(timer);
    };
  }, []);

  if (!notice) return null;
  return (
    <div className="mb-8 max-w-xl rounded-md border border-line bg-paper px-4 py-3" role="status">
      <p className="label">Live notification</p>
      <p className="mt-2 font-display text-2xl tracking-tight">{notice.title}</p>
      <p className="mt-2 whitespace-pre-wrap text-sm text-ink-soft">{notice.body}</p>
      {notice.href ? (
        <a href={notice.href} className="mt-3 inline-flex min-h-11 items-center text-sm">
          Open
        </a>
      ) : null}
    </div>
  );
}
