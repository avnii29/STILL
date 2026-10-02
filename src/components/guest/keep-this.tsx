import Link from "next/link";

export function KeepThis({
  reason = "long-term",
  onDismiss,
}: {
  reason?: "long-term" | "reminder" | "sync" | "connect";
  onDismiss?: () => void;
}) {
  const copy = {
    "long-term": {
      title: "Keep them?",
      body: "These threads currently live only here. An account lets STILL carry them with you.",
    },
    reminder: {
      title: "Want me to hold onto this?",
      body: "An account lets STILL remember this even when this browser is closed.",
    },
    sync: {
      title: "Carry STILL with you.",
      body: "Sign in to keep your threads synchronized across devices.",
    },
    connect: {
      title: "Connect Telegram",
      body: "To connect a private source, create or sign into your STILL.",
    },
  }[reason];

  return (
    <section className="guest-keep">
      <p className="label">These threads currently live only here</p>
      <h2 className="mt-3 font-display text-[clamp(2rem,5vw,3.4rem)] leading-[0.95] tracking-tight">
        {copy.title}
      </h2>
      <p className="mt-4 max-w-md text-base leading-relaxed text-ink-soft">{copy.body}</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href="/auth/sign-up?next=%2Fstill%2Fkeep"
          className="inline-flex min-h-12 items-center rounded-md bg-ink px-5 text-sm text-paper"
        >
          Create your STILL
        </Link>
        <Link
          href="/auth/sign-in?next=%2Fstill%2Fkeep"
          className="inline-flex min-h-12 items-center px-4 text-sm"
        >
          Sign in
        </Link>
        {onDismiss ? (
          <button type="button" onClick={onDismiss} className="min-h-12 px-4 text-sm text-ink-soft">
            Not now
          </button>
        ) : (
          <Link href="/still" className="inline-flex min-h-12 items-center px-4 text-sm text-ink-soft">
            Not now
          </Link>
        )}
      </div>
    </section>
  );
}
