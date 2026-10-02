import Link from "next/link";
import { CandidateCard } from "@/components/candidate-card";
import { EmptyState, TextLink } from "@/components/empty-state";
import { FadeIn } from "@/components/fade-in";
import { requireOnboardedUser } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function NoticedPage() {
  const user = await requireOnboardedUser();
  const prisma = getPrisma();
  const pending = await prisma.memoryCandidate.findMany({
    where: { userId: user.id, status: "PENDING" },
    orderBy: { createdAt: "desc" },
  });

  const clear = pending.filter(
    (item) => item.classification === "COMMITMENT" || item.classification === "REMINDER_REQUEST",
  );
  const maybe = pending.filter((item) => item.classification === "POSSIBLE_COMMITMENT");
  const resolution = pending.filter((item) => item.classification === "RESOLUTION_SIGNAL");

  return (
    <FadeIn>
      <p className="label mb-6">Noticed</p>
      <h1 className="font-display text-[clamp(2.6rem,6vw,5.2rem)] leading-[0.95] tracking-tight">
        STILL noticed something.
      </h1>
      <p className="mt-5 max-w-xl text-lg text-ink-soft">
        Uncertain detections wait here. Remember, ignore, or correct. Your choices change what STILL
        keeps for you. They are not described as training a foundation model.
      </p>

      {pending.length === 0 ? (
        <div className="mt-12">
          <EmptyState
            title="Nothing is waiting."
            body="When an authorized source produces a possible commitment, it will sit here quietly."
            action={<TextLink href="/home">Back to today</TextLink>}
          />
        </div>
      ) : (
        <>
          <NoticedGroup title="Clear" items={clear} />
          <NoticedGroup title="Maybe" items={maybe} />
          <NoticedGroup title="Resolution" items={resolution} />
        </>
      )}
      <p className="mt-16 text-sm">
        <Link href="/home">Back to today</Link>
      </p>
    </FadeIn>
  );
}

function NoticedGroup({
  title,
  items,
}: {
  title: string;
  items: Array<{
    id: string;
    normalizedCommitment: string;
    targetPerson: string | null;
    deadline: string | null;
    evidenceSpan: string;
    classification: string;
    dueAt: Date | null;
  }>;
}) {
  return (
    <section className="mt-14 border-t border-line pt-10">
      <h2 className="font-display text-3xl tracking-tight">{title}</h2>
      {items.length === 0 ? (
        <p className="mt-4 text-ink-soft">Nothing in this group.</p>
      ) : (
        items.map((candidate) => (
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
        ))
      )}
    </section>
  );
}
