export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function emailError(value: string) {
  const email = normalizeEmail(value);
  if (!email) return "Enter your email.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Enter a valid email.";
  return null;
}

export function passwordError(value: string, mode: "new" | "current") {
  if (!value) return "Enter your password.";
  if (mode === "new" && value.length < 8) return "Use at least 8 characters.";
  return null;
}

export function confirmationError(password: string, confirmation: string) {
  if (!confirmation) return "Confirm your password.";
  if (password !== confirmation) return "Those passwords don't match.";
  return null;
}

export function maskEmail(value: string) {
  const email = normalizeEmail(value);
  const [name, domain] = email.split("@");
  if (!name || !domain) return "your inbox";
  return `${name.slice(0, 1)}•••@${domain}`;
}

export function safeAuthNext(value: string | null | undefined) {
  if (!value) return "/app";
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\") || value.includes("://")) {
    return "/app";
  }
  if (value.startsWith("/api/") || value === "/api") return "/app";
  const path = value.split("?")[0] ?? value;
  if (
    path === "/login" ||
    path === "/signup" ||
    path.startsWith("/auth/")
  ) {
    return "/app";
  }
  return value;
}

export type AuthFailure = "credentials" | "confirm" | "rate" | "network" | "captcha" | "unavailable" | "generic";

export function authFailureMessage(kind: AuthFailure) {
  if (kind === "credentials") return "That email or password doesn't look right.";
  if (kind === "confirm") return "Please verify your email before signing in.";
  if (kind === "rate") return "Too many attempts. Please wait a moment and try again.";
  if (kind === "network") return "STILL couldn't reach the server. Check your connection and try again.";
  if (kind === "captcha") return "We couldn't verify this request. Please try again.";
  if (kind === "unavailable") return "Account protection is not configured for this environment.";
  return "STILL couldn't finish that. Try again.";
}

export function classifyAuthError(error: { message?: string; code?: string; status?: number; name?: string } | null) {
  if (!error) return null;
  const code = `${error.code ?? ""} ${error.name ?? ""} ${error.message ?? ""}`.toLowerCase();
  if (error.status === 429 || code.includes("rate") || code.includes("too many")) return "rate" as const;
  if (code.includes("network") || code.includes("fetch") || code.includes("failed to fetch") || error.name === "AuthRetryableFetchError") {
    return "network" as const;
  }
  if (code.includes("email_not_confirmed") || code.includes("not confirmed") || code.includes("confirm")) {
    return "confirm" as const;
  }
  if (code.includes("invalid") || code.includes("credentials") || error.status === 400) return "credentials" as const;
  return "generic" as const;
}

export function captchaRequirement(input: { mode: "active" | "development" | "unavailable"; token?: string }) {
  if (input.mode === "unavailable") return "unavailable" as const;
  if (input.mode === "development") return "skip" as const;
  if (!input.token) return "required" as const;
  return "verify" as const;
}
