"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const STEPS = [
  {
    id: "conversation",
    label: "Conversation",
    title: "A line that would otherwise vanish.",
  },
  {
    id: "thread",
    label: "Thread",
    title: "Still keeps the context, not a checkbox.",
  },
  {
    id: "later",
    label: "Later",
    title: "It can wait without becoming a nag.",
  },
  {
    id: "next",
    label: "Next",
    title: "You choose. STILL does not write to them.",
  },
] as const;

export function AgentFlow() {
  const [step, setStep] = useState(0);

  return (
    <div className="mt-12">
      <div className="flex flex-wrap gap-2">
        {STEPS.map((item, index) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setStep(index)}
            className={`min-h-10 rounded-md px-3 text-sm ${
              step === index ? "bg-ink text-paper" : "border border-line text-ink-soft"
            }`}
            aria-pressed={step === index}
          >
            {item.label}
          </button>
        ))}
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="mt-10 max-w-2xl"
        >
          <p className="label mb-4">{STEPS[step].title}</p>
          {step === 0 ? (
            <div className="space-y-4 font-display text-3xl leading-snug tracking-tight sm:text-4xl">
              <p>
                <span className="text-ink-faint">You</span>
                <br />
                “Yeah, I&apos;ll send you the PDF tonight.”
              </p>
            </div>
          ) : null}
          {step === 1 ? (
            <ul className="space-y-3 text-lg text-ink-soft">
              <li>Promise</li>
              <li>To a person you named</li>
              <li>Send the PDF</li>
              <li>Tonight</li>
            </ul>
          ) : null}
          {step === 2 ? (
            <p className="font-display text-4xl tracking-tight">Still unresolved.</p>
          ) : null}
          {step === 3 ? (
            <div className="flex flex-wrap gap-3">
              <span className="rounded-md bg-ink px-4 py-3 text-sm text-paper">Send it</span>
              <span className="rounded-md border border-line px-4 py-3 text-sm">
                Ask if they still need it
              </span>
              <span className="rounded-md border border-line px-4 py-3 text-sm text-ink-soft">
                Let it go
              </span>
              <p className="mt-4 w-full text-sm text-ink-faint">
                These stay with you. Still does not send the message.
              </p>
            </div>
          ) : null}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
