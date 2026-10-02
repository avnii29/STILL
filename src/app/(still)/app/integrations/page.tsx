import { FadeIn } from "@/components/fade-in";
import { IngestForm } from "@/components/ingest-form";
import { ProviderCard } from "@/components/provider-card";
import { requireOnboardedUser } from "@/lib/auth";
import { providerCatalog } from "@/lib/sources/capabilities";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  const user = await requireOnboardedUser();
  const prisma = getPrisma();
  const accounts = await prisma.integrationAccount.findMany({
    where: { userId: user.id },
  });
  const providers = providerCatalog();

  return (
    <FadeIn>
      <p className="label mb-6">Sources</p>
      <h1 className="font-display text-[clamp(2.6rem,6vw,5.2rem)] leading-[0.95] tracking-tight">
        where do your promises happen?
      </h1>
      <p className="mt-5 max-w-xl text-lg text-ink-soft">
        After you understand STILL through type, speak, and paste, you can let it notice these
        moments where they already happen. Connect one source at a time. STILL will only use what
        you allow.
      </p>

      <ul className="mt-12 max-w-2xl divide-y divide-line border-y border-line">
        {providers.map((provider) => {
          const account = accounts.find((item) => item.provider === provider.id);
          return (
            <ProviderCard
              key={provider.id}
              id={provider.id}
              title={provider.title}
              capability={provider.capability}
              alternative={provider.alternative}
              available={provider.available}
              limited={provider.limited}
              connectable={provider.connectable}
              status={account?.status ?? "NOT_CONNECTED"}
              unavailableReason={provider.unavailableReason}
            />
          );
        })}
      </ul>

      <div className="mt-16">
        <h2 className="font-display text-3xl tracking-tight">Paste a conversation instead</h2>
        <p className="mt-3 max-w-xl text-ink-soft">
          STILL still works with nothing connected. Format lines as <em>Name: message</em>. Use{" "}
          <em>Me:</em> for yourself.
        </p>
        <div className="mt-8">
          <IngestForm />
        </div>
      </div>
    </FadeIn>
  );
}
