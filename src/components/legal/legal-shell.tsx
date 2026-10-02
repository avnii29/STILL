import type { ReactNode } from "react";
import Link from "next/link";
import { AmbientLandscape } from "@/components/landscape";
import { StillMark } from "@/components/still-mark";
import { operator, operatorDisplay, isOperatorReady } from "@/config/operator";

export function LegalShell({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const name = operatorDisplay(operator.operatorLegalName, "OPERATOR LEGAL NAME");
  const email = operatorDisplay(operator.contactEmail, "CONTACT EMAIL");

  return (
    <div className="relative min-h-dvh">
      <AmbientLandscape />
      <div className="relative z-10 mx-auto max-w-2xl px-5 py-10 sm:px-8">
        <StillMark href="/" title="STILL" />
        <p className="label mt-16">Legal</p>
        <h1 className="mt-4 font-display text-[clamp(2.4rem,6vw,4.2rem)] leading-[0.95] tracking-tight">
          {title}
        </h1>
        <p className="mt-4 text-sm text-ink-soft">
          Policy version {operator.policyVersion}. Effective {operator.effectiveDate}.
        </p>
        {!isOperatorReady() ? (
          <p className="mt-4 rounded-md border border-line bg-paper/80 px-4 py-3 text-sm text-ink-soft">
            Operator details are not published yet. Placeholders below are unfinished fields, not
            legal facts.
          </p>
        ) : null}
        <div className="legal-prose mt-10 space-y-6 text-base leading-relaxed text-ink-soft">
          {children}
        </div>
        <nav aria-label="Legal" className="mt-16 flex flex-wrap gap-4 text-sm">
          <Link href="/legal/privacy">Privacy</Link>
          <Link href="/legal/terms">Terms</Link>
          <Link href="/legal/cookies">Cookies</Link>
          <Link href="/">Back to STILL</Link>
        </nav>
        <p className="mt-10 text-sm text-ink-soft">
          {name.ready ? name.text : name.text}
          {" · "}
          {email.ready ? (
            <a href={`mailto:${email.text}`}>{email.text}</a>
          ) : (
            email.text
          )}
        </p>
      </div>
    </div>
  );
}

export function UnsetField({ label }: { label: string }) {
  return (
    <span className="rounded-sm bg-paper px-1 font-mono text-[0.85em] text-ink">
      [{label} REQUIRED]
    </span>
  );
}
