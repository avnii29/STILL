"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PasswordField } from "@/components/auth/password-field";
import { TurnstileWidget } from "@/components/auth/turnstile-widget";
import { guestMemoryCount } from "@/lib/guest/client";
import {
  authFailureMessage,
  confirmationError,
  emailError,
  normalizeEmail,
  passwordError,
  safeAuthNext,
} from "@/lib/auth/policy";
import type { CaptchaMode } from "@/lib/env";
import { createBrowserSupabase, isBrowserSupabaseConfigured } from "@/lib/supabase/browser";

type Intent = "sign-in" | "sign-up" | "forgot" | "reset";

const DEMO_EMAIL = "abc@gmail.com";
const DEMO_PASSWORD = "abc123";

export function AuthForm({
  intent,
  googleEnabled,
  captchaMode,
  siteKey,
}: {
  intent: Intent;
  googleEnabled: boolean;
  captchaMode: CaptchaMode;
  siteKey: string | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeAuthNext(searchParams.get("next"));
  const emailRef = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [emailMessage, setEmailMessage] = useState<string | null>(null);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [confirmMessage, setConfirmMessage] = useState<string | null>(null);
  const [termsMessage, setTermsMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(
    searchParams.get("error") === "auth" ? "That sign-in link did not work." : null,
  );
  const [notice, setNotice] = useState<string | null>(null);
  const [maskedEmail, setMaskedEmail] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [token, setToken] = useState("");
  const [resetKey, setResetKey] = useState(0);
  const configured = isBrowserSupabaseConfigured();
  const development = process.env.NODE_ENV !== "production";
  const blocked = captchaMode === "unavailable";

  function clearMessages() {
    setEmailMessage(null);
    setPasswordMessage(null);
    setConfirmMessage(null);
    setTermsMessage(null);
    setFormError(null);
    setNotice(null);
  }

  function expireCaptcha() {
    setToken("");
    setResetKey((value) => value + 1);
  }

  async function readError(response: Response) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    return typeof payload?.error === "string" ? payload.error : authFailureMessage("generic");
  }

  async function enterApp(destination: string) {
    if ((await guestMemoryCount()) > 0 && destination.startsWith("/still")) {
      router.push(destination);
    } else {
      router.push(destination);
    }
    router.refresh();
  }

  async function signIn(event: FormEvent) {
    event.preventDefault();
    clearMessages();
    const emailIssue = emailError(email);
    const passwordIssue = passwordError(password, "current");
    if (emailIssue) {
      setEmailMessage(emailIssue);
      emailRef.current?.focus();
      return;
    }
    if (passwordIssue) {
      setPasswordMessage(passwordIssue);
      return;
    }
    if (captchaMode === "active" && !token) {
      setFormError(authFailureMessage("captcha"));
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/auth/sign-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: normalizeEmail(email),
          password,
          captchaToken: token || undefined,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      });
      if (!response.ok) {
        setFormError(await readError(response));
        expireCaptcha();
        setBusy(false);
        return;
      }
      await enterApp(next);
    } catch {
      setFormError(authFailureMessage("network"));
      expireCaptcha();
      setBusy(false);
    }
  }

  async function signUp(event: FormEvent) {
    event.preventDefault();
    clearMessages();
    const emailIssue = emailError(email);
    const passwordIssue = passwordError(password, "new");
    const confirmIssue = confirmationError(password, confirm);
    if (emailIssue) {
      setEmailMessage(emailIssue);
      emailRef.current?.focus();
      return;
    }
    if (passwordIssue) {
      setPasswordMessage(passwordIssue);
      return;
    }
    if (confirmIssue) {
      setConfirmMessage(confirmIssue);
      return;
    }
    if (!accepted) {
      setTermsMessage("Please agree to the terms to create an account.");
      return;
    }
    if (captchaMode === "active" && !token) {
      setFormError(authFailureMessage("captcha"));
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/auth/sign-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: normalizeEmail(email),
          password,
          acceptedTerms: true,
          captchaToken: token || undefined,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          next,
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        session?: boolean;
        confirmationRequired?: boolean;
        maskedEmail?: string;
        destination?: string;
      } | null;
      if (!response.ok) {
        setFormError(typeof payload?.error === "string" ? payload.error : authFailureMessage("generic"));
        expireCaptcha();
        setBusy(false);
        return;
      }
      if (payload?.confirmationRequired) {
        setMaskedEmail(payload.maskedEmail ?? "your inbox");
        setBusy(false);
        expireCaptcha();
        return;
      }
      await enterApp(payload?.destination ?? "/app");
    } catch {
      setFormError(authFailureMessage("network"));
      expireCaptcha();
      setBusy(false);
    }
  }

  async function forgot(event: FormEvent) {
    event.preventDefault();
    clearMessages();
    const emailIssue = emailError(email);
    if (emailIssue) {
      setEmailMessage(emailIssue);
      emailRef.current?.focus();
      return;
    }
    if (captchaMode === "active" && !token) {
      setFormError(authFailureMessage("captcha"));
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizeEmail(email), captchaToken: token || undefined }),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string; message?: string } | null;
      if (!response.ok) {
        setFormError(typeof payload?.error === "string" ? payload.error : authFailureMessage("generic"));
        expireCaptcha();
        setBusy(false);
        return;
      }
      setNotice(payload?.message ?? "If an account exists for that address, we'll send instructions to reset your password.");
      expireCaptcha();
      setBusy(false);
    } catch {
      setFormError(authFailureMessage("network"));
      expireCaptcha();
      setBusy(false);
    }
  }

  async function reset(event: FormEvent) {
    event.preventDefault();
    clearMessages();
    const passwordIssue = passwordError(password, "new");
    const confirmIssue = confirmationError(password, confirm);
    if (passwordIssue) {
      setPasswordMessage(passwordIssue);
      return;
    }
    if (confirmIssue) {
      setConfirmMessage(confirmIssue);
      return;
    }
    if (captchaMode === "active" && !token) {
      setFormError(authFailureMessage("captcha"));
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, captchaToken: token || undefined }),
      });
      if (!response.ok) {
        setFormError(await readError(response));
        expireCaptcha();
        setBusy(false);
        return;
      }
      await enterApp("/app");
    } catch {
      setFormError(authFailureMessage("network"));
      expireCaptcha();
      setBusy(false);
    }
  }

  async function resend() {
    if (!maskedEmail) return;
    setBusy(true);
    setFormError(null);
    try {
      const response = await fetch("/api/auth/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: normalizeEmail(email),
          captchaToken: token || undefined,
          next,
        }),
      });
      if (!response.ok) {
        setFormError(await readError(response));
        expireCaptcha();
      } else {
        setNotice("If the inbox is still waiting, another link is on its way.");
        expireCaptcha();
      }
    } catch {
      setFormError(authFailureMessage("network"));
    }
    setBusy(false);
  }

  async function google() {
    if (!googleEnabled || !configured || blocked) return;
    clearMessages();
    if (captchaMode === "active" && !token) {
      setFormError(authFailureMessage("captcha"));
      return;
    }
    setBusy(true);
    try {
      const gate = await fetch("/api/auth/captcha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ captchaToken: token || undefined }),
      });
      if (!gate.ok) {
        setFormError(await readError(gate));
        expireCaptcha();
        setBusy(false);
        return;
      }
      const supabase = createBrowserSupabase();
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        },
      });
    } catch {
      setFormError(authFailureMessage("network"));
      setBusy(false);
    }
  }

  if (!configured) {
    return (
      <div className="max-w-md text-base leading-relaxed text-ink-soft">
        <p>STILL isn&apos;t connected to its account service yet.</p>
        {development ? <p className="mt-3">Add the Supabase URL and publishable key before signing in.</p> : null}
      </div>
    );
  }

  if (maskedEmail) {
    return (
      <div className="max-w-md">
        <p className="font-display text-4xl tracking-tight">check your inbox.</p>
        <p className="mt-4 text-base leading-relaxed text-ink-soft">
          we sent a verification link to {maskedEmail}.
        </p>
        <div className="mt-8 flex flex-col gap-3">
          <Link href="/login" className="inline-flex min-h-12 items-center text-sm text-ink">
            Back to sign in
          </Link>
          <button type="button" onClick={() => void resend()} disabled={busy} className="min-h-12 text-left text-sm text-ink-soft disabled:opacity-60">
            {busy ? "Sending…" : "Resend verification"}
          </button>
        </div>
        {captchaMode === "active" && siteKey ? (
          <div className="mt-6">
            <TurnstileWidget siteKey={siteKey} resetKey={resetKey} onToken={setToken} />
          </div>
        ) : null}
        {notice ? <p className="mt-6 text-sm text-ink-soft">{notice}</p> : null}
        {formError ? (
          <p className="mt-4 text-sm text-ink" role="alert">
            {formError}
          </p>
        ) : null}
      </div>
    );
  }

  const submitLabel =
    intent === "sign-up"
      ? busy
        ? "Creating account…"
        : "Create account"
      : intent === "forgot"
        ? busy
          ? "Sending…"
          : "Send reset link"
        : intent === "reset"
          ? busy
            ? "Saving…"
            : "Save password"
          : busy
            ? "Signing in…"
            : "Sign in";

  return (
    <div className="max-w-md">
      <form
        onSubmit={intent === "sign-up" ? signUp : intent === "forgot" ? forgot : intent === "reset" ? reset : signIn}
        className="flex flex-col gap-5"
        noValidate
      >
        {intent !== "reset" ? (
          <div className="flex flex-col gap-2">
            <label htmlFor="still-email" className="text-sm text-ink-soft">
              Email
            </label>
            <input
              ref={emailRef}
              id="still-email"
              type="email"
              required
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              aria-invalid={Boolean(emailMessage)}
              aria-describedby={emailMessage ? "still-email-error" : undefined}
              className="min-h-12 rounded-md border border-line bg-paper/95 px-3 text-base text-ink outline-none transition motion-reduce:transition-none focus-visible:border-ink focus-visible:ring-2 focus-visible:ring-ink/15"
            />
            {emailMessage ? (
              <p id="still-email-error" className="text-sm text-ink" role="alert">
                {emailMessage}
              </p>
            ) : null}
          </div>
        ) : null}

        {intent !== "forgot" ? (
          <PasswordField
            id="still-password"
            label="Password"
            value={password}
            onChange={setPassword}
            autoComplete={intent === "sign-in" ? "current-password" : "new-password"}
            error={passwordMessage}
            hint={intent === "sign-in" || passwordMessage ? null : "Use at least 8 characters."}
          />
        ) : null}

        {intent === "sign-up" || intent === "reset" ? (
          <PasswordField
            id="still-confirm"
            label="Confirm password"
            value={confirm}
            onChange={setConfirm}
            autoComplete="new-password"
            error={confirmMessage}
          />
        ) : null}

        {intent === "sign-up" ? (
          <div>
            <label className="flex items-start gap-3 text-sm leading-relaxed text-ink-soft" htmlFor="still-terms">
              <input
                id="still-terms"
                type="checkbox"
                checked={accepted}
                onChange={(event) => setAccepted(event.target.checked)}
                className="mt-1 size-4 accent-ink"
              />
              <span>
                I agree to the{" "}
                <Link href="/legal/terms" className="text-ink underline underline-offset-4">
                  Terms of Use
                </Link>{" "}
                and acknowledge the{" "}
                <Link href="/legal/privacy" className="text-ink underline underline-offset-4">
                  Privacy Policy
                </Link>
                .
              </span>
            </label>
            {termsMessage ? (
              <p className="mt-2 text-sm text-ink" role="alert">
                {termsMessage}
              </p>
            ) : null}
          </div>
        ) : null}

        {captchaMode === "active" && siteKey ? (
          <TurnstileWidget siteKey={siteKey} resetKey={resetKey} onToken={setToken} />
        ) : null}
        {captchaMode === "development" ? (
          <p className="text-sm text-ink-faint">Turnstile is not configured. CAPTCHA is not active in this environment.</p>
        ) : null}
        {captchaMode === "unavailable" ? (
          <p className="text-sm text-ink" role="status">
            Account protection is not configured. Sign-in stays closed until Turnstile keys are set.
          </p>
        ) : null}

        <button
          type="submit"
          disabled={busy || blocked}
          className="min-h-12 rounded-md bg-ink px-5 text-sm text-paper outline-none transition motion-reduce:transition-none hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ink/30 disabled:opacity-60"
        >
          {submitLabel}
        </button>
      </form>

      {googleEnabled && (intent === "sign-in" || intent === "sign-up") ? (
        <button
          type="button"
          onClick={() => void google()}
          disabled={busy || blocked}
          className="mt-4 min-h-12 w-full rounded-md border border-line bg-paper/70 px-5 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-ink/20 disabled:opacity-60"
        >
          Continue with Google
        </button>
      ) : null}

      <div className="mt-8 space-y-3 text-sm text-ink-soft">
        {intent === "sign-in" ? (
          <>
            <p>
              <Link href="/forgot-password" className="text-ink underline-offset-4 hover:underline">
                Forgot password?
              </Link>
            </p>
            <p>
              <Link href={`/signup?next=${encodeURIComponent(next)}`} className="text-ink underline-offset-4 hover:underline">
                Create account
              </Link>
            </p>
            <p>
              <button
                type="button"
                className="text-ink-faint underline-offset-4 hover:text-ink hover:underline"
                onClick={() => {
                  setEmail(DEMO_EMAIL);
                  setPassword(DEMO_PASSWORD);
                  setEmailMessage(null);
                  setPasswordMessage(null);
                  setFormError(null);
                }}
              >
                Demo access
              </button>
            </p>
          </>
        ) : null}
        {intent === "sign-up" ? (
          <p>
            Already have an account?{" "}
            <Link href={`/login?next=${encodeURIComponent(next)}`} className="text-ink underline-offset-4 hover:underline">
              Sign in
            </Link>
          </p>
        ) : null}
        {intent === "forgot" || intent === "reset" ? (
          <p>
            <Link href="/login" className="text-ink underline-offset-4 hover:underline">
              Back to sign in
            </Link>
          </p>
        ) : null}
      </div>

      {notice ? <p className="mt-6 text-sm leading-relaxed text-ink-soft">{notice}</p> : null}
      {formError ? (
        <p className="mt-6 text-sm leading-relaxed text-ink" role="alert" aria-live="polite">
          {formError}
        </p>
      ) : null}
    </div>
  );
}
