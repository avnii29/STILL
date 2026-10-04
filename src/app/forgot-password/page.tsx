import { Suspense } from "react";
import { AuthForm } from "@/components/auth-form";
import { AuthShell } from "@/components/auth-shell";
import { captchaMode, getServerEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

export default function ForgotPasswordPage() {
  const mode = captchaMode();
  return (
    <AuthShell
      eyebrow="Reset"
      title="we'll send a quiet link."
      lede="If an account exists for that address, the instructions will arrive there."
    >
      <Suspense>
        <AuthForm
          intent="forgot"
          googleEnabled={false}
          captchaMode={mode}
          siteKey={mode === "active" ? getServerEnv().NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? null : null}
        />
      </Suspense>
    </AuthShell>
  );
}
