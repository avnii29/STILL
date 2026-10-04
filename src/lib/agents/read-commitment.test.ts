import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { readCommitment } from "@/lib/agents/read-commitment";
import type { LanguageModel } from "@/lib/agents/types";

const now = new Date("2026-09-21T10:00:00");

function model(
  complete: (input: { system: string; user: string; schemaName: string }) => Promise<unknown>,
): LanguageModel {
  return {
    id: "test-model",
    provider: "openai",
    completeJson: complete as LanguageModel["completeJson"],
  };
}

describe("readCommitment", () => {
  it("uses the heuristic when no model is configured", async () => {
    const reading = await readCommitment({
      text: "I'll send Priya the project report tomorrow evening.",
      now,
      model: null,
    });
    expect(reading.interpretedBy).toBe("heuristic");
    expect(reading.provider).toBe("heuristic");
    expect(reading.extraction.is_commitment).toBe(true);
    expect(reading.extraction.person).toBe("Priya");
  });

  it("keeps a Zod-valid model reading and records who decided", async () => {
    const reading = await readCommitment({
      text: "yep, Tuesday evening",
      context: "I'll get the revised dataset to Maya",
      now,
      model: model(async () => ({
        is_commitment: true,
        confidence: 0.81,
        commitment_text: "rewritten",
        normalized_commitment: "revised dataset",
        person: "Maya",
        deadline: "Tuesday evening",
        deadline_confidence: 0.7,
        due_at: null,
        evidence: "rewritten",
        uncertain: false,
      })),
    });
    expect(reading.interpretedBy).toBe("model:openai");
    expect(reading.provider).toBe("openai:test-model");
    expect(reading.extraction.is_commitment).toBe(true);
    expect(reading.extraction.person).toBe("Maya");
    expect(reading.extraction.evidence).toBe("yep, Tuesday evening");
    expect(reading.extraction.deadline?.toLowerCase()).toContain("tuesday evening");
    expect(reading.extraction.due_at).toBeTruthy();
  });

  it("drops a person the model invented", async () => {
    const reading = await readCommitment({
      text: "I'll send the report tomorrow.",
      now,
      model: model(async () => ({
        is_commitment: true,
        confidence: 0.8,
        commitment_text: "I'll send the report tomorrow.",
        normalized_commitment: "send the report",
        person: "Maya",
        deadline: "tomorrow",
        deadline_confidence: 0.8,
        due_at: "2026-09-22T09:00:00.000Z",
        evidence: "I'll send the report tomorrow.",
        uncertain: false,
      })),
    });
    expect(reading.interpretedBy).toBe("model:openai");
    expect(reading.extraction.person).toBeNull();
  });

  it("falls back to the heuristic when the model output fails validation", async () => {
    const reading = await readCommitment({
      text: "I'll try to get to it",
      now,
      model: model(async () => ({ is_commitment: "sometimes" })),
    });
    expect(reading.interpretedBy).toBe("heuristic:fallback");
    expect(reading.provider).toBe("heuristic:fallback");
    expect(reading.extraction.is_commitment).toBe(false);
  });

  it("falls back when the model throws", async () => {
    const reading = await readCommitment({
      text: "maybe someday",
      now,
      model: model(async () => {
        throw new Error("timeout");
      }),
    });
    expect(reading.interpretedBy).toBe("heuristic:fallback");
    expect(reading.extraction.is_commitment).toBe(false);
  });
});

describe("guest extract stays heuristic", () => {
  it("does not import the model reader", () => {
    const source = readFileSync(resolve(process.cwd(), "src/app/api/extract/route.ts"), "utf8");
    expect(source).not.toContain("readCommitment");
    expect(source).not.toContain("getLanguageModel");
    expect(source).toContain("extractCommitment");
  });
});

describe("OpenAI-compatible base URL", () => {
  it("posts to AI_BASE_URL instead of api.openai.com", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toContain("/chat/completions");
      expect(init?.method).toBe("POST");
      return {
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: '{"ok":true}' } }] }),
      text: async () => "",
    };
    });
    vi.stubGlobal("fetch", fetchMock);
    const { createOpenAiModel } = await import("@/lib/agents/providers/openai");
    const client = createOpenAiModel({
      apiKey: "test-key",
      model: "demo-model",
      baseUrl: "https://example.test/v1/",
    });
    await client.completeJson({ system: "sys", user: "user", schemaName: "probe" });
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("https://example.test/v1/chat/completions");
    const body = JSON.parse(String(init?.body));
    expect(body.model).toBe("demo-model");
    expect(init?.headers).toMatchObject({ Authorization: "Bearer test-key" });
    vi.unstubAllGlobals();
  });
});
