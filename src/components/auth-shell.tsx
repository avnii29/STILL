"use client";

import type { ReactNode } from "react";
import { AmbientLandscape } from "@/components/landscape";
import { StillMark } from "@/components/still-mark";

const FRAGMENTS = [
  "I'll send it tomorrow",
  "remind me later",
  "I'll call you Friday",
];

export function AuthShell({
  eyebrow,
  title,
  lede,
  children,
}: {
  eyebrow: string;
  title: string;
  lede: string;
  children: ReactNode;
}) {
  return (
    <div className="relative min-h-dvh overflow-hidden">
      <AmbientLandscape />
      <div className="relative z-10 grid min-h-dvh lg:grid-cols-[45%_55%]">
        <aside className="relative hidden overflow-hidden px-12 py-10 lg:flex lg:flex-col">
          <StillMark href="/" title="STILL" />
          <div className="mt-auto pb-16">
            <p className="font-display text-5xl leading-[0.95] tracking-tight">
              the things
              <br />
              that still matter.
            </p>
            <ul className="mt-12 space-y-4 text-ink-soft">
              {FRAGMENTS.map((line) => (
                <li key={line} className="font-display text-xl italic tracking-tight opacity-80">
                  {line}
                </li>
              ))}
            </ul>
          </div>
        </aside>
        <section className="flex flex-col bg-bg/72 px-6 py-10 backdrop-blur-sm sm:px-12 lg:bg-paper/78 lg:px-16 lg:py-12">
          <div className="lg:hidden">
            <StillMark href="/" title="STILL" />
          </div>
          <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center pt-10 lg:pt-0">
            <p className="label mb-5">{eyebrow}</p>
            <h1 className="font-display text-[clamp(2.4rem,6vw,3.6rem)] leading-[0.95] tracking-tight">
              {title}
            </h1>
            <p className="mt-4 text-base leading-relaxed text-ink-soft">{lede}</p>
            <div className="mt-10">{children}</div>
          </div>
        </section>
      </div>
    </div>
  );
}
