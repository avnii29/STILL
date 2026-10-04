import type { Metadata } from "next";
import Link from "next/link";
import { LegalShell } from "@/components/legal/legal-shell";
import { operator } from "@/config/operator";

export const metadata: Metadata = {
  title: "Terms",
  description: "How you may use STILL.",
};

export default function TermsPage() {
  const contact = operator.contactEmail;

  return (
    <LegalShell title="Terms">
      <p>Last updated: {operator.effectiveDate}.</p>
      <p>
        These terms describe use of the STILL software. Clauses that need a named operator, a liability
        cap, or a court are marked as not yet adopted. They are not filled in with invented law.
      </p>

      <section>
        <h2>1. Acceptance</h2>
        <p>Using STILL means you agree to the terms that are actually in force on this page. Creating an account records acceptance of the terms at sign-up.</p>
      </section>

      <section>
        <h2>2. Eligibility</h2>
        <p>
          You may use STILL if you can form a contract for yourself and you are not a child the service
          is barred from serving. An age number has not been legally adopted, so none is stated here.
        </p>
      </section>

      <section>
        <h2>3. Your account</h2>
        <p>You are responsible for the email and password on your account, and for keeping access to them. Do not use another person&apos;s account.</p>
      </section>

      <section>
        <h2>4. Acceptable use</h2>
        <p>
          Do not use STILL for illegal activity, abuse, unauthorized access, sharing credentials,
          malicious activity, attempts to bypass security, or misuse of an integration. Do not use STILL
          as the basis for a high-risk decision where a person&apos;s safety, health, finances, or legal
          position depends on it.
        </p>
      </section>

      <section>
        <h2>5. Your content</h2>
        <p>
          You keep the rights to content you provide. You grant STILL the limited permission required to
          host that content, extract commitments, show evidence, and carry out actions you approve.
        </p>
      </section>

      <section>
        <h2>6. Connected services</h2>
        <p>
          Integrations depend on third-party providers and on the permissions you grant. Google Calendar
          is the connector that exists. A source that is not implemented is not treated as connected.
        </p>
      </section>

      <section>
        <h2>7. AI limitations</h2>
        <p>
          Results may be inaccurate, incomplete, delayed, or inappropriate. STILL is not legal, medical,
          financial, emergency, or other professional advice. AI output is not a source of truth.
        </p>
      </section>

      <section>
        <h2>8. Actions</h2>
        <p>
          Some proposals would change an external service, such as moving a calendar event. Where that is
          supported, STILL asks you to confirm. It does not send messages to other people for you.
        </p>
      </section>

      <section>
        <h2>9. Availability</h2>
        <p>STILL does not promise uninterrupted service. Features can fail, and a connector can be unavailable when its credentials or a public callback URL are missing.</p>
      </section>

      <section>
        <h2>10. Beta</h2>
        <p>This is early software. Features can change or be removed, including experimental ones.</p>
      </section>

      <section>
        <h2>11. Intellectual property</h2>
        <p>The STILL software, name, and visual design are protected as the operator&apos;s or the authors&apos; property. These terms do not transfer that ownership to you.</p>
      </section>

      <section>
        <h2>12. Third-party services</h2>
        <p>Third-party terms apply to Supabase, Google, and any other provider you or the deployment uses. STILL does not control those services.</p>
      </section>

      <section>
        <h2>13. Suspension</h2>
        <p>Access can be suspended or ended if the account is used in a way these terms prohibit, or if continuing the account would create a security or legal problem. You can also leave by deleting the account in Settings.</p>
      </section>

      <section>
        <h2>14. Disclaimer</h2>
        <p>
          The service and its AI output are provided as available. Commitments can be missed. Deadlines
          can be parsed wrong. A recommendation can be the wrong one. You remain responsible for what you
          promised other people.
        </p>
      </section>

      <section>
        <h2>15. Limitation of liability</h2>
        <p>
          A damages cap and a formal limitation of liability have not been adopted, because they need a
          named operator and legal review. This page does not invent one. Do not read this section as a
          waiver of rights you cannot waive.
        </p>
      </section>

      <section>
        <h2>16. Governing law</h2>
        <p>
          {operator.jurisdiction
            ? `The published jurisdiction for this deployment is ${operator.jurisdiction}.`
            : "No governing law has been published, because the legal operator and jurisdiction are not set. This page does not choose one for you."}
        </p>
      </section>

      <section>
        <h2>17. Disputes</h2>
        <p>
          A dispute venue, arbitration clause, or court has not been adopted. Until it is, a disagreement
          is not routed to a city this page made up.
        </p>
      </section>

      <section>
        <h2>18. Changes</h2>
        <p>These terms can change when the product or the law changes. The date above is the date of this text. Continued use after a published change is acceptance of the new text.</p>
      </section>

      <section>
        <h2>19. Contact</h2>
        <p>
          {contact ? (
            <>
              Contact: <a href={`mailto:${contact}`}>{contact}</a>.
            </>
          ) : (
            "No contact email has been published."
          )}{" "}
          Privacy details are on the <Link href="/legal/privacy">privacy page</Link>.
        </p>
      </section>
    </LegalShell>
  );
}
