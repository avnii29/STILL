import { Suspense } from "react";
import { AuthForm } from "@/components/auth-form";
import { AuthShell } from "@/components/auth-shell";
import { isGoogleAuthEnabled } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const keep = Boolean(next?.startsWith("/still") || next?.startsWith("/try"));
  return (
    <AuthShell
      eyebrow="Sign in"
      title={keep ? "keep what matters." : "Come back to what you meant."}
      lede={
        keep
          ? "Your threads are currently staying on this device. Sign in to carry them with you."
          : "Sign in to your STILL."
      }
    >
      <Suspense>
        <AuthForm googleEnabled={isGoogleAuthEnabled()} intent="sign-in" />
      </Suspense>
    </AuthShell>
  );
}
