import type { Metadata } from "next";
import { LegalShell } from "@/components/legal/legal-shell";

export const metadata: Metadata = { title: "Accessibility", description: "How STILL is meant to be used." };

export default function AccessibilityPage() {
  return (
    <LegalShell eyebrow="Support" title="Accessibility">
      <p>
        The homepage story is also written in a text alternative for assistive technology. Reduced motion
        keeps the same sections and advances them with scroll instead of a smoothed animation. Controls
        are buttons and links with visible labels. Password fields can be shown or hidden.
      </p>
      <p>If a page blocks you, the contact page is the place to say so. No separate accessibility inbox has been published.</p>
    </LegalShell>
  );
}
