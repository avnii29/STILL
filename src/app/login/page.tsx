import { Suspense } from "react";
import { AuthForm } from "@/components/auth-form";
import { AuthShell } from "@/components/auth-shell";
import { captchaMode, getServerEnv, isGoogleAuthEnabled } from "@/lib/env";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  const mode = captchaMode();
  return (
    <AuthShell
      eyebrow="Sign in"
      title="come back to what you meant."
      lede="Sign in to the promises STILL is still holding."
    >
      <Suspense>
        <AuthForm
          intent="sign-in"
          googleEnabled={isGoogleAuthEnabled()}
          captchaMode={mode}
          siteKey={mode === "active" ? getServerEnv().NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? null : null}
        />
      </Suspense>
    </AuthShell>
  );
}
