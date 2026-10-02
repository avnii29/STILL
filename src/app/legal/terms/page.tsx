import type { Metadata } from "next";
import Link from "next/link";
import { LegalShell, UnsetField } from "@/components/legal/legal-shell";
import { operator } from "@/config/operator";

export const metadata: Metadata = {
  title: "Terms of Use",
  description: "How you may use STILL.",
};

export default function TermsPage() {
  return (
    <LegalShell title="Terms of Use">
      <section>
        <h2>The service</h2>
        <p>
          STILL helps you keep commitments that appear in conversations you give it. It does not
          send messages to other people on your behalf. It does not silently move calendar events.
        </p>
      </section>

      <section>
        <h2>Accounts</h2>
        <p>
          You are responsible for the email and password you use, and for what you ask STILL to
          remember. Do not use another person&apos;s account.
        </p>
      </section>

      <section>
        <h2>Acceptable use</h2>
        <p>
          Do not use STILL to break the law, to upload content you have no right to process, or to
          attack the service. Connected sources may only include messages you are allowed to send or
          forward to STILL.
        </p>
      </section>

      <section>
        <h2>Connected services</h2>
        <p>
          Connecting Telegram or another official source grants only the permission described at
          connect time. Disconnecting stops new intake. Existing memories remain until you forget
          them.
        </p>
      </section>

      <section>
        <h2>Your content</h2>
        <p>
          You keep whatever rights you already have in the notes and excerpts you provide. You grant
          STILL the limited permission needed to store, interpret, and show that material back to
          you.
        </p>
      </section>

      <section>
        <h2>Third-party services</h2>
        <p>
          Supabase, optional AI, email, push, and messaging providers have their own terms. STILL
          does not control those services.
        </p>
      </section>

      <section>
        <h2>AI limitations</h2>
        <p>
          Interpretation can be wrong. STILL may miss a promise or misread one. You decide what to
          remember, correct, postpone, or let go.
        </p>
      </section>

      <section>
        <h2>Reminders are not guaranteed</h2>
        <p>
          Reminders depend on a working deployment, optional push or email, and your device
          permissions. Do not rely on STILL for emergencies, medicine, legal deadlines, or anything
          where a missed notice would cause serious harm.
        </p>
      </section>

      <section>
        <h2>External actions</h2>
        <p>
          If STILL ever proposes moving a calendar event or opening a document, you must review it.
          The current product does not execute those changes without you, and calendar execute is
          not implemented.
        </p>
      </section>

      <section>
        <h2>Intellectual property</h2>
        <p>
          The STILL name, mark, and product interface belong to the operator once that operator is
          identified. {operator.operatorLegalName ?? null}
          {!operator.operatorLegalName ? (
            <>
              {" "}
              <UnsetField label="OPERATOR LEGAL NAME" />
            </>
          ) : null}
        </p>
      </section>

      <section>
        <h2>Availability, termination, deletion</h2>
        <p>
          The service may be unavailable. You may delete your account from Settings. The operator
          may suspend accounts that abuse the service. Deletion removes application data as
          implemented in <Link href="/legal/privacy">Privacy</Link>.
        </p>
      </section>

      <section>
        <h2>Limitation</h2>
        <p>
          To the extent permitted by applicable law, STILL is provided as-is. Nothing here limits
          rights that cannot be limited in your jurisdiction.
        </p>
      </section>

      <section>
        <h2>Governing law</h2>
        <p>
          Governing law and venue have not been published.{" "}
          {operator.jurisdiction ? (
            <>Stated jurisdiction: {operator.jurisdiction}.</>
          ) : (
            <UnsetField label="GOVERNING LAW / JURISDICTION" />
          )}
        </p>
      </section>

      <section>
        <h2>Contact</h2>
        <p>
          {operator.contactEmail ? (
            <a href={`mailto:${operator.contactEmail}`}>{operator.contactEmail}</a>
          ) : (
            <UnsetField label="CONTACT EMAIL" />
          )}
        </p>
      </section>

      <section>
        <h2>Purchases</h2>
        <p>STILL currently does not offer paid purchases. There is no refund policy because nothing is sold.</p>
      </section>
    </LegalShell>
  );
}
