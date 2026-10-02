"use client";

import { useState } from "react";

const CHOICES = ["Still want this", "Maybe later", "Not anymore"] as const;

export function FutureSelfDemo() {
  const [choice, setChoice] = useState<(typeof CHOICES)[number] | null>(null);

  return (
    <div className="mt-12 max-w-xl">
      <p className="label">6 weeks ago</p>
      <p className="mt-4 font-display text-3xl leading-snug tracking-tight sm:text-4xl">
        “After exams I&apos;ll finally build that thing.”
      </p>
      <p className="mt-8 text-lg text-ink-soft">Still want this?</p>
      <div className="mt-6 flex flex-wrap gap-3">
        {CHOICES.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setChoice(item)}
            className={`min-h-11 rounded-md px-4 text-sm ${
              choice === item ? "bg-ink text-paper" : "border border-line"
            }`}
          >
            {item}
          </button>
        ))}
      </div>
      {choice ? (
        <p className="mt-6 text-sm text-ink-faint" role="status">
          {choice === "Still want this"
            ? "It stays nearby, without becoming a deadline."
            : choice === "Maybe later"
              ? "Quiet for now. You can return when you mean it."
              : "Set aside. Nothing is kept as a score."}
        </p>
      ) : null}
    </div>
  );
}
