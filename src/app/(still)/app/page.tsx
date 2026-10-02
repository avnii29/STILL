import Link from "next/link";
import { CandidateCard } from "@/components/candidate-card";
import { EmptyState, TextLink } from "@/components/empty-state";
import { FadeIn } from "@/components/fade-in";
import { requireOnboardedUser } from "@/lib/auth";
import { greetingForHour, hourInTimezone, sourceDisplayName } from "@/lib/copy";
import { isDatabaseConfigured } from "@/lib/env";
import { getPrisma } from "@/lib/prisma";
import { formatQuietDate } from "@/lib/copy";

export const dynamic = "force-dynamic";

const HANGING = [
  "DETECTED",
  "NEEDS_REVIEW",
  "OPEN",
  "APPROACHING",
  "POSTPONED",
  "WAITING_ON_ME",
  "WAITING_ON_THEM",
  "CHANGED",
] as const;

function needsYouNow(thread: { status: string; dueAt: Date | null }, now: Date) {
  if (thread.status === "NEEDS_REVIEW" || thread.status === "APPROACHING") return true;
  if (!thread.dueAt) return false;
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return thread.dueAt.getTime() < end.getTime();
}

export default async function AppHomePage() {
  const user = await requireOnboardedUser();
  if (!isDatabaseConfigured()) {
    return (
      <EmptyState
        title="Still cannot reach the database yet."
        body="Add DATABASE_URL and try again. Nothing has been invented in the meantime."
      />
    );
  }

  const prisma = getPrisma();
  const [hanging, pending] = await Promise.all([
    prisma.thread.findMany({
      where: { userId: user.id, status: { in: [...HANGING] } },
      include: { person: true },
      orderBy: [{ dueAt: "asc" }, { lastEvidenceAt: "desc" }],
    }),
    prisma.memoryCandidate.findMany({
      where: { userId: user.id, status: "PENDING" },
      orderBy: { createdAt: "desc" },
      take: 4,
    }),
  ]);

  const hour = hourInTimezone(user.timezone);
  const now = new Date();
  const needs = hanging.filter((thread) => needsYouNow(thread, now));
  const waiting = hanging.filter((thread) => !needsYouNow(thread, now));

  return (
    <FadeIn>
      <p className="label">today.</p>
      <h1 className="mt-4 font-display text-[clamp(3rem,8vw,6.4rem)] leading-[0.9] tracking-[-0.03em]">
        {greetingForHour(hour)}
      </h1>

      {pending.length > 0 ? (
        <section className="mt-14">
          <p className="label">
            <Link href="/noticed">STILL noticed something.</Link>
          </p>
          {pending.map((candidate) => (
            <CandidateCard
              key={candidate.id}
              id={candidate.id}
              title={candidate.normalizedCommitment}
              person={candidate.targetPerson}
              deadline={candidate.deadline}
              evidence={candidate.evidenceSpan}
              classification={candidate.classification}
              askWhen={!candidate.dueAt && candidate.classification === "REMINDER_REQUEST"}
            />
          ))}
        </section>
      ) : null}

      {hanging.length === 0 && pending.length === 0 ? (
        <div className="mt-16">
          <EmptyState
            title="nothing is hanging right now."
            body="When you keep a real conversation or a promise you meant, it will wait here."
            action={<TextLink href="/capture">Remember something</TextLink>}
          />
        </div>
      ) : (
        <div className="mt-16">
          {needs.length > 0 ? (
            <section>
              <h2 className="font-display text-3xl tracking-tight">
                {needs.length === 1 ? "one thing needs you." : `${needs.length} things need you.`}
              </h2>
              <ol className="mt-8">
                {needs.map((thread) => (
                  <li key={thread.id} className="border-b border-line py-8">
                    <p className="label">
                      {thread.person ? thread.person.name : "you"}
                      {thread.dueAt ? ` · ${formatQuietDate(thread.dueAt)}` : ""}
                      {thread.source ? ` · ${sourceDisplayName(thread.source)}` : ""}
                    </p>
                    <Link
                      href={`/threads/${thread.id}`}
                      className="thread-need mt-3 block font-display leading-[1.05] tracking-tight"
                    >
                      {thread.title}
                    </Link>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}
          {waiting.length > 0 ? (
            <section className={needs.length > 0 ? "mt-16" : ""}>
              <h2 className="font-display text-2xl tracking-tight text-ink-soft">
                {waiting.length === 1 ? "one thing can wait." : `${waiting.length} things can wait.`}
              </h2>
              <ol className="mt-6">
                {waiting.map((thread) => (
                  <li key={thread.id} className="border-b border-line py-6">
                    <Link
                      href={`/threads/${thread.id}`}
                      className="thread-wait block font-display leading-tight tracking-tight"
                    >
                      {thread.title}
                    </Link>
                    <p className="mt-2 text-sm text-ink-soft">
                      {thread.person ? thread.person.name : "you"}
                      {thread.dueAt ? ` · ${formatQuietDate(thread.dueAt)}` : ""}
                    </p>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}
        </div>
      )}
    </FadeIn>
  );
}
