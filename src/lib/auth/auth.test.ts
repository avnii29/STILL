import { describe, expect, it } from "vitest";
import {
  authFailureMessage,
  captchaRequirement,
  classifyAuthError,
  confirmationError,
  emailError,
  maskEmail,
  normalizeEmail,
  passwordError,
  safeAuthNext,
} from "@/lib/auth/policy";

describe("auth policy", () => {
  it("normalizes email without treating it as an existence check", () => {
    expect(normalizeEmail("  ABC@Gmail.com ")).toBe("abc@gmail.com");
    expect(emailError("not-an-email")).toBe("Enter a valid email.");
    expect(emailError("abc@gmail.com")).toBeNull();
  });

  it("requires eight characters and a matching confirmation", () => {
    expect(passwordError("short", "new")).toBe("Use at least 8 characters.");
    expect(passwordError("longenough", "new")).toBeNull();
    expect(passwordError("abc123", "current")).toBeNull();
    expect(confirmationError("longenough", "otherpass")).toMatch(/don't match/);
  });

  it("sends people into the app and refuses open redirects", () => {
    expect(safeAuthNext(null)).toBe("/app");
    expect(safeAuthNext("/app/threads")).toBe("/app/threads");
    expect(safeAuthNext("/reset-password")).toBe("/reset-password");
    expect(safeAuthNext("/login")).toBe("/app");
    expect(safeAuthNext("https://evil.example")).toBe("/app");
    expect(safeAuthNext("//evil.example")).toBe("/app");
  });

  it("masks an inbox and maps auth failures without raw provider text", () => {
    expect(maskEmail("abc@gmail.com")).toBe("a•••@gmail.com");
    expect(classifyAuthError({ code: "invalid_credentials", status: 400 })).toBe("credentials");
    expect(classifyAuthError({ code: "email_not_confirmed" })).toBe("confirm");
    expect(classifyAuthError({ status: 429 })).toBe("rate");
    expect(authFailureMessage("captcha")).toBe("We couldn't verify this request. Please try again.");
    expect(authFailureMessage("credentials")).not.toMatch(/supabase/i);
  });

  it("does not pretend captcha is active when it is not configured", () => {
    expect(captchaRequirement({ mode: "development" })).toBe("skip");
    expect(captchaRequirement({ mode: "unavailable" })).toBe("unavailable");
    expect(captchaRequirement({ mode: "active" })).toBe("required");
    expect(captchaRequirement({ mode: "active", token: "token" })).toBe("verify");
  });
});
