import type { Metadata } from "next";
import Link from "next/link";
import { LegalShell } from "@/components/legal/legal-shell";

export const metadata: Metadata = { title: "Help", description: "How to use STILL." };

export default function HelpPage() {
  return (
    <LegalShell eyebrow="Support" title="Help">
      <section>
        <h2>Enter</h2>
        <p>
          <Link href="/still">Enter STILL</Link> opens the guest world. An account keeps commitments after you sign in.
        </p>
      </section>
      <section>
        <h2>A thread</h2>
        <p>STILL keeps a commitment with the words it came from. If the deadline changes, the thread should change. If the commitment is done, STILL should stop.</p>
      </section>
      <section>
        <h2>Sources</h2>
        <p>Connect only what you authorize. Google Calendar is the connector that exists. Other sources are not connected.</p>
      </section>
      <section>
        <h2>Something wrong</h2>
        <p>
          Use <Link href="/contact">Contact</Link>. If you are signed in, Settings can export or delete the account.
        </p>
      </section>
    </LegalShell>
  );
}
