import type { Metadata } from "next";
import { LegalShell } from "@/components/legal/legal-shell";
import { operator } from "@/config/operator";

export const metadata: Metadata = { title: "Contact", description: "How to reach STILL." };

export default function ContactPage() {
  const email = operator.contactEmail ?? operator.supportEmail;
  return (
    <LegalShell eyebrow="Support" title="Contact">
      <p>
        {email ? (
          <>
            Write to <a href={`mailto:${email}`}>{email}</a>. The same address is the privacy and
            grievance contact until a separate one is published.
          </>
        ) : (
          "No contact email has been published for this deployment. A public launch needs a real address before this page can take messages."
        )}
      </p>
    </LegalShell>
  );
}
