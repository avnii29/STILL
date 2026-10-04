import { InteractiveLandscape } from "@/components/landscape";
import { LandingNav } from "@/components/landing/landing-nav";
import { StillExperience } from "@/components/experience/still-experience";
import { SiteFooter } from "@/components/site-footer";
import { getAuthUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function PublicExperiencePage() {
  const signedIn = Boolean(await getAuthUser());

  return (
    <div className="relative min-h-dvh still-world-page">
      <InteractiveLandscape />
      <LandingNav signedIn={signedIn} />
      <StillExperience />
      <SiteFooter />
    </div>
  );
}
