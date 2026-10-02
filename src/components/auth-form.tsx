"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { guestMemoryCount } from "@/lib/guest/client";
import { createBrowserSupabase, isBrowserSupabaseConfigured } from "@/lib/supabase/browser";

type Intent = "sign-in" | "sign-up" | "reset";

function safeNext(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/api/")) {
    return "/home";
  }
  if (value === "/login" || value === "/signup" || value.startsWith("/auth/")) return "/home";
  return value;
}

export function AuthForm({
  googleEnabled,
  intent = "sign-in",
}: {
  googleEnabled: boolean;
  intent?: Intent;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNext(searchParams.get("next"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState<string | null>(
    searchParams.get("error") === "auth" ? "That sign-in link did not work." : null,
  );
  const [busy, setBusy] = useState(false);
  const configured = isBrowserSupabaseConfigured();
  const signingUp = intent === "sign-up";
  const development = process.env.NODE_ENV !== "production";

  async function afterSession() {
    const response = await fetch("/api/auth/signed-in", { method: "POST" });
    const payload = (await response.json()) as { onboardingCompleted?: boolean };
    if ((await guestMemoryCount()) > 0) {
      router.push("/still/keep");
      router.refresh();
      return;
    }
    const destination =
      payload.onboardingCompleted || next.startsWith("/still") ? next : "/onboarding";
    router.push(destination);
    router.refresh();
  }

  async function signInPassword(event: React.FormEvent) {
    event.preventDefault();
    if (!configured) return;
    setBusy(true);
    setMessage(null);
    const supabase = createBrowserSupabase();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setBusy(false);
      setMessage("That email or password did not match.");
      return;
    }
    await afterSession();
  }

  async function signUp(event: React.FormEvent) {
    event.preventDefault();
    if (!configured) return;
    setBusy(true);
    setMessage(null);
    const supabase = createBrowserSupabase();
    const origin = window.location.origin;
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name.trim() || undefined },
        emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (error) {
      setBusy(false);
      const text = error.message.toLowerCase();
      setMessage(
        text.includes("already")
          ? "That email is already registered. Sign in instead."
          : text.includes("password")
            ? "Password must contain at least 8 characters."
            : "STILL could not create that account. Try again.",
      );
      return;
    }
    if (data.session) {
      await fetch("/api/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purpose: "terms", source: "sign-up" }),
      });
      await afterSession();
      return;
    }
    setBusy(false);
    setMessage("Check your email if confirmation is required. Then come back here.");
  }

  async function resetPassword(event: React.FormEvent) {
    event.preventDefault();
    if (!configured) return;
    setBusy(true);
    setMessage(null);
    const supabase = createBrowserSupabase();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent("/home")}`,
    });
    setBusy(false);
    setMessage(
      error
        ? "STILL couldn't finish that. Try again."
        : "If that inbox exists, a reset link is on its way.",
    );
  }

  async function google() {
    if (!configured || !googleEnabled) return;
    const supabase = createBrowserSupabase();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
  }

  if (!configured) {
    return (
      <div className="max-w-md text-base leading-relaxed text-ink-soft">
        <p>STILL isn&apos;t connected to its memory service yet.</p>
        {development ? (
          <p className="mt-3">
            Please configure the project environment
            {intent === "sign-up"
              ? " before creating an account."
              : intent === "reset"
                ? " before resetting a password."
                : " before signing in."}
          </p>
        ) : (
          <p className="mt-3">Try again in a moment.</p>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-md">
      <form
        onSubmit={intent === "reset" ? resetPassword : signingUp ? signUp : signInPassword}
        className="flex flex-col gap-4"
      >
        {signingUp ? (
          <label className="flex flex-col gap-2 text-sm text-ink-soft" htmlFor="still-name">
            Name
            <input
              id="still-name"
              type="text"
              autoComplete="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="min-h-12 rounded-md border border-line bg-paper px-3 text-ink"
            />
          </label>
        ) : null}
        <label className="flex flex-col gap-2 text-sm text-ink-soft" htmlFor="still-email">
          Email
          <input
            id="still-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="min-h-12 rounded-md border border-line bg-paper px-3 text-ink"
          />
        </label>
        {intent !== "reset" ? (
          <label className="flex flex-col gap-2 text-sm text-ink-soft" htmlFor="still-password">
            Password
            <input
              id="still-password"
              type="password"
              required
              minLength={8}
              autoComplete={signingUp ? "new-password" : "current-password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="min-h-12 rounded-md border border-line bg-paper px-3 text-ink"
            />
          </label>
        ) : null}
        {next.startsWith("/still") || next.startsWith("/try") ? (
          <p className="text-sm leading-relaxed text-ink-soft">
            Your threads are currently staying on this device. Sign in to carry them with you. Nothing
            is uploaded until you choose what to bring.
          </p>
        ) : null}
        {signingUp ? (
          <p className="text-sm leading-relaxed text-ink-soft">
            By creating an account, you agree to the{" "}
            <Link href="/legal/terms" className="text-ink underline">
              Terms of Use
            </Link>{" "}
            and acknowledge the{" "}
            <Link href="/legal/privacy" className="text-ink underline">
              Privacy Policy
            </Link>
            .
          </p>
        ) : null}
        <button
          type="submit"
          disabled={busy}
          className="mt-2 min-h-12 rounded-md bg-ink px-5 text-sm text-paper disabled:opacity-60"
        >
          {intent === "reset"
            ? "Send a reset link"
            : signingUp
              ? "Continue with email"
              : "Continue with email"}
        </button>
      </form>

      {googleEnabled && intent !== "reset" ? (
        <button
          type="button"
          onClick={google}
          className="mt-6 min-h-12 w-full rounded-md border border-line px-5 text-sm text-ink"
        >
          Continue with Google
        </button>
      ) : null}

      <div className="mt-8 space-y-2 text-sm text-ink-soft">
        {intent === "sign-in" ? (
          <>
            <p>
              <Link href="/auth/forgot-password" className="text-ink">
                Forgot password?
              </Link>
            </p>
            <p>
              <Link href={`/auth/sign-up?next=${encodeURIComponent(next)}`} className="text-ink">
                Create an account
              </Link>
            </p>
          </>
        ) : null}
        {intent === "sign-up" ? (
          <p>
            Already have an account?{" "}
            <Link href={`/auth/sign-in?next=${encodeURIComponent(next)}`} className="text-ink">
              Sign in
            </Link>
          </p>
        ) : null}
        {intent !== "reset" ? (
          <p>
            <Link href="/still" className="text-ink-soft">
              Not now
            </Link>
          </p>
        ) : null}
        {intent === "reset" ? (
          <p>
            <Link href="/auth/sign-in" className="text-ink">
              Back to sign in
            </Link>
          </p>
        ) : null}
      </div>

      {message ? (
        <p className="mt-6 text-sm leading-relaxed text-ink-soft" role="status" aria-live="polite">
          {message}
        </p>
      ) : null}
    </div>
  );
}
