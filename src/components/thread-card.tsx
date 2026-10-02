import Link from "next/link";
import { StatusChip } from "@/components/status-chip";
import { COMMITMENT_TYPE_COPY, formatQuietDate } from "@/lib/copy";

export type ThreadCardData = {
  id: string;
  title: string;
  summary: string;
  status: string;
  commitmentType: string;
  lastEvidenceAt: Date | string;
  person?: { id: string; name: string } | null;
};

export function ThreadCard({ thread }: { thread: ThreadCardData }) {
  return (
    <Link
      href={`/threads/${thread.id}`}
      className="group block border-b border-line py-7 transition-colors last:border-b-0 focus-visible:bg-paper/70"
    >
      <div className="flex flex-wrap items-center gap-3">
        <StatusChip status={thread.status} />
        <span className="text-[0.72rem] tracking-[0.16em] uppercase text-ink-faint">
          {COMMITMENT_TYPE_COPY[thread.commitmentType] ?? "a thread"}
        </span>
        <span className="ml-auto text-sm text-ink-faint">
          {formatQuietDate(thread.lastEvidenceAt)}
        </span>
      </div>
      <h3 className="mt-3 font-display text-3xl leading-tight tracking-tight text-ink group-hover:text-accent">
        {thread.title}
      </h3>
      <p className="mt-2 max-w-2xl text-base leading-relaxed text-ink-soft">{thread.summary}</p>
      {thread.person ? (
        <p className="mt-3 text-sm text-ink-faint">with {thread.person.name}</p>
      ) : (
        <p className="mt-3 text-sm text-ink-faint">to yourself</p>
      )}
    </Link>
  );
}
