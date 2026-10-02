import { EmptyState } from "@/components/empty-state";
import { EditorialCard } from "@/components/editorial-card";
import { FadeIn } from "@/components/fade-in";
import { requireOnboardedUser } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function FuturePage() {
  const user = await requireOnboardedUser();
  const prisma = getPrisma();
  const threads = await prisma.thread.findMany({
    where: { userId: user.id, owner: "SELF" },
    include: { person: true },
    orderBy: { lastEvidenceAt: "desc" },
  });

  return (
    <FadeIn>
      <p className="label mb-6">Future self</p>
      <h1 className="font-display text-[clamp(2.6rem,6vw,5.2rem)] leading-[0.95] tracking-tight">
        things you said you would do.
      </h1>
      <p className="mt-5 max-w-xl text-lg text-ink-soft">
        No streaks. No score. Just the promises you made to yourself.
      </p>
      {threads.length === 0 ? (
        <div className="mt-12">
          <EmptyState
            title="Your future self is unburdened."
            body="When you keep a private intention, it will wait here."
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
                cta: "Revisit",
              }}
            />
          ))}
        </div>
      )}
    </FadeIn>
  );
}
