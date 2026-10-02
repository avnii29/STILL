import { EmptyState, TextLink } from "@/components/empty-state";
import { EditorialCard } from "@/components/editorial-card";
import { FadeIn } from "@/components/fade-in";
import { requireOnboardedUser } from "@/lib/auth";
import { sourceDisplayName } from "@/lib/copy";
import { getPrisma } from "@/lib/prisma";
import Link from "next/link";
import type { ThreadStatus } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

const VIEWS: { id: string; label: string; statuses?: ThreadStatus[]; owner?: "SELF" }[] = [
  { id: "all", label: "All" },
  {
    id: "open",
    label: "Open",
    statuses: ["DETECTED", "NEEDS_REVIEW", "OPEN", "WAITING_ON_ME", "APPROACHING", "POSTPONED"],
  },
  { id: "waiting", label: "Waiting", statuses: ["WAITING_ON_ME", "WAITING_ON_THEM"] },
  { id: "changed", label: "Changed", statuses: ["CHANGED", "POSTPONED", "APPROACHING"] },
  { id: "resolved", label: "Resolved", statuses: ["RESOLVED", "LIKELY_RESOLVED", "DISMISSED", "EXPIRED"] },
  { id: "future", label: "Future self", owner: "SELF" },
];

export default async function ThreadsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const user = await requireOnboardedUser();
  const { view = "all" } = await searchParams;
  const current = VIEWS.find((item) => item.id === view) ?? VIEWS[0];
  const prisma = getPrisma();
  const threads = await prisma.thread.findMany({
    where: {
      userId: user.id,
      ...(current?.statuses ? { status: { in: current.statuses } } : {}),
      ...(current?.owner ? { owner: current.owner } : {}),
    },
    include: { person: true },
    orderBy: { lastEvidenceAt: "desc" },
  });

  return (
    <FadeIn>
      <p className="label mb-6">Threads</p>
      <h1 className="font-display text-[clamp(2.6rem,6vw,5.2rem)] leading-[0.95] tracking-tight">
        Unfinished conversations.
      </h1>
      <nav className="mt-8 flex flex-wrap gap-4 text-sm">
        {VIEWS.map((item) => (
          <Link
            key={item.id}
            href={item.id === "all" ? "/threads" : `/threads?view=${item.id}`}
            className={item.id === current?.id ? "text-ink" : "text-ink-faint"}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      {threads.length === 0 ? (
        <div className="mt-12">
          <EmptyState
            title="Nothing is hanging right now."
            body="When a real promise, plan, or reminder appears, it will live here."
            action={<TextLink href="/capture">Remember something</TextLink>}
          />
        </div>
      ) : (
        <div className="mt-10">
          {threads.map((thread) => (
            <EditorialCard
              key={thread.id}
              thread={{
                id: thread.id,
                title: thread.title,
                summary: thread.summary,
                status: thread.status,
                lastEvidenceAt: thread.lastEvidenceAt,
                person: thread.person,
                owner: thread.owner,
                deadline: thread.dueAt,
                source: sourceDisplayName(thread.source),
              }}
            />
          ))}
        </div>
      )}
    </FadeIn>
  );
}
