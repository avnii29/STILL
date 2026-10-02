import { describe, expect, it } from "vitest";
import { holdIn, worldInkForDay } from "@/lib/world/ink";

describe("world ink", () => {
  it("keeps morning text dark and night text light", () => {
    expect(worldInkForDay(0).primary).toBe("#1a1814");
    expect(worldInkForDay(1).primary).toBe("#f2eee6");
  });

  it("flips to ivory before full night", () => {
    expect(worldInkForDay(0.75).primary.startsWith("#")).toBe(true);
    const nightish = Number.parseInt(worldInkForDay(0.78).primary.slice(1, 3), 16);
    expect(nightish).toBeGreaterThan(180);
  });

  it("holds a moment in the middle of its window", () => {
    expect(holdIn(0.2, 0.1, 0.15, 0.25, 0.3)).toBe(1);
    expect(holdIn(0.05, 0.1, 0.15, 0.25, 0.3)).toBe(0);
  });
});
