import type { Metadata } from "next";
import Link from "next/link";
import { LegalShell, UnsetField } from "@/components/legal/legal-shell";
import { getServerEnv } from "@/lib/env";
import { operator } from "@/config/operator";

export const metadata: Metadata = {
  title: "Privacy",
  description: "What STILL collects, why, and what you can do about it.",
};

export default function PrivacyPolicyPage() {
  const env = getServerEnv();
  const ai =
    env.AI_PROVIDER === "openai"
      ? "OpenAI"
      : env.AI_PROVIDER === "anthropic"
        ? "Anthropic"
        : null;
  const email =
    env.EMAIL_PROVIDER === "resend"
      ? "Resend"
      : env.EMAIL_PROVIDER === "smtp"
        ? "an SMTP server configured by the operator"
        : null;
  const push = Boolean(env.NEXT_PUBLIC_VAPID_PUBLIC_KEY);

  return (
    <LegalShell title="Privacy">
      <section>
        <h2>Who operates STILL</h2>
        <p>
          {operator.operatorLegalName ? (
            <>{operator.operatorLegalName} operates STILL.</>
          ) : (
            <>
              The legal operator has not been published. <UnsetField label="OPERATOR LEGAL NAME" />
            </>
          )}
        </p>
        <p>
          Contact:{" "}
          {operator.contactEmail ? (
            <a href={`mailto:${operator.contactEmail}`}>{operator.contactEmail}</a>
          ) : (
            <UnsetField label="CONTACT EMAIL" />
          )}
        </p>
        {operator.businessAddress ? (
          <p>Address: {operator.businessAddress}</p>
        ) : (
          <p>
            A business address has not been published. <UnsetField label="BUSINESS ADDRESS" />
          </p>
        )}
      </section>

      <section>
        <h2>What STILL is</h2>
        <p>
          STILL remembers commitments you said you would keep. Conversations are sources.
          Commitments are memory. STILL is not a chatbot, a todo scoreboard, or a surveillance
          product.
        </p>
      </section>

      <section>
        <h2>Information you provide</h2>
        <h3>Account information</h3>
        <p>
          Email and password (or Google sign-in if that provider is enabled). Optional name and
          timezone. These live in Supabase Auth and in STILL&apos;s <code>users</code> /{" "}
          <code>profiles</code> rows.
        </p>
        <h3>Guest workspace</h3>
        <p>
          You can enter STILL without an account. Sentences you ask STILL to look at are sent to{" "}
          <code>/api/extract</code> so the same detector can run. That is server processing — STILL
          does not claim that nothing leaves your device. The resulting thread is stored in this
          browser&apos;s IndexedDB (<code>still-guest</code>), not in the STILL database, until you
          choose which memories to bring into an account. Guest extract requests are rate-limited by
          network address. A guest privacy page lives at <Link href="/still/privacy">/still/privacy</Link>.
        </p>
        <h3>Commitments</h3>
        <p>
          The remembered act, optional person, optional deadline, source, and confidence. Stored
          when you choose Remember, or when you confirm something STILL noticed.
        </p>
        <h3>Conversation evidence</h3>
        <p>
          The sentence that justifies a memory. Default retention is evidence only — not the rest of
          a long paste. You can choose to keep more, or nothing beyond the commitment fields, in
          Privacy settings.
        </p>
        <h3>Voice / transcription</h3>
        <p>
          Speak uses the browser&apos;s speech engine. STILL does not upload or store the audio
          file. Words appear in the capture field. They become stored evidence only if you remember
          them. Which speech vendor your browser uses is not controlled by this repository.
        </p>
        <h3>Connected-source information</h3>
        <p>
          If you connect Telegram (or another official source that is actually configured), STILL
          stores the identifiers needed to receive messages you send or forward to STILL, plus any
          evidence those messages produce. STILL does not ask for your chat password or session
          file.
        </p>
        <h3>Calendar information</h3>
        <p>
          Calendar connection is optional and, in this codebase, does not silently read or move
          events. If Google Calendar OAuth is later completed, this policy must be updated to match
          that implementation.
        </p>
        <h3>Technical / security logs</h3>
        <p>
          The server writes operational logs and audit rows (including IP on some actions). Host log
          destination depends on deployment and is not specified in this repository.
        </p>
      </section>

      <section>
        <h2>Cookies and local storage</h2>
        <p>
          STILL uses strictly necessary Supabase session cookies. Guest STILL uses IndexedDB on this
          device. It does not set analytics or marketing cookies. See{" "}
          <Link href="/legal/cookies">Cookies</Link>.
        </p>
      </section>

      <section>
        <h2>Why information is processed</h2>
        <p>
          To create and keep your account, remember confirmed commitments, explain why they were
          kept, send reminders you asked for, and operate security. There is no advertising use in
          this codebase.
        </p>
      </section>

      <section>
        <h2>How AI processing works</h2>
        {ai ? (
          <p>
            A language model ({ai}) is configured. STILL sends candidate snippets required to
            classify a commitment — not a whole inbox. Output is validated before it can become
            memory. Whether {ai} uses API traffic to train its own models is determined by that
            provider&apos;s terms and any contract the operator signs. That is not a completed fact
            in this repository.
          </p>
        ) : (
          <p>
            No language-model provider is configured in this environment. Classification uses
            wording patterns on the STILL server. Nothing is sent to OpenAI or Anthropic unless an
            operator later sets <code>AI_PROVIDER</code>.
          </p>
        )}
      </section>

      <section>
        <h2>Third-party processors</h2>
        <ul>
          <li>Supabase — authentication and, typically, the PostgreSQL database.</li>
          <li>Hosting provider — README assumes Vercel; production host is not confirmed here.</li>
          <li>
            AI provider — {ai ?? "none configured"}.
          </li>
          <li>Notification email — {email ?? "none configured (EMAIL_PROVIDER=none or log)."}</li>
          <li>
            Web push — {push ? "VAPID keys are present; the browser push service delivers notices." : "not configured."}
          </li>
          <li>Analytics provider — none installed.</li>
        </ul>
      </section>

      <section>
        <h2>Data location</h2>
        <p>
          Location is the region of the Supabase project and the application host. That region is
          not recorded in this repository.
        </p>
      </section>

      <section>
        <h2>Retention</h2>
        <p>
          Account and memories last until you delete them. Default conversation retention is
          evidence only. Audit and consent rows are removed with the account in the current deletion
          implementation.
        </p>
      </section>

      <section>
        <h2>Security</h2>
        <p>
          User-owned tables have row-level security policies for Supabase clients. The application
          server uses a direct database connection and must enforce user id from the signed-in
          session. This is not a claim of “military-grade” or perfect security.
        </p>
      </section>

      <section>
        <h2>Your controls</h2>
        <p>
          After you sign in: inspect memories, forget them, export JSON, disconnect sources, delete
          stored source excerpts, and delete the account from{" "}
          <Link href="/settings/privacy">Privacy</Link>. Public legal pages do not require an
          account.
        </p>
      </section>

      <section>
        <h2>Children</h2>
        <p>
          STILL is not directed at children. A specific age threshold and jurisdiction have not been
          published. <UnsetField label="AGE POLICY" />
        </p>
      </section>

      <section>
        <h2>Changes</h2>
        <p>
          Material changes will update the policy version ({operator.policyVersion} today). How
          notice is given after launch is not specified yet.
        </p>
      </section>
    </LegalShell>
  );
}
