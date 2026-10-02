import { clearAll, deleteMemory, getMeta, listMemories, setSkipMigration } from "@/lib/guest/store";
import { liveThreads } from "@/lib/guest/relate";
import type { GuestThread } from "@/lib/guest/types";

export async function guestMemoryCount() {
  return liveThreads(await listMemories()).length;
}

export async function migrateSelectedGuestThreads(threads: GuestThread[]) {
  if (threads.length === 0) return { ok: true as const, threadIds: [] as string[], migrated: 0 };

  const response = await fetch("/api/guest/migrate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
      threads: threads.map((thread) => ({
        note: thread.note,
        personName: thread.person ?? undefined,
        sourceKind: thread.sourceKind,
      })),
    }),
  });
  const payload = (await response.json()) as {
    error?: string;
    threadIds?: string[];
    migrated?: number;
  };
  if (!response.ok) {
    return { ok: false as const, error: payload.error ?? "Those memories could not move yet." };
  }

  const migrated = payload.migrated ?? payload.threadIds?.length ?? 0;
  if (migrated >= threads.length) {
    for (const thread of threads) {
      await deleteMemory(thread.id);
    }
  }
  return {
    ok: true as const,
    threadIds: payload.threadIds ?? [],
    migrated,
  };
}

export async function leaveGuestThreadsHere() {
  await setSkipMigration(true);
}

export async function shouldPreviewMigration() {
  const meta = await getMeta();
  if (meta.skipMigration) return false;
  return (await guestMemoryCount()) > 0;
}

export async function forgetGuestDevice() {
  await clearAll();
}
