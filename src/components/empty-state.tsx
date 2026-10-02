import Link from "next/link";
import type { ReactNode } from "react";

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="max-w-xl py-8">
      <p className="label mb-4">Quiet</p>
      <h2 className="font-display text-4xl leading-tight tracking-tight text-ink sm:text-5xl">
        {title}
      </h2>
      <p className="mt-5 max-w-md text-lg leading-relaxed text-ink-soft">{body}</p>
      {action ? <div className="mt-8">{action}</div> : null}
    </div>
  );
}

export function TextLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="border-b border-accent/40 pb-0.5 text-accent transition-colors hover:border-accent focus-visible:border-accent"
    >
      {children}
    </Link>
  );
}
