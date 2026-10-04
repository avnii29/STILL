"use client";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="still-frame min-h-dvh py-24">
      <p className="label mb-4">Interrupted</p>
      <h1 className="font-display text-4xl tracking-tight">Something got lost.</h1>
      <p className="mt-4 max-w-md text-ink-soft">STILL couldn&apos;t finish that. Try again.</p>
      <button
        type="button"
        onClick={reset}
        className="mt-8 min-h-11 rounded-md border border-line px-4 text-sm"
      >
        Try again
      </button>
    </div>
  );
}
