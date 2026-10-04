import { formatQuietDateLong } from "@/lib/copy";

type EvidenceItem = {
  id: string;
  exactText: string;
  sourceKind: string;
  createdAt: Date;
};

type ThreadEventRow = {
  id: string;
  kind: string;
  body: string;
  createdAt: Date;
};

type AgentRunRow = {
  id: string;
  kind: string;
  ok: boolean;
  confidence: number;
  provider: string;
  output: unknown;
};

type ProposalRow = {
  id: string;
  kind: string;
  status: string;
  reason: string;
  risk: string;
  blockedReason: string | null;
};

const DECISIONS: Record<string, string> = {
  DETECTED: "Detected",
  EVIDENCE_STORED: "Evidence stored",
  REMINDER_SCHEDULED: "Reminder scheduled",
  INTERVENTION_PROPOSED: "Move proposed",
  CALENDAR_UPDATED: "Calendar move approved",
  DEADLINE_CHANGED: "Deadline moved",
  RESOLUTION_PROPOSED: "Resolution paused for approval",
  RESOLVED: "Resolved",
  DISMISSED: "Dismissed",
  PROPOSAL_REJECTED: "Proposal rejected",
  PROPOSAL_EDITED: "Proposal edited",
  POSTPONED: "Postponed",
  ACTION_BLOCKED: "Blocked",
};

export function WhyPanel({
  evidence,
  events,
  runs,
  proposals,
  overallConfidence,
  currentState,
}: {
  evidence: EvidenceItem[];
  events: ThreadEventRow[];
  runs: AgentRunRow[];
  proposals: ProposalRow[];
  overallConfidence: number;
  currentState?: string | null;
}) {
  const decisions = events.filter((event) => DECISIONS[event.kind]);
  const pending = proposals.filter((item) => item.status === "PENDING" || item.status === "BLOCKED");
  const redTeam = [...runs].reverse().find((run) => run.kind === "RED_TEAM");
  const red = readRedTeam(redTeam?.output);
  const risk = proposals.find((item) => item.risk)?.risk ?? "low";
  const modelRan = runs.some((run) => run.provider.startsWith("openai") || run.provider.startsWith("anthropic") || run.provider.startsWith("model"));

  return (
    <section id="why" className="mt-16 max-w-4xl">
      <p className="label">Why</p>
      <div className="mt-4 space-y-8 rounded-md border border-line bg-paper p-5">
        <div>
          <p className="label">Decision</p>
          {currentState ? <p className="mt-3 text-ink">{currentState}</p> : null}
          {decisions.length === 0 ? (
            <p className="mt-3 text-ink-soft">Nothing has been decided on this thread yet.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {decisions.map((event) => (
                <li key={event.id}>
                  <p className="text-ink">{DECISIONS[event.kind]}</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-ink-soft">{event.body}</p>
                  <p className="mt-1 text-sm text-ink-faint">{formatQuietDateLong(event.createdAt)}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <p className="label">Evidence used</p>
          {evidence.length === 0 ? (
            <p className="mt-3 text-ink-soft">No original sentence is stored.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {evidence.map((item) => (
                <li key={item.id}>
                  <blockquote className="border-l border-accent/40 pl-4 text-ink">“{item.exactText}”</blockquote>
                  <p className="mt-1 text-sm text-ink-soft">
                    {item.sourceKind} · {formatQuietDateLong(item.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <p className="label">Records retrieved</p>
          <p className="mt-3 text-ink-soft">
            {evidence.length} evidence record{evidence.length === 1 ? "" : "s"} on this thread.
            {modelRan
              ? " A model ran. Retrieved-record counts were not stored."
              : " No model retrieval. This used the words already on the thread."}
          </p>
        </div>
        <div>
          <p className="label">Confidence</p>
          <p className="mt-3 text-ink">Overall {overallConfidence.toFixed(2)}</p>
          {runs.length === 0 ? (
            <p className="mt-2 text-sm text-ink-soft">No step is stored yet.</p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm text-ink-soft">
              {runs.map((run) => (
                <li key={run.id}>
                  {run.kind} · {run.ok ? "ok" : "blocked"} · {run.confidence.toFixed(2)} · {run.provider}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <p className="label">Risk</p>
          <p className="mt-3 text-ink-soft">
            Action risk {risk}.
            {red
              ? red.allowed
                ? " Red team allowed the proposal."
                : ` Red team blocked it. ${red.blockedReason ?? ""}`
              : " No red-team check is stored yet."}
          </p>
        </div>
        <div>
          <p className="label">Paused for approval</p>
          {pending.length === 0 ? (
            <p className="mt-3 text-ink-soft">Nothing is waiting.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {pending.map((item) => (
                <li key={item.id}>
                  <p className="text-ink">
                    {item.kind} · {item.status}
                  </p>
                  <p className="mt-1 text-sm text-ink-soft">{item.reason}</p>
                  {item.blockedReason ? <p className="mt-1 text-sm text-ink-soft">{item.blockedReason}</p> : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

function readRedTeam(output: unknown) {
  if (!output || typeof output !== "object" || Array.isArray(output)) return null;
  const value = output as { allowed?: unknown; blockedReason?: unknown };
  if (typeof value.allowed !== "boolean") return null;
  return {
    allowed: value.allowed,
    blockedReason: typeof value.blockedReason === "string" ? value.blockedReason : undefined,
  };
}
