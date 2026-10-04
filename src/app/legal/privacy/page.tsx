import type { Metadata } from "next";
import Link from "next/link";
import { LegalShell } from "@/components/legal/legal-shell";
import { operator } from "@/config/operator";

export const metadata: Metadata = {
  title: "Privacy",
  description: "How STILL handles information you authorize.",
};

export default function PrivacyPage() {
  const operatorName = operator.operatorLegalName;
  const contact = operator.contactEmail;

  return (
    <LegalShell title="Privacy">
      <p>Last updated: {operator.effectiveDate}.</p>
      <p>
        {operatorName
          ? `STILL is operated by ${operatorName} (“STILL”, “we”, “us”, or “our”).`
          : "The operator of this deployment has not published a legal name. The sentences below describe the software as it runs. They are not a finished notice from a named operator."}
      </p>

      <section>
        <h2>1. What STILL does</h2>
        <p>
          STILL is a personal commitment-management service. With your authorization, STILL can process
          information from connected sources to identify commitments, keep evidence with the thread,
          watch for relevant changes, offer reminders and recommendations, and — where a connector
          supports it and you approve it — perform an action through that service.
        </p>
      </section>

      <section>
        <h2>2. Information we collect</h2>
        <h3>Account information</h3>
        <p>Email address, a name if you provide one, and the authentication identifiers Supabase stores for your session.</p>
        <h3>Commitment information</h3>
        <p>
          Commitments you create or that STILL extracts from text you authorize, their status, deadlines
          it can actually parse, people or entities named in that evidence, the evidence itself, and how
          a commitment was resolved.
        </p>
        <h3>Connected-source information</h3>
        <p>
          This depends on what you connect. If you connect Google Calendar, STILL may process the
          calendar events needed to see scheduling context, deadline conflicts, and an approved calendar
          change. STILL does not receive a source you have not authorized. Messages, documents, email,
          and tasks are not connected in this product yet.
        </p>
        <h3>Technical information</h3>
        <p>IP address as seen by the host, browser and device information sent with ordinary requests, timestamps, and security or diagnostic logs when something fails.</p>
        <h3>Notification information</h3>
        <p>Notification preferences you set, and delivery state when a reminder is actually sent.</p>
      </section>

      <section>
        <h2>3. Why we use information</h2>
        <p>To provide STILL, identify commitments, keep threads, determine deadlines that the text supports, detect changes, provide reminders, generate recommendations, execute actions you approve, authenticate you, secure the service, prevent abuse, troubleshoot failures, and comply with law. Customer content is not used here to train a model.</p>
      </section>

      <section>
        <h2>4. AI processing</h2>
        <p>
          STILL uses deterministic checks and, when an operator configures a model, automated systems to
          interpret authorized content and judge whether it is a commitment, deadline, change,
          resolution, or possible intervention. AI-generated conclusions are not guaranteed. Evidence and
          code-backed checks are preferred, and consequential actions require approval. STILL does not
          treat AI output as a source of truth.
        </p>
        <p>
          No model provider is configured by default. If an operator later sets one, the privacy notice
          for that deployment must name the provider and the fields sent. This copy will not call an
          unnamed company a trusted partner.
        </p>
      </section>

      <section>
        <h2>5. Connected services</h2>
        <p>
          When you connect a third-party service, STILL receives only the permissions that provider&apos;s
          authorization screen grants. Those services have their own privacy policies and terms. You can
          disconnect a connected service from STILL. Google Calendar is the connector that exists today.
          Other sources are not offered as connected.
        </p>
      </section>

      <section>
        <h2>6. Human control</h2>
        <p>
          STILL may recommend an action from a commitment and its context. It does not independently make
          a consequential decision for you. A recommendation is a proposal. An action that changes an
          external service waits for your approval. Sending a message on your behalf is not an available
          action.
        </p>
      </section>

      <section>
        <h2>7. Sharing</h2>
        <p>We do not sell personal data.</p>
        <p>
          Processors that can be involved are the ones this deployment actually uses: Supabase for
          authentication and the database, the host that runs the Next.js application, and Google if you
          connect Calendar. There is no analytics provider. There is no email provider configured by
          default. Cloudflare Turnstile is used only when its keys are set, and then only for the
          verification challenge. See <Link href="/legal/subprocessors">Subprocessors</Link>.
        </p>
      </section>

      <section>
        <h2>8. Data retention</h2>
        <p>
          Personal data is kept while it is needed to provide the service, keep your account, meet
          operational needs such as security and abuse prevention, resolve disputes, or comply with law.
          This deployment does not claim a fixed deletion clock such as 30 days, because the software
          does not enforce one.
        </p>
      </section>

      <section>
        <h2>9. Delete your data</h2>
        <p>
          Signed in, open Settings and use Delete my STILL. That removes the account, memories, evidence,
          people, reminders, connected-source identifiers, and consent receipts, and disconnects
          integrations. Export is on Settings → Privacy. Some information may still be kept where the law
          requires it, or where it is necessary for security, fraud prevention, or dispute resolution.
        </p>
      </section>

      <section>
        <h2>10. Your rights</h2>
        <p>
          You can ask for access, correction, erasure, and withdrawal of consent, and you can raise a
          grievance. Withdrawal and erasure in the product are the disconnect, forget, export, and delete
          controls above. Other rights that apply to you depend on the law that covers the operator. A
          grievance contact is published only when an email is configured
          {contact ? (
            <>
              : <a href={`mailto:${contact}`}>{contact}</a>.
            </>
          ) : (
            ". None is published for this deployment."
          )}
        </p>
      </section>

      <section>
        <h2>11. Children</h2>
        <p>
          STILL is not directed to children. We do not knowingly process a child&apos;s personal data. An age
          threshold has not been legally adopted for this product, so this page does not invent one.
        </p>
      </section>

      <section>
        <h2>12. Security</h2>
        <p>
          Sessions use cookie-based authentication. Traffic should be HTTPS in a deployed environment.
          Database policies use Row Level Security so a user is scoped to their own rows. Connector
          tokens stay on the server. Secrets are not placed in the browser bundle. Audit records exist
          for sign-in and account actions. This is ordinary application security, described on the{" "}
          <Link href="/legal/security">security page</Link>.
        </p>
      </section>

      <section>
        <h2>13. International transfers</h2>
        <p>
          Supabase and, if you connect it, Google may process data outside India. The region is whatever
          those projects are configured to use. It is not recorded in this repository, so this page will
          not invent a city. No model provider receives your content unless one is configured.
        </p>
      </section>

      <section>
        <h2>14. Changes</h2>
        <p>
          This policy is updated when STILL changes or when a legal requirement changes. The date at the
          top is the date of this text. A material change should be communicated in the product. Until an
          operator is named, treat a change here as a software change, not as a notice from a company.
        </p>
      </section>

      <section>
        <h2>15. Contact</h2>
        <p>
          {contact ? (
            <>
              Privacy and grievance contact: <a href={`mailto:${contact}`}>{contact}</a>.
            </>
          ) : (
            "No privacy or grievance email has been published. Do not treat a placeholder address as real."
          )}{" "}
          {operatorName ? `Operator: ${operatorName}.` : "No legal operator name has been published."}{" "}
          {operator.businessAddress ? `Address: ${operator.businessAddress}.` : "No business address has been published."}
        </p>
      </section>
    </LegalShell>
  );
}
