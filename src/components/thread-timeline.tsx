import { formatQuietDateLong } from "@/lib/copy";

type EventRow = {
  id: string;
  kind: string;
  body: string;
  createdAt: Date;
};

export function ThreadTimeline({
  evidence,
  createdAt,
  lastEvidenceAt,
  currentState,
  events,
  speaker,
}: {
  evidence: string;
  createdAt: Date;
  lastEvidenceAt: Date;
  currentState: string;
  events: EventRow[];
  speaker: string;
}) {
  return (
    <ol className="mt-16 max-w-2xl space-y-10">
      <li>
        <p className="label">{formatQuietDateLong(createdAt)}</p>
        <p className="mt-3 text-sm text-ink-faint">{speaker}</p>
        <blockquote className="mt-2 font-display text-3xl leading-snug tracking-tight">
          “{evidence}”
        </blockquote>
      </li>
      {events
        .filter((event) => event.kind !== "DETECTED")
        .map((event) => (
          <li key={event.id}>
            <p className="label">{formatQuietDateLong(event.createdAt)}</p>
            <p className="mt-3 text-lg leading-relaxed text-ink-soft">{event.body}</p>
          </li>
        ))}
      {events.length <= 1 ? (
        <li>
          <p className="label">{formatQuietDateLong(lastEvidenceAt)}</p>
          <p className="mt-3 text-lg text-ink-soft">No later evidence of resolution.</p>
        </li>
      ) : null}
      <li>
        <p className="label">Still</p>
        <p className="mt-3 font-display text-2xl tracking-tight">{currentState}</p>
      </li>
    </ol>
  );
}
