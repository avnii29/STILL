import type { CommitmentDetection } from "@/lib/sources/detect";

type Matchable = {
  id: string;
  title: string;
  evidence: string;
  personName?: string | null;
};

function tokens(value: string) {
  const stems: Record<string, string> = {
    sent: "send",
    sending: "send",
    emailed: "email",
    called: "call",
    finished: "finish",
    submitted: "submit",
  };
  return new Set(
    value
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 2)
      .map((word) => stems[word] ?? word),
  );
}

export function threadMatchScore(thread: Matchable, detection: CommitmentDetection) {
  let score = 0;
  if (
    detection.target_person &&
    thread.personName &&
    detection.target_person.toLowerCase() === thread.personName.toLowerCase()
  ) {
    score += 0.4;
  }
  const left = tokens(`${thread.title} ${thread.evidence}`);
  const right = tokens(`${detection.normalized_commitment} ${detection.evidence_span}`);
  if (left.size === 0 || right.size === 0) return score;
  let overlap = 0;
  for (const word of right) {
    if (left.has(word)) overlap += 1;
  }
  score += Math.min(0.5, overlap / Math.max(4, right.size));
  return score;
}

export function bestThreadMatch(threads: Matchable[], detection: CommitmentDetection) {
  let best: { thread: Matchable; score: number } | null = null;
  for (const thread of threads) {
    const score = threadMatchScore(thread, detection);
    if (!best || score > best.score) best = { thread, score };
  }
  if (!best) return null;
  if (best.score >= 0.5) return { ...best, certainty: "STRONG" as const };
  if (best.score >= 0.32) return { ...best, certainty: "UNCERTAIN" as const };
  return null;
}
