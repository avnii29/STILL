import Link from "next/link";
import { FadeIn } from "@/components/fade-in";
import { PrivacyActions } from "@/components/privacy-actions";
import { RetentionForm } from "@/components/retention-form";
import { requireOnboardedUser } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";
import { getServerEnv } from "@/lib/env";
import { sourceDisplayName } from "@/lib/copy";

export const dynamic = "force-dynamic";

export default async function PrivacyPage() {
  const user = await requireOnboardedUser();
  const prisma = getPrisma();
  const [preference, threads, accounts, permissions] = await Promise.all([
    prisma.userPreference.findUnique({ where: { userId: user.id } }),
    prisma.thread.count({ where: { userId: user.id } }),
    prisma.integrationAccount.findMany({ where: { userId: user.id } }),
    prisma.sourcePermission.findMany({ where: { userId: user.id } }),
  ]);
  const env = getServerEnv();
  const usesModel = env.AI_PROVIDER !== "none";
  const connected = accounts.filter((item) => item.status === "CONNECTED");

  return (
    <FadeIn>
      <p className="label mb-6">Privacy</p>
      <h1 className="font-display text-[clamp(2.6rem,6vw,5.2rem)] leading-[0.95] tracking-tight">
        your conversations are yours.
      </h1>

      <section className="mt-14 border-t border-line pt-10">
        <h2 className="font-display text-3xl tracking-tight">What STILL remembers</h2>
        <p className="mt-4 max-w-xl text-lg text-ink-soft">
          {threads === 0
            ? "Nothing is stored as memory yet."
            : threads === 1
              ? "1 commitment, with the evidence that explains it."
              : `${threads} commitments, each with the evidence that explains them.`}
        </p>
        <p className="mt-4">
          <Link href="/memory">Open memory</Link>
        </p>
      </section>

      <section className="mt-14 border-t border-line pt-10">
        <h2 className="font-display text-3xl tracking-tight">What STILL can access</h2>
        <p className="mt-4 max-w-xl text-lg text-ink-soft">
          Typed, spoken, and pasted notes you give it. Connected sources only after you grant them.
        </p>
      </section>

      <section className="mt-14 border-t border-line pt-10">
        <h2 className="font-display text-3xl tracking-tight">Connected sources</h2>
        {connected.length === 0 ? (
          <p className="mt-4 text-ink-soft">No source is connected.</p>
        ) : (
          <ul className="mt-4 space-y-2 text-ink-soft">
            {connected.map((account) => (
              <li key={account.id}>{sourceDisplayName(account.provider)}</li>
            ))}
          </ul>
        )}
        {permissions.some((item) => item.granted) ? (
          <p className="mt-4 text-sm text-ink-soft">
            Granted:{" "}
            {permissions
              .filter((item) => item.granted)
              .map((item) => sourceDisplayName(item.provider))
              .join(", ")}
          </p>
        ) : null}
        <p className="mt-4">
          <Link href="/integrations">Review sources</Link>
        </p>
      </section>

      <section className="mt-14 border-t border-line pt-10">
        <h2 className="font-display text-3xl tracking-tight">Source retention</h2>
        <p className="mt-4 max-w-xl text-ink-soft">
          Default: keep the sentence that explains a memory, not the unused remainder of a
          conversation.
        </p>
        <RetentionForm conversationRetention={preference?.conversationRetention ?? "EVIDENCE_ONLY"} />
      </section>

      <section className="mt-14 border-t border-line pt-10">
        <h2 className="font-display text-3xl tracking-tight">AI processing</h2>
        <p className="mt-4 max-w-xl text-lg text-ink-soft">
          {usesModel
            ? "A language model is configured. STILL sends only the candidate snippet required to classify a commitment — not your whole inbox. Whether that provider trains on API traffic is set by their terms, not by a claim in this product."
            : "No language-model provider is configured here. Classification uses wording patterns on this server."}
        </p>
      </section>

      <section className="mt-14 border-t border-line pt-10">
        <h2 className="font-display text-3xl tracking-tight">Notifications</h2>
        <p className="mt-4 text-ink-soft">
          Email notices {preference?.emailNotifications ? "on" : "off"}. Web push{" "}
          {preference?.webPushEnabled ? "on" : "off"}.
        </p>
        <p className="mt-4">
          <Link href="/settings">Change how STILL reaches you</Link>
        </p>
      </section>

      <section className="mt-14 border-t border-line pt-10">
        <h2 className="font-display text-3xl tracking-tight">Guest privacy</h2>
        <p className="mt-4 max-w-xl text-ink-soft">
          Threads you kept before this account may still live in this browser. You can review them,
          bring selected ones into STILL, or erase the local copy.
        </p>
        <p className="mt-4">
          <Link href="/still/privacy">Open guest privacy</Link>
        </p>
      </section>

      <section className="mt-14 border-t border-line pt-10">
        <h2 className="font-display text-3xl tracking-tight">Export my data</h2>
        <p className="mt-4 max-w-xl text-ink-soft">
          A JSON file of commitments, evidence, thread history, settings, and connected-source
          metadata. Tokens are not included.
        </p>
        <PrivacyActions />
      </section>

      <section className="mt-14 border-t border-line pt-10">
        <h2 className="font-display text-3xl tracking-tight">Delete memory</h2>
        <p className="mt-4 text-ink-soft">
          Open a thread and choose Forget this memory. That removes the thread, not the whole account.
        </p>
        <p className="mt-4">
          <Link href="/memory">Choose a memory</Link>
        </p>
      </section>

      <section className="mt-14 border-t border-line pt-10">
        <h2 className="font-display text-3xl tracking-tight">Delete account</h2>
        <p className="mt-4 text-ink-soft">
          Settings explains what leaving removes, then asks you to type your email.
        </p>
        <p className="mt-4">
          <Link href="/settings">Delete my STILL</Link>
        </p>
      </section>

      <p className="mt-16 text-sm">
        <Link href="/legal/privacy">Privacy policy</Link>
        {" · "}
        <Link href="/legal/terms">Terms of use</Link>
        {" · "}
        <Link href="/legal/cookies">Cookies</Link>
      </p>
    </FadeIn>
  );
}
