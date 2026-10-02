import { parseGuestDraft, parseGuestThread, parseGuestWorkspace } from "@/lib/guest/parse";
import {
  GUEST_DB_NAME,
  GUEST_DB_VERSION,
  GUEST_MAX_THREADS,
  LEGACY_STORAGE_KEY,
  type GuestDraft,
  type GuestMeta,
  type GuestStorageMode,
  type GuestThread,
} from "@/lib/guest/types";

export {
  emptyGuestWorkspace,
  parseGuestThread,
  parseGuestWorkspace,
  threadFromExtraction,
  displayTitle,
} from "@/lib/guest/parse";
export { liveThreads, shouldOfferLongTermKeep } from "@/lib/guest/relate";
export type { GuestDraft, GuestThread, GuestWorkspace, GuestSourceKind, GuestStorageMode } from "@/lib/guest/types";

type StoreState = {
  mode: GuestStorageMode;
  memory: Map<string, GuestThread>;
  meta: GuestMeta;
  draft: GuestDraft | null;
};

const state: StoreState = {
  mode: "none",
  memory: new Map(),
  meta: emptyMeta(),
  draft: null,
};

let opening: Promise<GuestStorageMode> | null = null;

function emptyMeta(now = new Date()): GuestMeta {
  const stamp = now.toISOString();
  return { createdAt: stamp, updatedAt: stamp, skipMigration: false };
}

function touchMeta() {
  state.meta = { ...state.meta, updatedAt: new Date().toISOString() };
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(GUEST_DB_NAME, GUEST_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("memories")) {
        db.createObjectStore("memories", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("kv")) {
        db.createObjectStore("kv", { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("indexeddb"));
  });
}

function idbReq<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("indexeddb"));
  });
}

async function readLegacy(): Promise<GuestThread[]> {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = parseGuestWorkspace(JSON.parse(raw) as unknown);
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
    window.sessionStorage.removeItem("still-guest-draft-v1");
    return parsed?.threads ?? [];
  } catch {
    return [];
  }
}

async function persistAll(db: IDBDatabase) {
  const tx = db.transaction(["memories", "kv"], "readwrite");
  tx.objectStore("memories").clear();
  for (const thread of state.memory.values()) {
    tx.objectStore("memories").put(thread);
  }
  tx.objectStore("kv").put({ key: "meta", value: state.meta });
  tx.objectStore("kv").put({ key: "draft", value: state.draft });
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("indexeddb"));
  });
}

export async function openGuestStore(): Promise<GuestStorageMode> {
  if (typeof window === "undefined") {
    state.mode = "none";
    return state.mode;
  }
  if (opening) return opening;
  opening = (async () => {
    try {
      if (!("indexedDB" in window)) throw new Error("no-idb");
      const db = await openDb();
      const tx = db.transaction(["memories", "kv"], "readonly");
      const rows = await idbReq(tx.objectStore("memories").getAll());
      const metaRow = await idbReq(tx.objectStore("kv").get("meta"));
      const draftRow = await idbReq(tx.objectStore("kv").get("draft"));
      const threads = (Array.isArray(rows) ? rows : [])
        .map(parseGuestThread)
        .filter((item): item is GuestThread => Boolean(item));
      const legacy = threads.length === 0 ? await readLegacy() : [];
      state.memory = new Map([...threads, ...legacy].map((item) => [item.id, item]));
      state.meta =
        metaRow && typeof metaRow === "object" && "value" in metaRow
          ? {
              createdAt: String((metaRow.value as GuestMeta).createdAt ?? new Date().toISOString()),
              updatedAt: String((metaRow.value as GuestMeta).updatedAt ?? new Date().toISOString()),
              skipMigration: Boolean((metaRow.value as GuestMeta).skipMigration),
            }
          : emptyMeta();
      state.draft = parseGuestDraft(draftRow && typeof draftRow === "object" && "value" in draftRow ? draftRow.value : null);
      state.mode = "indexeddb";
      if (legacy.length > 0) await persistAll(db);
      db.close();
      return state.mode;
    } catch {
      const legacy = await readLegacy();
      state.memory = new Map(legacy.map((item) => [item.id, item]));
      state.meta = emptyMeta();
      state.draft = null;
      state.mode = "memory";
      return state.mode;
    }
  })();
  return opening;
}

async function write() {
  touchMeta();
  if (state.mode !== "indexeddb") return;
  const db = await openDb();
  await persistAll(db);
  db.close();
}

export async function createMemory(thread: GuestThread) {
  await openGuestStore();
  const next = [thread, ...[...state.memory.values()].filter((item) => item.id !== thread.id)].slice(
    0,
    GUEST_MAX_THREADS,
  );
  state.memory = new Map(next.map((item) => [item.id, item]));
  await write();
  return thread;
}

export async function updateMemory(id: string, patch: Partial<GuestThread>) {
  await openGuestStore();
  const current = state.memory.get(id);
  if (!current) return null;
  const next = { ...current, ...patch, id };
  state.memory.set(id, next);
  await write();
  return next;
}

export async function deleteMemory(id: string) {
  await openGuestStore();
  state.memory.delete(id);
  await write();
}

export async function listMemories() {
  await openGuestStore();
  return [...state.memory.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function clearAll() {
  await openGuestStore();
  state.memory.clear();
  state.draft = null;
  state.meta = emptyMeta();
  if (state.mode === "indexeddb") {
    const db = await openDb();
    const tx = db.transaction(["memories", "kv"], "readwrite");
    tx.objectStore("memories").clear();
    tx.objectStore("kv").clear();
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("indexeddb"));
    });
    db.close();
  }
}

export async function storageMode() {
  return openGuestStore();
}

export async function getMeta() {
  await openGuestStore();
  return state.meta;
}

export async function setSkipMigration(value: boolean) {
  await openGuestStore();
  state.meta = { ...state.meta, skipMigration: value };
  await write();
}

export async function saveGuestDraft(draft: GuestDraft) {
  await openGuestStore();
  state.draft = draft;
  await write();
}

export async function readGuestDraft() {
  await openGuestStore();
  return state.draft;
}

export async function clearGuestDraft() {
  await openGuestStore();
  state.draft = null;
  await write();
}

export function resetGuestStoreForTests() {
  opening = null;
  state.mode = "none";
  state.memory.clear();
  state.meta = emptyMeta();
  state.draft = null;
}
