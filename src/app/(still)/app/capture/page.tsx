import { Suspense } from "react";
import { CaptureStudio } from "@/components/capture-studio";
import { FadeIn } from "@/components/fade-in";

export const dynamic = "force-dynamic";

export default function CapturePage() {
  return (
    <FadeIn>
      <p className="label mb-6">Capture</p>
      <h1 className="font-display text-[clamp(2.6rem,6vw,5.2rem)] leading-[0.95] tracking-tight">
        Tell me something you said you&apos;d do.
      </h1>
      <p className="mt-5 max-w-xl text-lg text-ink-soft">
        Type it, speak it, or paste the conversation. If a source cannot connect, forward or paste it here.
      </p>
      <div className="mt-12">
        <Suspense>
          <CaptureStudio />
        </Suspense>
      </div>
    </FadeIn>
  );
}
