import type { Metadata } from "next";
import Link from "next/link";
import { LegalShell } from "@/components/legal/legal-shell";

export const metadata: Metadata = { title: "How it works", description: "What STILL checks before it acts." };

export default function HowPage() {
  return (
    <LegalShell eyebrow="STILL" title="How it works">
      <p>
        Before STILL acts, it checks whether an event contains a commitment, what was promised, what
        evidence supports it, when it is due, whether anything changed, whether an intervention is
        useful, and whether an action is justified.
      </p>
      <p>The agents do the reasoning. You keep the decision.</p>
      <p>
        The same sequence is on the <Link href="/#works">homepage</Link>.
      </p>
    </LegalShell>
  );
}
