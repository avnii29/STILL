import type { Metadata } from "next";
import { LegalShell } from "@/components/legal/legal-shell";

export const metadata: Metadata = { title: "Status", description: "Whether STILL publishes a status feed." };

export default function StatusPage() {
  return (
    <LegalShell eyebrow="Support" title="Status">
      <p>
        This deployment does not publish a separate status feed or uptime vendor. If the site loads, the
        application process is responding. Connector health still depends on credentials and, for Google
        Calendar, a public HTTPS address.
      </p>
    </LegalShell>
  );
}
