import { Suspense } from "react";
import { AuthForm } from "@/components/auth-form";
import { AuthShell } from "@/components/auth-shell";
import { captchaMode, getServerEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

export default function ResetPasswordPage() {
  const mode = captchaMode();
  return (
    <AuthShell
      eyebrow="Reset"
      title="choose a new password."
      lede="This replaces the password on your STILL account."
    >
      <Suspense>
        <AuthForm
          intent="reset"
          googleEnabled={false}
          captchaMode={mode}
          siteKey={mode === "active" ? getServerEnv().NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? null : null}
        />
      </Suspense>
    </AuthShell>
  );
}
