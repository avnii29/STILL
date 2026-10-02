import Link from "next/link";
import { notFound } from "next/navigation";
import { EditorialCard } from "@/components/editorial-card";
import { EmptyState } from "@/components/empty-state";
import { FadeIn } from "@/components/fade-in";
import { requireOnboardedUser } from "@/lib/auth";
import { formatQuietDateLong } from "@/lib/copy";
import { getPrisma } from "@/lib/prisma";
import { initials } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function PersonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireOnboardedUser();
  const { id } = await params;
  const prisma = getPrisma();
  const person = await prisma.person.findFirst({
    where: { id, userId: user.id },
    include: { threads: { orderBy: { lastEvidenceAt: "desc" } } },
  });
  if (!person) notFound();

  const open = person.threads.filter((thread) =>
    [
      "DETECTED",
      "NEEDS_REVIEW",
      "OPEN",
      "APPROACHING",
      "POSTPONED",
      "WAITING_ON_ME",
      "WAITING_ON_THEM",
      "CHANGED",
    ].includes(thread.status),
  );
  const last = person.threads[0]?.lastEvidenceAt;
  const resolved = person.threads.filter((thread) =>
    ["RESOLVED", "LIKELY_RESOLVED", "DISMISSED", "EXPIRED"].includes(thread.status),
  );

  return (
    <FadeIn>
      <Link href="/people" className="text-sm text-ink-soft">
        All people
      </Link>
      <div className="mt-8 flex items-center gap-5">
        <span className="flex size-16 items-center justify-center rounded-full border border-line font-display text-2xl">
          {initials(person.name)}
        </span>
        <div>
          <h1 className="font-display text-[clamp(2.6rem,6vw,5rem)] leading-[0.95] tracking-tight">
            {person.name}
          </h1>
          <p className="mt-2 text-ink-soft">
            {open.length === 0
              ? "Nothing hanging with them right now."
              : open.length === 1
                ? "1 open thread"
                : `${open.length} open threads`}
          </p>
        </div>
      </div>
      {person.howYouKnowThem ? (
        <p className="mt-6 max-w-xl text-lg text-ink-soft">{person.howYouKnowThem}</p>
      ) : (
        <p className="mt-6 max-w-xl text-lg text-ink-soft">
          Still does not infer who this person is to you.
        </p>
      )}
      <p className="mt-4 text-sm text-ink-faint">
        Last meaningful interaction {last ? formatQuietDateLong(last) : "is not recorded yet."}
      </p>
      {open.length > 0 ? (
        <section className="mt-10">
          <h2 className="label">Open</h2>
          <ul className="mt-4 max-w-xl space-y-2 text-lg">
            {open.map((thread) => (
              <li key={thread.id}>
                <Link href={`/threads/${thread.id}`}>{thread.title}</Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {resolved.length > 0 ? (
        <section className="mt-10">
          <h2 className="label">Resolved</h2>
          <ul className="mt-4 max-w-xl space-y-2 text-lg text-ink-soft">
            {resolved.map((thread) => (
              <li key={thread.id}>
                <Link href={`/threads/${thread.id}`}>{thread.title}</Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {person.threads.length === 0 ? (
        <div className="mt-12">
          <EmptyState
            title="Nothing hanging with them right now."
            body="When an unfinished conversation appears, it will live here."
          />
        </div>
      ) : (
        <div className="mt-10">
          <p className="label mb-2">Timeline</p>
          {person.threads.map((thread) => (
            <EditorialCard
              key={thread.id}
              thread={{
                id: thread.id,
                title: thread.title,
                summary: thread.summary,
                status: thread.status,
                lastEvidenceAt: thread.lastEvidenceAt,
                person: { id: person.id, name: person.name },
                owner: thread.owner,
              }}
            />
          ))}
        </div>
      )}
    </FadeIn>
  );
}
