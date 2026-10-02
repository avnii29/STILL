import { FadeIn } from "@/components/fade-in";
import { DeleteAccount } from "@/components/delete-account";
import { PushEnableButton } from "@/components/push-enable-button";
import { SettingsForm } from "@/components/settings-form";
import { SignOutButton } from "@/components/sign-out-button";
import { requireOnboardedUser } from "@/lib/auth";
import { getServerEnv } from "@/lib/env";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireOnboardedUser();
  const prisma = getPrisma();
  const preference = await prisma.userPreference.findUnique({
    where: { userId: user.id },
  });
  const env = getServerEnv();

  return (
    <FadeIn>
      <p className="label mb-6">Settings</p>
      <h1 className="font-display text-[clamp(2.6rem,6vw,5.2rem)] leading-[0.95] tracking-tight">
        How Still lives with you.
      </h1>
      <p className="mt-5 max-w-xl text-lg text-ink-soft">
        A name, a timezone, and whether to nudge. Nothing here diagnoses you.
      </p>
      <div className="mt-12">
        <SettingsForm
          displayName={user.displayName ?? ""}
          timezone={user.timezone}
          emailNotifications={preference?.emailNotifications ?? true}
          webPushEnabled={preference?.webPushEnabled ?? false}
          followUpDays={preference?.followUpDays ?? 3}
        />
      </div>
      <div className="mt-12 max-w-md">
        <p className="label mb-3">Web push</p>
        <PushEnableButton vapidPublicKey={env.NEXT_PUBLIC_VAPID_PUBLIC_KEY} />
      </div>
      <div className="mt-12 max-w-md space-y-3 text-sm">
        <p>
          <a href="/settings/privacy" className="text-ink">
            Privacy
          </a>
          <span className="text-ink-faint"> — your conversations are yours.</span>
        </p>
        <p>
          <a href="/settings/memory" className="text-ink">
            Memory
          </a>
          <span className="text-ink-faint"> — what should STILL remember?</span>
        </p>
        <p>
          <a href="/integrations" className="text-ink">
            Sources
          </a>
          <span className="text-ink-faint"> — where do your promises happen?</span>
        </p>
      </div>
      <div className="mt-12">
        <p className="mb-3 text-sm text-ink-soft">{user.email}</p>
        <SignOutButton />
      </div>
      <DeleteAccount email={user.email} />
    </FadeIn>
  );
}
