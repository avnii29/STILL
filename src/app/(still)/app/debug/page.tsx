import { EmptyState } from "@/components/empty-state";
import { FadeIn } from "@/components/fade-in";
import { requireOnboardedUser } from "@/lib/auth";
import { isDatabaseConfigured } from "@/lib/env";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function DebugPage() {
  const user = await requireOnboardedUser();
  if (!isDatabaseConfigured()) {
    return <EmptyState title="Debug needs the database." body="Still will not invent agent runs." />;
  }
  const prisma = getPrisma();
  const runs = await prisma.agentRun.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 40,
    include: { thread: { select: { title: true } } },
  });

  return (
    <FadeIn>
      <p className="label mb-6">Engine</p>
      <h1 className="font-display text-[clamp(2.6rem,6vw,5.2rem)] leading-[0.95] tracking-tight">
        What the agents returned.
      </h1>
      <p className="mt-5 max-w-xl text-lg text-ink-soft">
        Decision, evidence count, and confidence. Hidden reasoning stays hidden.
      </p>
      {runs.length === 0 ? (
        <div className="mt-12">
          <EmptyState title="No agent runs yet." body="Capture something you actually said." />
        </div>
      ) : (
        <ol className="mt-12 max-w-4xl space-y-6">
          {runs.map((run) => {
            const output = run.output as { decision?: string; confidence?: number };
            return (
              <li key={run.id}>
                <p className="label">
                  {run.ok ? "ok" : "stopped"} · {run.kind}
                  {run.thread?.title ? ` · ${run.thread.title}` : ""}
                </p>
                <p className="mt-2 font-display text-2xl tracking-tight">
                  {output.decision ?? run.kind.toLowerCase()}
                </p>
                <p className="mt-1 text-sm text-ink-faint">{Math.round(run.confidence * 100)}%</p>
              </li>
            );
          })}
        </ol>
      )}
    </FadeIn>
  );
}
