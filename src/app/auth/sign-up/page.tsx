import { Suspense } from "react";
import { AuthForm } from "@/components/auth-form";
import { AuthShell } from "@/components/auth-shell";
import { isGoogleAuthEnabled } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const keep = Boolean(next?.startsWith("/still") || next?.startsWith("/try"));
  return (
    <AuthShell
      eyebrow={keep ? "Carry them" : "Begin"}
      title={keep ? "keep what matters." : "Start remembering differently."}
      lede={
        keep
          ? "Your threads are currently staying on this device. Sign in to carry them with you."
          : "An account is yours. STILL does not write to another person on your behalf."
      }
    >
      <Suspense>
        <AuthForm googleEnabled={isGoogleAuthEnabled()} intent="sign-up" />
      </Suspense>
    </AuthShell>
  );
}
