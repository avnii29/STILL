import type { ReactNode } from "react";
import Link from "next/link";
import { AmbientLandscape } from "@/components/landscape";
import { SiteFooter } from "@/components/site-footer";
import { StillMark } from "@/components/still-mark";
import { operator, isOperatorReady } from "@/config/operator";

const LINKS = [
  { href: "/legal/privacy", label: "Privacy" },
  { href: "/legal/terms", label: "Terms" },
  { href: "/legal/security", label: "Security" },
  { href: "/legal/data", label: "Data & deletion" },
  { href: "/legal/subprocessors", label: "Subprocessors" },
  { href: "/legal/cookies", label: "Cookies" },
  { href: "/", label: "Back to STILL" },
];

export function LegalShell({
  title,
  eyebrow = "Legal",
  children,
}: {
  title: string;
  eyebrow?: string;
  children: ReactNode;
}) {

  return (
    <div className="relative min-h-dvh overflow-x-clip">
      <AmbientLandscape />
      <div className="still-frame relative z-10 py-10 sm:py-14">
        <StillMark href="/" title="STILL" />
        <div className="mt-12 grid items-start gap-y-12 lg:grid-cols-[minmax(0,46rem)_1fr]">
          <article className="still-measure">
            <p className="label">{eyebrow}</p>
            <h1 className="mt-4 font-display text-[clamp(2.8rem,5vw,4.6rem)] leading-[0.95] tracking-tight">
              {title}
            </h1>
            <p className="mt-4 text-sm text-ink-soft">
              Policy version {operator.policyVersion}. Effective {operator.effectiveDate}.
            </p>
            {!isOperatorReady() ? (
              <p className="mt-6 rounded-md border border-line bg-paper/80 px-4 py-3 text-sm leading-relaxed text-ink-soft">
                A legal operator name and contact address have not been published for this deployment.
                This page describes how the software behaves. It is not a finished notice from a named
                operator, and it should be replaced before a public launch.
              </p>
            ) : null}
            <div className="legal-prose mt-10 space-y-8 text-base leading-relaxed text-ink-soft">
              {children}
            </div>
            <nav aria-label="Legal" className="mt-14 flex flex-wrap gap-x-5 gap-y-3 text-sm lg:hidden">
              {LINKS.map((item) => (
                <Link key={item.href} href={item.href}>
                  {item.label}
                </Link>
              ))}
            </nav>
            <p className="mt-10 text-sm text-ink-soft">
              {operator.operatorLegalName ?? "Operator not published"}
              {operator.contactEmail ? (
                <>
                  {" · "}
                  <a href={`mailto:${operator.contactEmail}`}>{operator.contactEmail}</a>
                </>
              ) : (
                " · contact not published"
              )}
            </p>
          </article>
          <nav aria-label="Legal" className="sticky top-10 hidden flex-col gap-3 text-sm lg:flex lg:justify-self-end">
            {LINKS.map((item) => (
              <Link key={item.href} href={item.href} className="min-h-11 inline-flex items-center">
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}
