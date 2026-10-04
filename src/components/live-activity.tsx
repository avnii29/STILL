"use client";

import { useEffect, useState } from "react";
import type { LiveNow, LiveStatus } from "@/lib/ingestion/types";

function mark(live: LiveStatus) {
  if (live === "LIVE") return "●";
  if (live === "DEGRADED" || live === "AUTH_EXPIRED" || live === "ERROR") return "!";
  return "○";
}

export function LiveActivity({ initial }: { initial: LiveNow }) {
  const [data, setData] = useState(initial);

  useEffect(() => {
    let stop = false;
    const pull = () => {
      void fetch("/api/ingestion/live")
        .then(async (response) => {
          if (!response.ok || stop) return;
          const payload = (await response.json()) as LiveNow;
          if (!stop) setData(payload);
        })
        .catch(() => undefined);
    };
    const timer = window.setInterval(pull, 5000);
    return () => {
      stop = true;
      window.clearInterval(timer);
    };
  }, []);

  return (
    <section className="mt-12 max-w-4xl" aria-live="polite">
      <p className="label">STILL now</p>
      <ul className="mt-4 space-y-2 text-ink-soft">
        {data.listening.map((item) => (
          <li key={item.provider}>
            <span aria-hidden="true">{mark(item.live)} </span>
            {item.provider}{" "}
            <span className="text-ink-faint">{item.live.replaceAll("_", " ").toLowerCase()}</span>
          </li>
        ))}
      </ul>
      <dl className="mt-8 grid gap-3 text-ink-soft">
        <div>
          <dt className="label">Analyzing</dt>
          <dd>{data.analyzing} new events</dd>
        </div>
        <div>
          <dt className="label">Checking</dt>
          <dd>
            {data.checking} active {data.checking === 1 ? "commitment" : "commitments"}
          </dd>
        </div>
        <div>
          <dt className="label">Watching</dt>
          <dd>
            {data.watchingDeadlines} {data.watchingDeadlines === 1 ? "deadline" : "deadlines"}
          </dd>
        </div>
        <div>
          <dt className="label">Waiting</dt>
          <dd>
            {data.waiting} {data.waiting === 1 ? "approval" : "approvals"}
          </dd>
        </div>
      </dl>
      <p className="mt-6 text-ink">{data.line}</p>
      {data.events.length > 0 ? (
        <ol className="mt-8 space-y-4">
          {data.events.map((event) => (
            <li key={event.id}>
              <p className="label">
                {new Intl.DateTimeFormat("en", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                  hourCycle: "h23",
                }).format(new Date(event.at))}{" "}
                {event.provider}
              </p>
              <p className="mt-1 text-ink-soft">{event.summary}</p>
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}
