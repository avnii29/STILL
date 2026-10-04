import { redirect } from "next/navigation";
import { AmbientLandscape } from "@/components/landscape";
import { FirstRunExperience } from "@/components/first-run";
import { StillMark } from "@/components/still-mark";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const user = await requireUser();
  if (user.onboardingCompletedAt) redirect("/home");

  return (
    <div className="relative min-h-dvh overflow-hidden">
      <AmbientLandscape />
      <div className="relative z-10 still-frame py-10 sm:py-14">
        <StillMark href="/" title="STILL" />
        <div className="mt-14 max-w-2xl">
          <p className="label mb-6">Begin</p>
          <FirstRunExperience />
        </div>
      </div>
    </div>
  );
}
