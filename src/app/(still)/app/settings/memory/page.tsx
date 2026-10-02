import Link from "next/link";
import { FadeIn } from "@/components/fade-in";
import { MemoryPolicyForm } from "@/components/memory-policy-form";
import { requireOnboardedUser } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function MemorySettingsPage() {
  const user = await requireOnboardedUser();
  const prisma = getPrisma();
  const preference = await prisma.userPreference.findUnique({
    where: { userId: user.id },
  });

  return (
    <FadeIn>
      <p className="label mb-6">Memory</p>
      <h1 className="font-display text-[clamp(2.6rem,6vw,5.2rem)] leading-[0.95] tracking-tight">
        what should STILL remember?
      </h1>
      <p className="mt-5 max-w-xl text-lg text-ink-soft">
        Explicit reminders, clear commitments, deadlines, and resolution history are on by default.
        Possible commitments still need you. General conversation context stays off.
      </p>
      <MemoryPolicyForm
        rememberReminders={preference?.rememberReminders ?? true}
        rememberCommitments={preference?.rememberCommitments ?? true}
        rememberPossible={preference?.rememberPossible ?? false}
        rememberDeadlines={preference?.rememberDeadlines ?? true}
        rememberResolution={preference?.rememberResolution ?? true}
        rememberContext={preference?.rememberContext ?? false}
        autoRememberClear={preference?.autoRememberClear ?? false}
      />
      <p className="mt-10 text-sm">
        <Link href="/settings/privacy">Privacy and retention</Link>
      </p>
    </FadeIn>
  );
}
