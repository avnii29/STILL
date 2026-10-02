import Link from "next/link";
import { EmptyState, TextLink } from "@/components/empty-state";
import { FadeIn } from "@/components/fade-in";
import { requireOnboardedUser } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";
import { initials } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function PeoplePage() {
  const user = await requireOnboardedUser();
  const prisma = getPrisma();
  const people = await prisma.person.findMany({
    where: { userId: user.id },
    include: {
      threads: {
        select: { id: true, title: true, lastEvidenceAt: true, status: true },
        orderBy: { lastEvidenceAt: "desc" },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <FadeIn>
      <p className="label mb-6">People</p>
      <h1 className="font-display text-[clamp(2.6rem,6vw,5.2rem)] leading-[0.95] tracking-tight">
        What do I still owe this person?
      </h1>
      <p className="mt-5 max-w-xl text-lg text-ink-soft">
        People appear from commitments. STILL does not score closeness or infer feelings.
      </p>
      {people.length === 0 ? (
        <div className="mt-12">
          <EmptyState
            title="Still hasn't met anyone here yet."
            body="People appear when you keep a conversation or a name."
            action={<TextLink href="/capture">Bring in a conversation</TextLink>}
          />
        </div>
      ) : (
        <ul className="mt-12 divide-y divide-line">
          {people.map((person) => {
            const hanging = [
              "DETECTED",
              "NEEDS_REVIEW",
              "OPEN",
              "APPROACHING",
              "POSTPONED",
              "WAITING_ON_ME",
              "WAITING_ON_THEM",
              "CHANGED",
            ];
            const open = person.threads.filter((thread) => hanging.includes(thread.status)).length;
            const resolved = person.threads.filter((thread) =>
              ["RESOLVED", "LIKELY_RESOLVED", "DISMISSED", "EXPIRED"].includes(thread.status),
            ).length;
            return (
              <li key={person.id}>
                <Link href={`/people/${person.id}`} className="flex gap-5 py-8">
                  <span className="flex size-14 shrink-0 items-center justify-center rounded-full border border-line font-display text-lg">
                    {initials(person.name)}
                  </span>
                  <span>
                    <h2 className="font-display text-3xl tracking-tight">{person.name}</h2>
                    <p className="mt-2 text-sm text-ink-soft">
                      {`OPEN ${open} · RESOLVED ${resolved}`}
                    </p>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </FadeIn>
  );
}
