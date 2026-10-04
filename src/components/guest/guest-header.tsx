import Link from "next/link";
import { StillMark } from "@/components/still-mark";

export function GuestHeader({ signedIn }: { signedIn: boolean }) {
  return (
    <header className="guest-header still-frame">
      <StillMark href="/still" title="STILL" />
      <nav aria-label="Guest STILL" className="ml-auto flex flex-wrap items-center gap-4 text-sm">
        <Link href="/still" className="min-h-11 inline-flex items-center">
          today
        </Link>
        <Link href="/still/memory" className="min-h-11 inline-flex items-center">
          Memory
        </Link>
        <Link href="/still/privacy" className="min-h-11 inline-flex items-center">
          Guest privacy
        </Link>
        {signedIn ? (
          <Link href="/home" className="min-h-11 inline-flex items-center">
            Enter
          </Link>
        ) : (
          <Link href="/auth/sign-in?next=%2Fstill%2Fkeep" className="min-h-11 inline-flex items-center">
            Sign in
          </Link>
        )}
      </nav>
    </header>
  );
}
