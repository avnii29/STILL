import { EnterStillLink } from "@/components/enter-still-link";

export function LandingNav({ signedIn }: { signedIn: boolean }) {
  const signIn = signedIn ? "/app" : "/login";
  const start = signedIn ? "/app" : "/still";

  return (
    <header className="landing-header" suppressHydrationWarning>
      <div className="landing-header-row">
        {/* The brand mark stays an anchor so the original landing header is unchanged. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/" className="landing-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/still-mark.png" alt="" width={36} height={36} suppressHydrationWarning />
          <span>STILL</span>
        </a>
        <nav aria-label="Site" className="landing-nav-links" suppressHydrationWarning>
          <a href="#does">What it does</a>
          <a href="#works">How it works</a>
          <a href="/legal/privacy">Privacy</a>
        </nav>
        <div className="landing-nav-actions">
          <a href={signIn} className="landing-nav-signin">
            {signedIn ? "Enter" : "Sign in"}
          </a>
          <EnterStillLink href={start} className="landing-nav-start">
            Enter STILL →
          </EnterStillLink>
        </div>
        <details className="landing-nav-menu">
          <summary>Menu</summary>
          <div className="landing-nav-drawer">
            <a href="#does">What it does</a>
            <a href="#works">How it works</a>
            <a href="/legal/privacy">Privacy</a>
            <a href={signIn}>{signedIn ? "Enter" : "Sign in"}</a>
            <EnterStillLink href={start}>Enter STILL →</EnterStillLink>
          </div>
        </details>
      </div>
    </header>
  );
}
