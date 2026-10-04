import Link from "next/link";
import { StatusChip } from "@/components/status-chip";
import { quietAgo, formatQuietDate } from "@/lib/copy";

export type EditorialCardData = {
  id: string;
  title: string;
  summary: string;
  status: string;
  lastEvidenceAt: Date | string;
  person?: { id: string; name: string } | null;
  owner?: string;
  href?: string;
  cta?: string;
  deadline?: Date | string | null;
  source?: string;
};

export function EditorialCard({ thread }: { thread: EditorialCardData }) {
  const withLabel =
    thread.owner === "SELF" || !thread.person ? "Future you" : `With ${thread.person.name}`;
  const unresolved =
    thread.status !== "RESOLVED" && thread.status !== "DISMISSED" && thread.status !== "EXPIRED";

  return (
    <article className="border-b border-line py-10 last:border-b-0">
      <p className="label">{withLabel}</p>
      <h2 className="mt-3 max-w-4xl font-display text-[clamp(1.8rem,4vw,3rem)] leading-[1.05] tracking-tight">
        {thread.title}
      </h2>
      <p className="mt-4 flex flex-wrap items-center gap-3 text-sm text-ink-faint">
        <span>{quietAgo(thread.lastEvidenceAt)}</span>
        {thread.deadline ? <span>due {formatQuietDate(thread.deadline)}</span> : null}
        {thread.source ? <span>{thread.source.toLowerCase()}</span> : null}
        {unresolved ? <StatusChip status={thread.status} /> : null}
      </p>
      <Link
        href={thread.href ?? `/threads/${thread.id}`}
        className="mt-6 inline-flex min-h-11 items-center rounded-md border border-line px-4 text-sm"
      >
        {thread.cta ?? (thread.owner === "SELF" ? "Revisit" : "Open")}
      </Link>
    </article>
  );
}
