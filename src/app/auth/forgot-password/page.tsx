import { Suspense } from "react";
import { AuthForm } from "@/components/auth-form";
import { AuthShell } from "@/components/auth-shell";

export const dynamic = "force-dynamic";

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      eyebrow="Reset"
      title="Come back when you are ready."
      lede="We'll send a quiet link if that inbox belongs to STILL."
    >
      <Suspense>
        <AuthForm googleEnabled={false} intent="reset" />
      </Suspense>
    </AuthShell>
  );
}
