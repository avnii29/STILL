import { EmptyState } from "@/components/empty-state";
import { FadeIn } from "@/components/fade-in";
import { requireOnboardedUser } from "@/lib/auth";
import { activityCopy } from "@/lib/copy";
import { isDatabaseConfigured } from "@/lib/env";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ActivityPage() {
  const user = await requireOnboardedUser();
  if (!isDatabaseConfigured()) {
    return <EmptyState title="Activity needs the database." body="Still will not invent agent work." />;
  }

  const prisma = getPrisma();
  const [events, audits, runs] = await Promise.all([
    prisma.threadEvent.findMany({
      where: { userId: user.id },
      include: { thread: { select: { title: true, id: true } } },
      orderBy: { createdAt: "desc" },
      take: 40,
    }),
    prisma.auditLog.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 40,
    }),
    prisma.agentRun.findMany({
      where: { userId: user.id },
      include: { thread: { select: { title: true, id: true } } },
      orderBy: { createdAt: "desc" },
      take: 40,
    }),
  ]);

  const rows = [
    ...events.map((event) => ({
      id: event.id,
      at: event.createdAt,
      title: activityCopy(event.kind),
      body: `${event.thread.title}: ${event.body}`,
    })),
    ...audits.map((audit) => ({
      id: audit.id,
      at: audit.createdAt,
      title: activityCopy(audit.action),
      body: audit.target ?? "",
    })),
    ...runs.map((run) => ({
      id: run.id,
      at: run.createdAt,
      title: `${run.kind.toLowerCase()} ${run.ok ? "ok" : "blocked"}`,
      body: run.thread?.title ?? "",
    })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime());

  return (
    <FadeIn>
      <p className="label mb-6">Activity</p>
      <h1 className="font-display text-[clamp(2.6rem,6vw,5.2rem)] leading-[0.95] tracking-tight">
        What Still actually did.
      </h1>
      <p className="mt-5 max-w-xl text-lg text-ink-soft">
        Every line is a stored event. If this page is empty, Still has not acted yet.
      </p>
      {rows.length === 0 ? (
        <div className="mt-12">
          <EmptyState
            title="No agent activity yet."
            body="When Still notices, checks, or waits for you, it will be written here."
          />
        </div>
      ) : (
        <ol className="mt-14 max-w-2xl space-y-8">
          {rows.map((row) => (
            <li key={row.id}>
              <p className="label">
                {new Intl.DateTimeFormat("en", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(row.at)}
              </p>
              <p className="mt-2 font-display text-2xl tracking-tight">{row.title}</p>
              {row.body ? <p className="mt-2 text-ink-soft">{row.body}</p> : null}
            </li>
          ))}
        </ol>
      )}
    </FadeIn>
  );
}
