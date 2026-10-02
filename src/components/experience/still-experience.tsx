"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { EnterStillLink } from "@/components/enter-still-link";
import { applyWorldTokens, holdIn, storyToDay, windowIn } from "@/lib/world/ink";

const THOUGHTS = [
  { id: "tomorrow", text: "yeah, I'll send it tomorrow", x: "58%", y: "18%", start: 0.14, peak: 0.22, end: 0.4, survive: true },
  { id: "remind", text: "don't let me forget", x: "72%", y: "34%", start: 0.16, peak: 0.24, end: 0.36, survive: false },
  { id: "friday", text: "Friday should work", x: "46%", y: "42%", start: 0.18, peak: 0.26, end: 0.35, survive: false },
  { id: "later", text: "I'll call you later", x: "78%", y: "52%", start: 0.17, peak: 0.25, end: 0.34, survive: false },
  { id: "tonight", text: "I'll call tonight.", x: "18%", y: "56%", start: 0.2, peak: 0.28, end: 0.36, survive: false },
  { id: "remind2", text: "remind me later.", x: "64%", y: "62%", start: 0.19, peak: 0.27, end: 0.35, survive: false },
] as const;

function applyWorld(root: HTMLElement, story: number) {
  const day = storyToDay(story);
  const documentElement = document.documentElement;
  documentElement.style.setProperty("--story", String(day));
  documentElement.style.setProperty("--day", String(day));
  applyWorldTokens(day);
  documentElement.dataset.worldHour =
    day < 0.15 ? "morning" : day < 0.35 ? "late" : day < 0.55 ? "afternoon" : day < 0.72 ? "gold" : day < 0.88 ? "evening" : "night";
  documentElement.dataset.navQuiet = day > 0.62 ? "true" : "false";
  documentElement.dataset.navGone = day > 0.9 ? "true" : "false";

  const setLayer = (selector: string, opacity: number) => {
    root.querySelectorAll<HTMLElement>(selector).forEach((node) => {
      node.style.opacity = String(opacity);
      node.style.pointerEvents = opacity > 0.35 ? "auto" : "none";
    });
  };

  setLayer("[data-moment='hero'], [data-bind='hero']", holdIn(story, -0.02, 0, 0.08, 0.16));
  setLayer("[data-moment='noticed']", holdIn(story, 0.36, 0.4, 0.48, 0.54));
  setLayer("[data-moment='meaning']", holdIn(story, 0.48, 0.54, 0.64, 0.72));
  setLayer("[data-moment='evening']", holdIn(story, 0.7, 0.76, 0.84, 0.9));
  setLayer("[data-moment='privacy']", holdIn(story, 0.78, 0.82, 0.86, 0.92));
  setLayer("[data-moment='night']", holdIn(story, 0.86, 0.9, 0.96, 1.08));

  THOUGHTS.forEach((thought) => {
    const node = root.querySelector<HTMLElement>(`[data-thought='${thought.id}']`);
    if (!node) return;
    const alive = thought.survive ? holdIn(story, thought.start, thought.peak, 0.5, 0.58) : windowIn(story, thought.start, thought.peak, thought.end);
    node.style.opacity = String(alive <= 0.12 ? 0 : Math.max(0.72, alive));
    node.style.filter = thought.survive && story > 0.38 ? "none" : `blur(${alive < 0.35 ? 1.2 : 0}px)`;
  });

  const thread = root.querySelector<SVGGeometryElement>("#still-thread");
  if (thread) {
    const length = thread.getTotalLength();
    const drawn = holdIn(story, 0.36, 0.46, 0.96, 1.05);
    thread.style.strokeDasharray = `${length}`;
    thread.style.strokeDashoffset = `${length * (1 - drawn)}`;
    thread.style.opacity = String(Math.min(1, drawn * 1.4));
  }

  const house = root.querySelector<HTMLElement>("[data-house-glow]");
  if (house) house.style.opacity = String(holdIn(story, 0.86, 0.92, 1, 1.1));

  window.dispatchEvent(new Event("still-scroll"));
}

export function StillExperience() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let dispose = () => {};
    let cancelled = false;

    const updateFromScroll = () => {
      const rect = root.getBoundingClientRect();
      const travel = Math.max(1, rect.height - window.innerHeight);
      applyWorld(root, Math.min(1, Math.max(0, -rect.top / travel)));
    };

    applyWorld(root, 0);
    window.addEventListener("scroll", updateFromScroll, { passive: true });

    void (async () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        dispose = () => window.removeEventListener("scroll", updateFromScroll);
        return;
      }
      const gsap = (await import("gsap")).default;
      const { ScrollTrigger } = await import("gsap/ScrollTrigger");
      if (cancelled) return;
      gsap.registerPlugin(ScrollTrigger);
      window.removeEventListener("scroll", updateFromScroll);
      const trigger = ScrollTrigger.create({
        trigger: root,
        start: "top top",
        end: "bottom bottom",
        scrub: 0.35,
        onUpdate: (self) => applyWorld(root, self.progress),
      });
      dispose = () => trigger.kill();
    })();

    return () => {
      cancelled = true;
      dispose();
      document.documentElement.style.removeProperty("--story");
      document.documentElement.dataset.navQuiet = "false";
      document.documentElement.dataset.navGone = "false";
    };
  }, []);

  return (
    <div ref={rootRef} id="what" className="still-living">
      <article className="sr-only">
        <h1>the things that still matter.</h1>
        <p>Things disappear. STILL remembers. Thoughts drift. One remains. STILL noticed. SEND IT tomorrow. Worth keeping? Still open. Not forgotten. You meant it. STILL kept it. Come back to what you meant.</p>
      </article>

      <div className="still-living-stage">
        <svg className="still-thread" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          <path
            id="still-thread"
            d="M 12 61 C 28 56 38 49 48 46 S 68 41 78 44 90 52 93 58"
            fill="none"
            stroke="currentColor"
            strokeWidth="0.28"
            strokeLinecap="round"
          />
        </svg>

        <div className="still-house-glow" data-house-glow aria-hidden />

        {THOUGHTS.map((thought) => (
          <p
            key={thought.id}
            data-thought={thought.id}
            className="still-thought"
            style={{ left: thought.x, top: thought.y }}
          >
            {thought.text}
          </p>
        ))}

        <section className="still-moment still-moment-hero" data-moment="hero">
          <p className="still-kicker">STILL</p>
          <h1 className="still-living-title">
            <span className="still-title-a">the things</span>
            <span className="still-title-b">that still matter.</span>
          </h1>
          <div className="still-hero-cta">
            <EnterStillLink href="/still" className="still-enter">
              Enter STILL
              <span aria-hidden> →</span>
            </EnterStillLink>
            <p className="still-scroll-hint">just scroll</p>
          </div>
        </section>
        <p className="still-moment still-hero-aside" data-bind="hero">
          things disappear.
        </p>
        <p className="still-moment still-hero-aside still-hero-aside-b still-moment-hold" data-bind="hero">
          STILL remembers.
        </p>

        <p className="still-moment still-moment-center still-moment-line" data-moment="noticed">
          STILL noticed.
        </p>

        <section className="still-moment still-moment-meaning" data-moment="meaning">
          <p className="still-meaning-human">I&apos;ll send it tomorrow.</p>
          <p className="still-meaning-system">
            <span>SEND IT</span>
            <span>TOMORROW</span>
          </p>
          <p className="still-moment-line">worth keeping?</p>
          <div className="still-choice">
            <EnterStillLink href="/still" className="still-enter still-enter-quiet">
              keep
            </EnterStillLink>
            <span className="still-let-go">let go</span>
          </div>
        </section>

        <section className="still-moment still-moment-right still-moment-stack" data-moment="evening">
          <p>still open.</p>
          <p>tomorrow.</p>
          <p>not forgotten.</p>
        </section>

        <section className="still-moment still-moment-left still-moment-stack" data-moment="privacy">
          <p>not everything.</p>
          <p>just what mattered.</p>
          <Link href="/legal/privacy" className="still-privacy-link">
            How STILL handles your data →
          </Link>
        </section>

        <section className="still-moment still-moment-finale" data-moment="night">
          <p className="still-moment-line">you meant it.</p>
          <p className="still-moment-hold">STILL kept it.</p>
          <h2 className="still-finale-title">come back to what you meant.</h2>
          <EnterStillLink href="/still" className="still-enter">
            Enter STILL
            <span aria-hidden> →</span>
          </EnterStillLink>
        </section>
      </div>
    </div>
  );
}
