import type { Extraction } from "@/lib/agents/extract";
import { heuristicResolution } from "@/lib/agents/resolution-agent";
import type { GuestThread } from "@/lib/guest/types";

const STOP = new Set([
  "the",
  "and",
  "for",
  "you",
  "your",
  "her",
  "him",
  "his",
  "she",
  "they",
  "them",
  "this",
  "that",
  "with",
  "from",
  "will",
  "i'll",
  "ill",
  "actually",
  "instead",
  "about",
  "have",
  "been",
]);

function stem(word: string) {
  if (word.endsWith("ing") && word.length > 5) return word.slice(0, -3);
  if (word.endsWith("ed") && word.length > 4) return word.slice(0, -2);
  if (word.endsWith("es") && word.length > 4) return word.slice(0, -2);
  if (word.endsWith("s") && word.length > 4) return word.slice(0, -1);
  return word;
}

export function significantTokens(text: string) {
  return [...new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s']/g, " ")
      .split(/\s+/)
      .map(stem)
      .filter((word) => word.length >= 3 && !STOP.has(word)),
  )];
}

function overlap(a: string[], b: string[]) {
  return a.filter((token) => b.includes(token));
}

export function liveThreads(threads: GuestThread[]) {
  return threads.filter((thread) => thread.status !== "DISMISSED" && thread.status !== "RESOLVED");
}

export function shouldOfferLongTermKeep(threads: GuestThread[]) {
  return liveThreads(threads).length >= 3;
}

export function findConnectedThread(
  note: string,
  extraction: Extraction,
  threads: GuestThread[],
): { thread: GuestThread; kind: "update" | "resolve" } | null {
  const open = liveThreads(threads);
  if (open.length === 0) return null;

  const incoming = significantTokens(`${note} ${extraction.normalized_commitment} ${extraction.person ?? ""}`);
  const doneCue = /\b(called|sent|done|finished|submitted|paid)\b/i.test(note);
  const updateCue = /\b(instead|changed|change it|move it)\b/i.test(note);

  let best: { thread: GuestThread; score: number; kind: "update" | "resolve" } | null = null;

  for (const thread of open) {
    const existing = significantTokens(`${thread.note} ${thread.title} ${thread.person ?? ""} ${thread.deadline ?? ""}`);
    const shared = overlap(incoming, existing);
    const samePerson =
      Boolean(extraction.person && thread.person) &&
      extraction.person?.toLowerCase() === thread.person?.toLowerCase();
    const score = shared.length + (samePerson ? 2 : 0);
    if (score < 1) continue;

    const look = heuristicResolution({
      original: thread.evidence,
      laterMessages: [note],
    });
    const kind: "update" | "resolve" =
      (look.likelyResolved || doneCue) && look.kind !== "SUPERSEDED" && !updateCue
        ? "resolve"
        : updateCue || look.kind === "SUPERSEDED"
          ? "update"
          : score >= 2
            ? "update"
            : "resolve";

    if (!best || score > best.score) {
      best = { thread, score, kind };
    }
  }

  if (!best) return null;
  if (best.kind === "resolve" && !doneCue && best.score < 2) return null;
  if (best.kind === "update" && best.score < 1) return null;
  return { thread: best.thread, kind: best.kind };
}
