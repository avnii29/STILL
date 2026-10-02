import { EnterStillLink } from "@/components/enter-still-link";

export function LandingNav({ signedIn }: { signedIn: boolean }) {
  const signIn = signedIn ? "/home" : "/auth/sign-in";
  const start = signedIn ? "/home" : "/still";

  return (
    <header className="landing-header" suppressHydrationWarning>
      <div className="landing-header-row">
        <a href="/" className="landing-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/still-mark.png" alt="" width={36} height={36} suppressHydrationWarning />
          <span>STILL</span>
        </a>
        <nav aria-label="Site" className="landing-nav-links" suppressHydrationWarning>
          <a href="#what">What it does</a>
          <a href="/legal/privacy">Privacy</a>
          <a href="/legal/terms">Terms</a>
        </nav>
        <div className="landing-nav-actions">
          <a href={signIn} className="landing-nav-signin">
            {signedIn ? "Enter" : "Sign in"}
          </a>
          <EnterStillLink href={start} className="landing-nav-start">
            {signedIn ? "Open STILL" : "Enter STILL"}
          </EnterStillLink>
        </div>
        <details className="landing-nav-menu">
          <summary>Menu</summary>
          <div className="landing-nav-drawer">
            <a href="#what">What it does</a>
            <a href="/legal/privacy">Privacy</a>
            <a href="/legal/terms">Terms</a>
            <a href={signIn}>{signedIn ? "Enter" : "Sign in"}</a>
            <EnterStillLink href={start}>{signedIn ? "Open STILL" : "Enter STILL"}</EnterStillLink>
          </div>
        </details>
      </div>
    </header>
  );
}
