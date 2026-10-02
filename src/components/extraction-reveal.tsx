"use client";

type Extraction = {
  is_commitment: boolean;
  normalized_commitment: string;
  commitment_text: string;
  person: string | null;
  deadline: string | null;
  evidence: string;
  uncertain: boolean;
};

export function ExtractionReveal({
  extraction,
  original,
  busy,
  message,
  rememberLabel = "Remember this",
  onRemember,
  onEdit,
  onDismiss,
}: {
  extraction: Extraction;
  original: string;
  busy: boolean;
  message?: string | null;
  rememberLabel?: string;
  onRemember: () => void;
  onEdit: () => void;
  onDismiss?: () => void;
}) {
  const found = extraction.is_commitment || extraction.uncertain;

  return (
    <div className="max-w-xl">
      <p className="text-lg leading-relaxed text-ink-soft">{original}</p>
      <div className="still-thread-line mt-8 origin-left" />
      <p className="label mt-10">STILL kept</p>
      <h2 className="mt-4 font-display text-[clamp(2rem,5vw,3.6rem)] leading-[0.95] tracking-tight">
        {extraction.normalized_commitment || extraction.commitment_text}
      </h2>
      {extraction.person ? (
        <p className="mt-6 font-display text-3xl tracking-tight">{extraction.person}</p>
      ) : null}
      {extraction.deadline ? (
        <p className="mt-2 font-display text-3xl tracking-tight text-ink-soft">{extraction.deadline}</p>
      ) : null}
      <p className="mt-10 font-display text-2xl tracking-tight">
        {found ? "I found something worth remembering." : "STILL will not invent a commitment from this."}
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        {found ? (
          <button
            type="button"
            disabled={busy}
            onClick={onRemember}
            className="min-h-12 rounded-md bg-ink px-5 text-sm text-paper disabled:opacity-60"
          >
            {rememberLabel}
          </button>
        ) : null}
        <button type="button" onClick={onEdit} className="min-h-12 px-4 text-sm">
          {found ? "Not quite" : "Edit"}
        </button>
        {onDismiss ? (
          <button type="button" onClick={onDismiss} className="min-h-12 px-4 text-sm text-ink-soft">
            Let it go
          </button>
        ) : null}
      </div>
      {message ? (
        <p className="mt-6 whitespace-pre-wrap text-sm text-ink-soft" role="status" aria-live="polite">
          {message}
        </p>
      ) : null}
    </div>
  );
}
