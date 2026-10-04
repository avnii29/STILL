import type { Metadata } from "next";
import { LegalShell } from "@/components/legal/legal-shell";
import { operator } from "@/config/operator";

export const metadata: Metadata = {
  title: "Security",
  description: "How STILL protects an account and the sources you connect.",
};

export default function SecurityPage() {
  return (
    <LegalShell title="Security">
      <section>
        <h2>Your data</h2>
        <p>
          Account records, commitments, evidence, and connector state are stored in the application
          database. A guest try on this device can stay in the browser until you choose to keep it.
        </p>
      </section>
      <section>
        <h2>Authentication</h2>
        <p>
          Sign-in uses Supabase Auth with a cookie session on the server. The publishable key is the one
          that belongs in the browser. The service role key stays on the server, and it is unused when
          it is not set.
        </p>
      </section>
      <section>
        <h2>Access controls</h2>
        <p>
          Row Level Security policies scope database rows to the signed-in user. Application routes that
          hold your commitments require that session.
        </p>
      </section>
      <section>
        <h2>Encryption</h2>
        <p>
          A deployed site should be served over HTTPS, so traffic is encrypted in transit. Storage
          encryption is whatever the database host provides. This page does not claim a special grade of
          encryption beyond that.
        </p>
      </section>
      <section>
        <h2>AI processing</h2>
        <p>
          No model provider is configured by default, so commitment text stays in the application. If an
          operator sets a provider, that deployment must say what is sent and to whom.
        </p>
      </section>
      <section>
        <h2>Integrations</h2>
        <p>
          Google Calendar uses OAuth. The scopes requested are calendar events and calendar read. Tokens
          are stored server-side. A watch channel needs a public HTTPS URL. Localhost cannot be treated
          as a live watch.
        </p>
      </section>
      <section>
        <h2>Secrets</h2>
        <p>API secrets, the Turnstile secret, and the service role key are read on the server. They are not shipped in the client bundle.</p>
      </section>
      <section>
        <h2>Incident response</h2>
        <p>
          A formal incident-response program has not been published. If something goes wrong with this
          deployment, the contact on this page is the route that exists. If no email is published, there
          is no public inbox yet.
        </p>
      </section>
      <section>
        <h2>Vulnerability reporting</h2>
        <p>
          {operator.contactEmail ? (
            <>
              Write to <a href={`mailto:${operator.contactEmail}`}>{operator.contactEmail}</a>. A
              separate security@ address has not been created.
            </>
          ) : (
            "No security contact has been published. This page will not invent a security@ address."
          )}
        </p>
      </section>
    </LegalShell>
  );
}
