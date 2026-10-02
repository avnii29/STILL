import { EditorialCard } from "@/components/editorial-card";
import { EmptyState } from "@/components/empty-state";
import { FadeIn } from "@/components/fade-in";
import { SearchForm } from "@/components/search-form";
import { requireOnboardedUser } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const user = await requireOnboardedUser();
  const { q } = await searchParams;
  const query = q?.trim() ?? "";
  const prisma = getPrisma();

  const threads =
    query.length >= 2
      ? await prisma.thread.findMany({
          where: {
            userId: user.id,
            OR: [
              { title: { contains: query, mode: "insensitive" } },
              { evidence: { contains: query, mode: "insensitive" } },
              { summary: { contains: query, mode: "insensitive" } },
              { person: { name: { contains: query, mode: "insensitive" } } },
            ],
          },
          include: { person: true },
          orderBy: { lastEvidenceAt: "desc" },
          take: 40,
        })
      : [];

  return (
    <FadeIn>
      <p className="label mb-6">Search</p>
      <h1 className="font-display text-[clamp(2.6rem,6vw,5.2rem)] leading-[0.95] tracking-tight">
        Find what still matters.
      </h1>
      <div className="mt-10">
        <SearchForm defaultValue={query} />
      </div>
      {query.length > 0 && query.length < 2 ? (
        <p className="mt-8 text-ink-soft">A little more wording helps.</p>
      ) : null}
      {query.length >= 2 && threads.length === 0 ? (
        <div className="mt-12">
          <EmptyState
            title="Nothing here matches that."
            body="Still only searches what you have actually kept."
          />
        </div>
      ) : (
        <div className="mt-8">
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
              }}
            />
          ))}
        </div>
      )}
    </FadeIn>
  );
}
