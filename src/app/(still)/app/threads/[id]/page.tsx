import Link from "next/link";
import { notFound } from "next/navigation";
import { EvidenceDrawer } from "@/components/evidence-drawer";
import { FadeIn } from "@/components/fade-in";
import { StatusChip } from "@/components/status-chip";
import { ThreadActions } from "@/components/thread-actions";
import { ThreadTimeline } from "@/components/thread-timeline";
import { WhyPanel } from "@/components/why-panel";
import { requireOnboardedUser } from "@/lib/auth";
import { formatQuietDateLong, THREAD_STATUS_COPY } from "@/lib/copy";
import { calendarStatus } from "@/lib/integrations/google";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ThreadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireOnboardedUser();
  const { id } = await params;
  const prisma = getPrisma();
  const thread = await prisma.thread.findFirst({
    where: { id, userId: user.id },
    include: {
      person: true,
      events: { orderBy: { createdAt: "asc" } },
      commitments: { include: { evidenceItems: true } },
      sourceMessage: true,
      conversation: true,
      reminders: { orderBy: { remindAt: "desc" }, take: 5 },
      interventions: { orderBy: { createdAt: "desc" }, take: 5 },
      actionProposals: { orderBy: { createdAt: "asc" } },
      agentRuns: { orderBy: { createdAt: "asc" }, take: 40 },
    },
  });
  if (!thread) notFound();
  const pending = thread.actionProposals.find((item) => item.status === "PENDING" || item.status === "BLOCKED");
  const calendar = calendarStatus(false);
  const commitment = thread.commitments[0];

  return (
    <FadeIn>
      <Link href="/threads" className="text-sm text-ink-soft">
        All threads
      </Link>
      <p className="label mt-10">
        {thread.person ? (
          <Link href={`/app/people/${thread.person.id}`}>{thread.person.name}</Link>
        ) : (
          "Future you"
        )}
      </p>
      <h1 className="mt-4 max-w-3xl font-display text-[clamp(2.6rem,6vw,5.4rem)] leading-[0.95] tracking-tight">
        {thread.title}
      </h1>
      <p className="mt-5 flex flex-wrap items-center gap-3 text-sm text-ink-soft">
        <StatusChip status={thread.status} />
        {thread.dueAt ? <span>due {formatQuietDateLong(thread.dueAt)}</span> : null}
        <span>moved {thread.postponementCount} time{thread.postponementCount === 1 ? "" : "s"}</span>
      </p>
      <ol className="mt-12 max-w-4xl space-y-8">
        <li>
          <p className="label">You said</p>
          <blockquote className="mt-3 border-l border-accent/40 pl-4 text-lg leading-relaxed">
            “{commitment?.evidenceItems[0]?.exactText ?? thread.evidence}”
          </blockquote>
        </li>
        <li>
          <p className="label">Remembered</p>
          <p className="mt-3 font-display text-3xl tracking-tight">{thread.title}</p>
        </li>
        <li>
          <p className="label">When</p>
          <p className="mt-3 text-lg text-ink-soft">
            {thread.dueAt ? formatQuietDateLong(thread.dueAt) : "No time named yet."}
          </p>
        </li>
        <li>
          <p className="label">Where it came from</p>
          <p className="mt-3 text-lg text-ink-soft">{thread.source}</p>
        </li>
        <li>
          <p className="label">Status</p>
          <p className="mt-3 text-lg">{THREAD_STATUS_COPY[thread.status] ?? thread.status}</p>
        </li>
      </ol>
      <ThreadTimeline
        evidence={thread.evidence}
        createdAt={thread.createdAt}
        lastEvidenceAt={thread.lastEvidenceAt}
        currentState={thread.currentState}
        events={thread.events}
        speaker={thread.sourceMessage?.speaker ?? (thread.owner === "SELF" ? "You" : "You")}
      />
      <div id="correct">
      <div id="forget">
      <ThreadActions
        threadId={thread.id}
        suggestedAction={thread.suggestedNextAction}
        wouldContact={thread.owner === "THEM" || thread.owner === "SHARED"}
        futureSelf={thread.owner === "SELF"}
        postponementCount={thread.postponementCount}
        pendingProposal={
          pending
            ? {
                id: pending.id,
                kind: pending.kind,
                reason: pending.reason,
                status: pending.status,
                blockedReason: pending.blockedReason,
                risk: pending.risk,
              }
            : null
        }
      />
      </div>
      </div>
      <EvidenceDrawer
        evidence={thread.evidence}
        source={thread.source}
        timestamp={thread.sourceMessage?.sentAt ?? thread.createdAt}
        interpretedBy={thread.interpretedBy}
        context={thread.context}
        stored={thread.title}
        person={thread.person?.name}
        deadline={thread.dueAt ? formatQuietDateLong(thread.dueAt) : null}
        threadId={thread.id}
      />
      <section id="source" className="mt-16 max-w-4xl">
        <p className="label">You said</p>
        <blockquote className="mt-4 border-l border-accent/40 pl-4 text-lg leading-relaxed">
          “{commitment?.evidenceItems[0]?.exactText ?? thread.evidence}”
        </blockquote>
        <p className="mt-4 text-sm text-ink-soft">
          Original words. Not a summary. Source: {thread.source}.
        </p>
      </section>
      <section className="mt-12 max-w-4xl">
        <p className="label">Reminders</p>
        {thread.reminders.length === 0 ? (
          <p className="mt-3 text-ink-soft">No reminder is scheduled yet.</p>
        ) : (
          <ul className="mt-3 space-y-3 text-ink-soft">
            {thread.reminders.map((reminder) => (
              <li key={reminder.id}>
                {formatQuietDateLong(reminder.remindAt)} · {reminder.status.toLowerCase()} · {reminder.body}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="mt-12 max-w-4xl">
        <p className="label">Interventions</p>
        {thread.interventions.length === 0 ? (
          <p className="mt-3 text-ink-soft">Still has not intervened.</p>
        ) : (
          <ul className="mt-3 space-y-4">
            {thread.interventions.map((item) => (
              <li key={item.id}>
                <p className="font-display text-2xl tracking-tight">{item.suggestedAction}</p>
                <p className="mt-1 text-sm text-ink-soft">{item.reason}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
      <WhyPanel
        evidence={(commitment?.evidenceItems ?? []).map((item) => ({
          id: item.id,
          exactText: item.exactText,
          sourceKind: item.sourceKind,
          createdAt: item.createdAt,
        }))}
        events={thread.events.map((event) => ({
          id: event.id,
          kind: event.kind,
          body: event.body,
          createdAt: event.createdAt,
        }))}
        runs={thread.agentRuns.map((run) => ({
          id: run.id,
          kind: run.kind,
          ok: run.ok,
          confidence: run.confidence,
          provider: run.provider,
          output: run.output,
        }))}
        proposals={thread.actionProposals.map((item) => ({
          id: item.id,
          kind: item.kind,
          status: item.status,
          reason: item.reason,
          risk: item.risk,
          blockedReason: item.blockedReason,
        }))}
        overallConfidence={thread.confidence}
        currentState={thread.currentState}
      />
      <p className="mt-6 max-w-4xl text-sm text-ink-faint">{calendar.message}</p>
    </FadeIn>
  );
}
