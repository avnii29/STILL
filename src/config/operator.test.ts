import { describe, expect, it } from "vitest";
import { dayPeriod, isOperatorReady, operatorPlaceholder } from "@/config/operator";

describe("operator", () => {
  it("does not invent a legal name", () => {
    expect(isOperatorReady({
      productName: "STILL",
      operatorLegalName: null,
      contactEmail: null,
      supportEmail: null,
      businessAddress: null,
      jurisdiction: null,
      effectiveDate: "2026-09-21",
      policyVersion: "2026-09-21",
    })).toBe(false);
    expect(operatorPlaceholder("CONTACT EMAIL")).toBe("[CONTACT EMAIL REQUIRED]");
  });

  it("names the day from local hour", () => {
    expect(dayPeriod(8)).toBe("morning");
    expect(dayPeriod(22)).toBe("night");
  });
});
