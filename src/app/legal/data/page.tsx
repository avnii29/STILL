import type { Metadata } from "next";
import { LegalShell } from "@/components/legal/legal-shell";

export const metadata: Metadata = {
  title: "Data & deletion",
  description: "Export, delete, and disconnect what STILL holds.",
};

export default function DataPage() {
  return (
    <LegalShell title="Data & deletion">
      <p>Your data belongs to you. These controls exist in the signed-in product.</p>
      <section>
        <h2>Export</h2>
        <p>Settings → Privacy downloads a JSON export of your STILL data.</p>
      </section>
      <section>
        <h2>Delete</h2>
        <p>
          Settings → Delete my STILL removes the account and the associated personal data after you
          type your email to confirm. Information required for security or law can remain.
        </p>
      </section>
      <section>
        <h2>Disconnect</h2>
        <p>A connected source can be disconnected from its integration card. Disconnecting stops STILL from using that grant.</p>
      </section>
      <section>
        <h2>Revoke permissions</h2>
        <p>
          Disconnecting inside STILL removes the grant STILL stores. You can also revoke the application
          in the provider&apos;s own account settings, which is the provider&apos;s control, not STILL&apos;s.
        </p>
      </section>
    </LegalShell>
  );
}
