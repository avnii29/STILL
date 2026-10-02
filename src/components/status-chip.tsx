import { cn } from "@/lib/utils";
import { THREAD_STATUS_COPY } from "@/lib/copy";

export function StatusChip({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm border border-line px-2 py-0.5 text-[0.68rem] tracking-[0.14em] uppercase text-ink-soft",
        status === "WAITING_ON_ME" && "border-accent/30 bg-accent-soft/60 text-accent",
        status === "NEEDS_REVIEW" && "border-line bg-paper",
      )}
    >
      {THREAD_STATUS_COPY[status] ?? status.toLowerCase()}
    </span>
  );
}
