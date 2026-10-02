import type { ReactNode } from "react";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { FadeIn } from "@/components/fade-in";
import { SearchForm } from "@/components/search-form";
import { requireOnboardedUser } from "@/lib/auth";
import { quietAgo } from "@/lib/copy";
import { isDatabaseConfigured } from "@/lib/env";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function MemoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const user = await requireOnboardedUser();
  if (!isDatabaseConfigured()) {
    return <EmptyState title="Memory needs the database." body="Nothing is being invented while it is away." />;
  }
  const { q } = await searchParams;
  const query = q?.trim() ?? "";
  const prisma = getPrisma();
  const where = query
    ? {
        userId: user.id,
        OR: [
          { title: { contains: query, mode: "insensitive" as const } },
          { evidence: { contains: query, mode: "insensitive" as const } },
          { summary: { contains: query, mode: "insensitive" as const } },
          { person: { name: { contains: query, mode: "insensitive" as const } } },
        ],
      }
    : { userId: user.id };

  const [threads, people] = await Promise.all([
    prisma.thread.findMany({
      where,
      include: { person: true },
      orderBy: { lastEvidenceAt: "desc" },
    }),
    prisma.person.findMany({ where: { userId: user.id }, orderBy: { updatedAt: "desc" } }),
  ]);

  const open = threads.filter(
    (thread) => !["RESOLVED", "DISMISSED", "EXPIRED"].includes(thread.status),
  );
  const resolved = threads.filter((thread) =>
    ["RESOLVED", "DISMISSED", "EXPIRED"].includes(thread.status),
  );

  return (
    <FadeIn>
      <p className="label mb-6">Memory</p>
      <h1 className="font-display text-[clamp(2.6rem,6vw,5.2rem)] leading-[0.95] tracking-tight">
        What did I promise?
      </h1>
      <p className="mt-5 max-w-xl text-lg text-ink-soft">
        Past threads, quieter once resolved. Search only your evidence-backed memories.
      </p>
      <div className="mt-8">
        <SearchForm defaultValue={query} action="/memory" />
      </div>

      <MemoryGroup title="Still open" empty={query ? "Nothing matched." : "No open memories."}>
        {open.map((thread) => (
          <MemoryItem
            key={thread.id}
            title={thread.title}
            why={thread.evidence}
            href={`/threads/${thread.id}`}
            meta={quietAgo(thread.lastEvidenceAt)}
            quiet={false}
          />
        ))}
      </MemoryGroup>

      <MemoryGroup title="Resolved" empty="Nothing resolved yet.">
        {resolved.map((thread) => (
          <MemoryItem
            key={thread.id}
            title={thread.title}
            why={thread.evidence}
            href={`/threads/${thread.id}`}
            meta={thread.status.toLowerCase()}
            quiet
          />
        ))}
      </MemoryGroup>

      <MemoryGroup title="People" empty="No people yet. STILL does not invent them.">
        {people.map((person) => (
          <MemoryItem
            key={person.id}
            title={person.name}
            why={person.howYouKnowThem || person.notes || "They appeared because you named them."}
            href={`/people/${person.id}`}
          />
        ))}
      </MemoryGroup>
    </FadeIn>
  );
}

function MemoryGroup({
  title,
  empty,
  children,
}: {
  title: string;
  empty: string;
  children: ReactNode;
}) {
  const items = Array.isArray(children) ? children.filter(Boolean) : children;
  const count = Array.isArray(children) ? children.filter(Boolean).length : children ? 1 : 0;
  return (
    <section className="mt-16 border-t border-line pt-10">
      <h2 className="font-display text-3xl tracking-tight">{title}</h2>
      {count === 0 ? <p className="mt-4 text-ink-soft">{empty}</p> : <div className="mt-6">{items}</div>}
    </section>
  );
}

function MemoryItem({
  title,
  why,
  href,
  meta,
  quiet,
}: {
  title: string;
  why: string;
  href: string;
  meta?: string | null;
  quiet?: boolean;
}) {
  return (
    <article className={`border-b border-line py-8 last:border-b-0 ${quiet ? "opacity-70" : ""}`}>
      <h3 className="font-display text-2xl tracking-tight">{title}</h3>
      {meta ? <p className="mt-2 text-sm text-ink-soft">{meta}</p> : null}
      <p className="mt-3 max-w-2xl text-ink-soft">
        <span className="label mr-2">Why</span>
        {why}
      </p>
      <div className="mt-5 flex flex-wrap gap-4 text-sm">
        <Link href={`${href}#source`}>View source</Link>
        <Link href={`${href}#correct`}>Correct</Link>
        <Link href={`${href}#forget`}>Forget</Link>
      </div>
    </article>
  );
}
