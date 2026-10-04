import { Suspense } from "react";
import { AuthForm } from "@/components/auth-form";
import { AuthShell } from "@/components/auth-shell";
import { captchaMode, getServerEnv, isGoogleAuthEnabled } from "@/lib/env";

export const dynamic = "force-dynamic";

export default function SignupPage() {
  const mode = captchaMode();
  return (
    <AuthShell
      eyebrow="Begin"
      title="keep the things that matter."
      lede="STILL notices a promise inside an ordinary sentence, and waits for you before it acts."
    >
      <Suspense>
        <AuthForm
          intent="sign-up"
          googleEnabled={isGoogleAuthEnabled()}
          captchaMode={mode}
          siteKey={mode === "active" ? getServerEnv().NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? null : null}
        />
      </Suspense>
    </AuthShell>
  );
}
