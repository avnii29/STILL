"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { EnterStillLink } from "@/components/enter-still-link";
import { applyWorldTokens, holdIn, windowIn, storyToDay } from "@/lib/world/ink";

const FRAGMENTS = [
  { id: "tonight", text: "I'll send it tonight.", x: "62%", y: "22%", start: 0.11, peak: 0.14, end: 0.2 },
  { id: "yep", text: "Yep, I'll take care of that.", x: "18%", y: "34%", start: 0.12, peak: 0.15, end: 0.21 },
  { id: "her", text: "I'll get back to her tomorrow.", x: "58%", y: "46%", start: 0.13, peak: 0.16, end: 0.22 },
  { id: "week", text: "Remind me next week.", x: "28%", y: "58%", start: 0.14, peak: 0.17, end: 0.23 },
] as const;

const THREAD = [
  ["MON — 10:42", "commitment detected"],
  ["TUE — 09:10", "deadline approaching"],
  ["TUE — 16:37", "context changed"],
  ["TUE — 16:39", "STILL proposes an action"],
  ["TUE — 16:41", "you approve"],
  ["TUE — 16:42", "action completed"],
  ["TUE — 17:03", "commitment resolved"],
] as const;

const CHECKS = [
  "NEW EVENT",
  "Does this contain a commitment?",
  "What exactly was promised?",
  "What evidence supports it?",
  "When is it due?",
  "Has anything changed?",
  "Is intervention actually useful?",
  "Is an action justified?",
] as const;

const LIVE = [
  ["10:42", "commitment detected"],
  ["10:43", "thread created"],
  ["12:18", "calendar changed"],
  ["12:18", "context updated"],
  ["12:19", "intervention reconsidered"],
  ["12:19", "no action needed"],
] as const;

function layer(root: HTMLElement, selector: string, opacity: number) {
  root.querySelectorAll<HTMLElement>(selector).forEach((node) => {
    node.style.opacity = String(opacity);
    node.style.pointerEvents = opacity > 0.35 ? "auto" : "none";
  });
}

function applyWorld(root: HTMLElement, story: number) {
  const day = storyToDay(story);
  const documentElement = document.documentElement;
  documentElement.style.setProperty("--story", String(day));
  documentElement.style.setProperty("--day", String(day));
  applyWorldTokens(day);
  documentElement.dataset.worldHour =
    day < 0.15 ? "morning" : day < 0.35 ? "late" : day < 0.55 ? "afternoon" : day < 0.72 ? "gold" : day < 0.88 ? "evening" : "night";
  documentElement.dataset.navQuiet = day > 0.62 ? "true" : "false";
  documentElement.dataset.navGone = "false";

  layer(root, "[data-moment='hero'], [data-bind='hero']", holdIn(story, -0.02, 0, 0.06, 0.09));
  layer(root, "[data-moment='problem']", holdIn(story, 0.09, 0.11, 0.15, 0.18));
  layer(root, "[data-moment='moves']", holdIn(story, 0.17, 0.19, 0.23, 0.26));
  layer(root, "[data-moment='monday']", holdIn(story, 0.25, 0.27, 0.32, 0.35));
  layer(root, "[data-moment='tuesday']", holdIn(story, 0.34, 0.36, 0.42, 0.45));
  layer(root, "[data-moment='does']", holdIn(story, 0.44, 0.46, 0.54, 0.57));
  layer(root, "[data-moment='thread']", holdIn(story, 0.56, 0.58, 0.66, 0.69));
  layer(root, "[data-moment='works']", holdIn(story, 0.68, 0.7, 0.76, 0.79));
  layer(root, "[data-moment='control']", holdIn(story, 0.78, 0.8, 0.85, 0.88));
  layer(root, "[data-moment='sources']", holdIn(story, 0.87, 0.885, 0.92, 0.945));
  layer(root, "[data-moment='live']", holdIn(story, 0.93, 0.94, 0.955, 0.968));
  layer(root, "[data-moment='trust']", holdIn(story, 0.955, 0.962, 0.978, 0.988));
  layer(root, "[data-moment='night']", holdIn(story, 0.982, 0.99, 1, 1.08));

  FRAGMENTS.forEach((fragment) => {
    const node = root.querySelector<HTMLElement>(`[data-thought='${fragment.id}']`);
    if (!node) return;
    const alive = windowIn(story, fragment.start, fragment.peak, fragment.end);
    node.style.opacity = String(alive <= 0.08 ? 0 : Math.max(0.78, alive));
  });

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
    <div ref={rootRef} className="still-living">
      <span id="does" className="still-story-anchor" style={{ top: "46%" }} />
      <span id="works" className="still-story-anchor" style={{ top: "70%" }} />

      <article className="sr-only">
        <h1>the things that still matter.</h1>
        <p>
          Promises disappear. STILL doesn&apos;t. You don&apos;t forget everything. You forget where you said it.
          The conversation moves on. The promise doesn&apos;t. STILL remembers the thread. A promise is not a
          notification. It&apos;s a thread. Before STILL acts, it checks. STILL can act. It doesn&apos;t get to decide
          for you. AI proposes. You decide. Your life is not our training set. Some things are worth remembering.
        </p>
      </article>

      <div className="still-living-stage">
        {FRAGMENTS.map((fragment) => (
          <p key={fragment.id} data-thought={fragment.id} className="still-thought" style={{ left: fragment.x, top: fragment.y }}>
            {fragment.text}
          </p>
        ))}

        <section className="still-moment still-moment-hero" data-moment="hero">
          <p className="still-kicker">STILL</p>
          <h1 className="still-living-title">
            <span className="still-title-a">the things</span>
            <span className="still-title-b">that still</span>
            <span className="still-title-c">matter.</span>
          </h1>
          <p className="still-hero-lede">
            Conversations move fast. Commitments get buried. STILL keeps track of what you said you&apos;d do — and
            knows when it no longer needs your attention.
          </p>
          <div className="still-hero-cta">
            <EnterStillLink href="/still" className="still-enter">
              Enter STILL <span aria-hidden>{"\u2192"}</span>
            </EnterStillLink>
            <a href="#works" className="still-scroll-hint">
              see how it works <span aria-hidden>{"\u2193"}</span>
            </a>
          </div>
          <p className="still-hero-quiet">Your commitments. Your sources. Your control.</p>
        </section>
        <p className="still-moment still-hero-aside" data-bind="hero">
          Promises disappear.
          <span className="still-hero-aside-line">STILL doesn&apos;t.</span>
        </p>

        <section className="still-moment still-panel" data-moment="problem">
          <p className="still-kicker">The problem</p>
          <h2 className="still-statement">
            You don&apos;t forget everything.
            <span>You forget where you said it.</span>
          </h2>
        </section>

        <section className="still-moment still-panel" data-moment="moves">
          <h2 className="still-statement">
            The conversation moves on.
            <span className="still-moment-hold">The promise doesn&apos;t.</span>
          </h2>
        </section>

        <section className="still-moment still-panel" data-moment="monday">
          <p className="still-kicker">Monday — 10:42 AM</p>
          <p className="still-quote">Yep, I&apos;ll get the revised dataset to Maya by Tuesday evening.</p>
        </section>

        <section className="still-moment still-panel" data-moment="tuesday">
          <p className="still-kicker">Tuesday — 4:37 PM</p>
          <h2 className="still-statement">
            The promise is still there.
            <span>You just aren&apos;t looking at it anymore.</span>
          </h2>
          <p className="still-still-is">STILL is.</p>
        </section>

        <section className="still-moment still-panel still-panel-wide" data-moment="does">
          <h2 className="still-statement">STILL remembers the thread.</h2>
          <ol className="still-steps">
            <li>
              <span>01 — It notices</span>
              When you make a real commitment, STILL can recognize it from an authorized source.
            </li>
            <li>
              <span>02 — It keeps the evidence</span>
              Every commitment stays connected to where it came from.
              <figure className="still-evidence">
                <blockquote>I&apos;ll send the revised dataset to Maya by Tuesday evening.</blockquote>
                <figcaption>Source: Conversation — Due: Tuesday evening</figcaption>
              </figure>
            </li>
            <li>
              <span>03 — It keeps watching</span>
              A commitment isn&apos;t frozen in time.
            </li>
            <li>
              <span>04 — It knows when things change</span>
              If Tuesday becomes Friday, STILL updates the thread instead of reminding you about an old promise.
            </li>
            <li>
              <span>05 — It knows when to stop</span>
              When the commitment is fulfilled, cancelled, or no longer relevant, STILL backs off.
            </li>
          </ol>
        </section>

        <section className="still-moment still-panel still-panel-split" data-moment="thread">
          <div>
            <h2 className="still-statement">
              A promise is not a notification.
              <span>It&apos;s a thread.</span>
            </h2>
            <p className="still-aside-copy">
              STILL doesn&apos;t just remind you.
              <br />
              It follows what happens next.
            </p>
          </div>
          <ol className="still-timeline">
            {THREAD.map(([when, what]) => (
              <li key={when}>
                <time>{when}</time>
                <span>{what}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="still-moment still-panel" data-moment="works">
          <p className="still-kicker">Understanding</p>
          <h2 className="still-statement">Before STILL acts, it checks.</h2>
          <ol className="still-chain">
            {CHECKS.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <p className="still-aside-copy">
            The agents do the reasoning.
            <br />
            You keep the decision.
          </p>
        </section>

        <section className="still-moment still-panel" data-moment="control">
          <h2 className="still-statement">
            STILL can act.
            <span>It doesn&apos;t get to decide for you.</span>
          </h2>
          <figure className="still-approval">
            <p className="still-kicker">A commitment may slip.</p>
            <p>Your dataset is due today at 5:00 PM.</p>
            <p>There is a conflicting event at 4:00 PM.</p>
            <p>STILL suggests moving the event.</p>
            <p className="still-approval-meta">Why: deadline collision — Confidence: 91% — Risk: medium</p>
            <p className="still-approval-actions">Approve — Edit — Reject</p>
          </figure>
          <p className="still-aside-copy">
            AI proposes.
            <br />
            You decide.
          </p>
        </section>

        <section className="still-moment still-panel" data-moment="sources">
          <h2 className="still-statement">STILL lives where your commitments happen.</h2>
          <p className="still-aside-copy">Connect the sources you choose. STILL only works with what you authorize.</p>
          <ul className="still-sources">
            <li>
              <strong>Calendar</strong>
              <span>Google Calendar can be connected when its credentials are configured. Nothing is connected until you authorize it.</span>
            </li>
            <li>
              <strong>Messages</strong>
              <span>Coming with official provider access.</span>
            </li>
            <li>
              <strong>Documents</strong>
              <span>Coming with official provider access.</span>
            </li>
            <li>
              <strong>Email</strong>
              <span>Coming with official provider access.</span>
            </li>
            <li>
              <strong>Tasks</strong>
              <span>Coming with official provider access.</span>
            </li>
          </ul>
          <p className="still-aside-copy">
            Every connection tells you exactly what STILL can read, what it can change, and what it cannot.
          </p>
        </section>

        <section className="still-moment still-panel" data-moment="live">
          <h2 className="still-statement">When something changes, STILL changes with it.</h2>
          <ol className="still-timeline">
            {LIVE.map(([when, what]) => (
              <li key={`${when}-${what}`}>
                <time>{when}</time>
                <span>{what}</span>
              </li>
            ))}
          </ol>
          <p className="still-aside-copy">
            Real events in.
            <br />
            Real decisions out.
          </p>
        </section>

        <section className="still-moment still-panel" data-moment="trust">
          <h2 className="still-statement">Your life is not our training set.</h2>
          <p className="still-aside-copy">
            You should know what we have, why we have it, and what we can do with it.
          </p>
          <ul className="still-principles">
            <li>
              <strong>You choose the source.</strong> No connection is assumed.
            </li>
            <li>
              <strong>You see the evidence.</strong> Commitments remain tied to the source that created them.
            </li>
            <li>
              <strong>You control actions.</strong> Consequential actions require your approval.
            </li>
          </ul>
          <p className="still-aside-copy">Disconnect a source. Delete your account. Leave.</p>
          <Link href="/legal/privacy" className="still-privacy-link">
            Privacy <span aria-hidden>{"\u2192"}</span>
          </Link>
        </section>

        <section className="still-moment still-moment-finale" data-moment="night">
          <p className="still-kicker">STILL</p>
          <h2 className="still-finale-title">Some things are worth remembering.</h2>
          <p className="still-aside-copy">Keep the promises that still matter.</p>
          <EnterStillLink href="/still" className="still-enter">
            Enter STILL <span aria-hidden>{"\u2192"}</span>
          </EnterStillLink>
          <p className="still-hero-quiet">
            Already have an account? <Link href="/login">Sign in</Link>.
          </p>
        </section>
      </div>
    </div>
  );
}
