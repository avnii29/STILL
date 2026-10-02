"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createBrowserSupabase, isBrowserSupabaseConfigured } from "@/lib/supabase/browser";

export function ThreadsRealtime({ userId }: { userId: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<"live" | "offline" | "reconnecting">("offline");
  const lastEvent = useRef(0);

  useEffect(() => {
    function onOnline() {
      setStatus("reconnecting");
      router.refresh();
    }
    function onOffline() {
      setStatus("offline");
    }
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    if (!isBrowserSupabaseConfigured()) {
      return () => {
        window.removeEventListener("online", onOnline);
        window.removeEventListener("offline", onOffline);
      };
    }

    const supabase = createBrowserSupabase();
    const refresh = () => {
      const now = Date.now();
      if (now - lastEvent.current < 400) return;
      lastEvent.current = now;
      router.refresh();
    };

    const channel = supabase
      .channel(`still:${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "threads", filter: `user_id=eq.${userId}` },
        refresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "people", filter: `user_id=eq.${userId}` },
        refresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        refresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reminders", filter: `user_id=eq.${userId}` },
        refresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "interventions", filter: `user_id=eq.${userId}` },
        refresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "action_proposals", filter: `user_id=eq.${userId}` },
        refresh,
      )
      .subscribe((state) => {
        if (state === "SUBSCRIBED") setStatus("live");
        else if (state === "TIMED_OUT" || state === "CHANNEL_ERROR" || state === "CLOSED") {
          setStatus(navigator.onLine ? "reconnecting" : "offline");
        }
      });

    const ping = window.setInterval(() => {
      if (!navigator.onLine) {
        setStatus("offline");
        return;
      }
      if (document.visibilityState === "visible") router.refresh();
    }, 45_000);

    return () => {
      window.clearInterval(ping);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      void supabase.removeChannel(channel);
    };
  }, [router, userId]);

  if (status === "live") return null;

  return (
    <p
      className="pointer-events-none fixed left-1/2 top-3 z-50 -translate-x-1/2 rounded-full border border-line bg-paper/95 px-3 py-1 text-[0.7rem] tracking-wide text-ink-soft"
      role="status"
    >
      {status === "offline"
        ? "You may be looking at an older moment."
        : "Waiting to reconnect."}
    </p>
  );
}
