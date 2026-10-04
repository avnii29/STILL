import { DemoDesk } from "@/components/demo/demo-desk";
import { GuestHeader } from "@/components/guest/guest-header";
import { TimeLandscape } from "@/components/landscape";
import { getAuthUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function DemoPage() {
  const user = await getAuthUser();
  return (
    <div className="relative min-h-dvh overflow-hidden still-guest-world">
      <TimeLandscape />
      <div className="relative z-10 flex min-h-dvh flex-col">
        <GuestHeader signedIn={Boolean(user)} />
        <main id="main" className="still-frame w-full flex-1 pb-20 pt-8">
          <p className="label">Demo</p>
          <h1 className="mt-4 font-display text-[clamp(2.4rem,6vw,4.4rem)] leading-[0.95] tracking-tight">
            A promise, then a check.
          </h1>
          <p className="mt-5 max-w-md text-lg text-ink-soft">
            Same world as STILL. The steps are the agent loop’s actual return value. Your account is not touched.
          </p>
          <div className="mt-10">
            <DemoDesk />
          </div>
        </main>
      </div>
    </div>
  );
}
