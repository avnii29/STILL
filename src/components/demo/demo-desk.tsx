"use client";

import { useState } from "react";

type Step = {
  agent: string;
  ok: boolean;
  decision: string;
  confidence: number;
  evidence: string[];
};

type DemoPayload = {
  label: string;
  stage: string;
  steps: Step[];
  commitment: {
    text: string;
    person: string | null;
    dueText: string | null;
    precision: string;
    confidence: number;
    evidence: string;
  } | null;
  proposal: { title: string; reason: string; risk: string } | null;
  gate: { status: string; reason: string; risk: string } | null;
  deadlineChange: { from: string; to: string } | null;
  intervention: { intervene: boolean; reason: string };
};

export function DemoDesk() {
  const [payload, setPayload] = useState<DemoPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(stage: DemoPayload["stage"]) {
    setBusy(true);
    setError(null);
    const response = await fetch("/api/demo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage }),
    });
    const body = (await response.json()) as DemoPayload & { error?: string };
    setBusy(false);
    if (!response.ok) {
      setError(body.error ?? "STILL could not run that.");
      return;
    }
    setPayload(body);
  }

  return (
    <div className="max-w-2xl">
      <div className="flex flex-wrap gap-3">
        <button type="button" disabled={busy} onClick={() => run("capture")} className="min-h-12 rounded-md bg-ink px-5 text-sm text-paper disabled:opacity-60">
          Run scenario
        </button>
        <button type="button" disabled={busy || !payload} onClick={() => run("forward")} className="min-h-12 rounded-md border border-line bg-paper/80 px-5 text-sm disabled:opacity-60">
          Fast forward
        </button>
        <button type="button" disabled={busy || !payload} onClick={() => run("approve")} className="min-h-12 rounded-md border border-line bg-paper/80 px-5 text-sm disabled:opacity-60">
          Approve
        </button>
        <button type="button" disabled={busy || !payload} onClick={() => run("followup")} className="min-h-12 rounded-md border border-line bg-paper/80 px-5 text-sm disabled:opacity-60">
          Friday is fine
        </button>
        <button
          type="button"
          onClick={() => {
            setPayload(null);
            setError(null);
          }}
          className="min-h-11 px-4 text-sm"
        >
          Reset
        </button>
      </div>
      {error ? <p className="mt-6 text-sm text-ink-soft">{error}</p> : null}
      {payload ? (
        <div className="mt-10" aria-live="polite">
          <p className="label">{payload.label}</p>
          {payload.commitment ? (
            <div className="mt-10">
              <p className="text-lg leading-relaxed text-ink-soft">“{payload.commitment.evidence}”</p>
              <div className="still-thread-line mt-8 origin-left" />
              {payload.commitment.person ? (
                <p className="mt-8 font-display text-4xl tracking-tight">{payload.commitment.person.toUpperCase()}</p>
              ) : null}
              <p className="mt-2 font-display text-4xl tracking-tight text-ink-soft">
                {(payload.commitment.dueText ?? "No hard deadline").toUpperCase()}
              </p>
              <p className="mt-3 text-sm text-ink-faint">
                {payload.commitment.precision} · {Math.round(payload.commitment.confidence * 100)}%
              </p>
            </div>
          ) : null}
          {payload.deadlineChange ? (
            <p className="mt-6 font-display text-3xl tracking-tight">
              {payload.deadlineChange.from} → {payload.deadlineChange.to}
            </p>
          ) : null}
          {payload.proposal ? (
            <div className="mt-8 rounded-md border border-line p-5">
              <p className="label">Still paused</p>
              <p className="mt-3 font-display text-2xl tracking-tight">{payload.proposal.title}</p>
              <p className="mt-3 text-ink-soft">{payload.proposal.reason}</p>
              <p className="mt-3 text-sm text-ink-faint">Risk {payload.proposal.risk}</p>
            </div>
          ) : null}
          {payload.gate ? (
            <p className="mt-4 text-ink-soft">
              {payload.gate.status}. {payload.gate.reason}
            </p>
          ) : null}
          <p className="mt-6 text-ink-soft">{payload.intervention.reason}</p>
          <ol className="mt-8 space-y-4">
            {payload.steps.map((item) => (
              <li key={`${payload.stage}-${item.agent}`}>
                <p className="label">
                  {item.ok ? "ok" : "stopped"} · {item.agent}
                </p>
                <p className="mt-1">{item.decision}</p>
              </li>
            ))}
          </ol>
        </div>
      ) : (
        <p className="mt-10 max-w-xl text-ink-soft">
          Alex asks for the revised dataset by Tuesday. You say you’ll get it to Maya by Tuesday evening. The buttons
          above run that text through the same agents as a real capture. This page does not save it.
        </p>
      )}
    </div>
  );
}
