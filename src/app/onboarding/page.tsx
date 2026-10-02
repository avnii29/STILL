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
      <div className="relative z-10 px-6 py-10 sm:px-12">
        <StillMark href="/" title="STILL" />
        <div className="mx-auto mt-20 max-w-2xl">
          <p className="label mb-6">Begin</p>
          <FirstRunExperience />
        </div>
      </div>
    </div>
  );
}
