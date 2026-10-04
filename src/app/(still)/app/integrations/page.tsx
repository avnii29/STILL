import { FadeIn } from "@/components/fade-in";
import { IngestForm } from "@/components/ingest-form";
import { ProviderCard } from "@/components/provider-card";
import { requireOnboardedUser } from "@/lib/auth";
import { readCalendarMetadata } from "@/lib/connectors/google-calendar";
import { connectorCapabilities, sourceLiveStatus } from "@/lib/connectors/status";
import { isGoogleCalendarConfigured } from "@/lib/integrations/google";
import { getPrisma } from "@/lib/prisma";
import { providerCatalog } from "@/lib/sources/capabilities";

export const dynamic = "force-dynamic";

function lastEventLabel(value: string | null | undefined) {
  if (!value) return null;
  const then = new Date(value);
  if (Number.isNaN(then.getTime())) return null;
  const seconds = Math.max(0, Math.round((Date.now() - then.getTime()) / 1000));
  if (seconds < 60) return `${seconds} seconds ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} minutes ago`;
  return new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(then);
}

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ calendar?: string }>;
}) {
  const user = await requireOnboardedUser();
  const { calendar } = await searchParams;
  const prisma = getPrisma();
  const accounts = await prisma.integrationAccount.findMany({
    where: { userId: user.id },
  });
  const providers = providerCatalog();
  const calendarNote =
    calendar === "synced"
      ? "Google Calendar finished its first sync. The status below is what the connection actually is."
      : calendar === "expired"
        ? "Google authorization expired. Reconnect to continue."
        : calendar === "denied" || calendar === "error"
          ? "Google Calendar did not connect. Nothing was marked live."
          : null;

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
      {calendarNote ? <p className="mt-6 max-w-xl text-ink-soft">{calendarNote}</p> : null}

      <ul className="mt-12 max-w-4xl divide-y divide-line border-y border-line">
        {providers.map((provider) => {
          const account = accounts.find((item) => item.provider === provider.id);
          const configured = provider.id === "CALENDAR" ? isGoogleCalendarConfigured() : provider.available;
          const liveStatus = sourceLiveStatus({
            provider: provider.id,
            configured,
            status: account?.status,
            hasToken: Boolean(account?.tokenCipher),
            metadata: account?.metadata,
          });
          const meta = provider.id === "CALENDAR" ? readCalendarMetadata(account?.metadata) : null;
          const scan = meta?.scan
            ? `${meta.scan.scanned} calendar events scanned. ${meta.scan.conflicts} overlap an open commitment. ${meta.scan.updated} changed.`
            : null;
          const detail =
            liveStatus === "DEGRADED"
              ? account?.lastError ?? "Push is unavailable. STILL will reconcile on the scheduled check."
              : liveStatus === "AUTH_EXPIRED"
                ? "Authorization expired."
                : account?.connectedAt
                  ? `Connected since ${new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(account.connectedAt)}`
                  : null;
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
              liveStatus={liveStatus}
              capabilities={connectorCapabilities(provider.id, configured)}
              unavailableReason={provider.unavailableReason}
              lastEventLabel={lastEventLabel(meta?.lastEventAt)}
              watching={meta?.calendars?.length}
              scan={scan}
              detail={liveStatus === "NOT_CONNECTED" || liveStatus === "NOT_YET_CONFIGURED" ? null : detail}
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
