import { didInferMissingPromptOutputs, inferMissingPromptOutputsFromAssets } from "@ijf/shared";
import { describe, expect, test } from "bun:test";

import { deriveSectionStatuses } from "./pipeline-status";
import type { SectionOutput } from "./types";

const imageOutput = (sectionId: SectionOutput["sectionId"]): SectionOutput => ({
  sectionId,
  content: `users/test/fighters/1/${sectionId}.png`,
  generatedAt: "2026-06-07T00:00:00.000Z",
  model: "test-model",
  mimeType: "image/png",
});

describe("inferMissingPromptOutputsFromAssets", () => {
  test("backfills strikecraft sprite prompt when image was recovered from storage", () => {
    const before = {
      "strikecraft-specsheet-image": imageOutput("strikecraft-specsheet-image"),
      "strikecraft-sprite-image": imageOutput("strikecraft-sprite-image"),
    };

    const after = inferMissingPromptOutputsFromAssets(before);

    expect(after["strikecraft-sprite-prompt"]?.content).toBe("__storage_recovered__");
    expect(didInferMissingPromptOutputs(before, after)).toBe(true);
  });

  test("does not overwrite an existing prompt", () => {
    const before = {
      "strikecraft-sprite-prompt": {
        sectionId: "strikecraft-sprite-prompt" as const,
        content: "Existing prompt",
        generatedAt: "2026-06-07T00:00:00.000Z",
        model: "test-model",
      },
      "strikecraft-sprite-image": imageOutput("strikecraft-sprite-image"),
    };

    const after = inferMissingPromptOutputsFromAssets(before);

    expect(after["strikecraft-sprite-prompt"]?.content).toBe("Existing prompt");
    expect(didInferMissingPromptOutputs(before, after)).toBe(false);
  });
});

describe("deriveSectionStatuses", () => {
  test("marks strikecraft sprite prompt complete when image output exists", () => {
    const outputs = inferMissingPromptOutputsFromAssets({
      "strikecraft-specsheet-image": imageOutput("strikecraft-specsheet-image"),
      "strikecraft-sprite-image": imageOutput("strikecraft-sprite-image"),
    });

    const statuses = deriveSectionStatuses({
      outputs,
      activeSectionIds: [],
      lastErrorSectionId: null,
    });

    expect(statuses["strikecraft-sprite-prompt"]).toBe("complete");
    expect(statuses["strikecraft-sprite-image"]).toBe("complete");
  });
});
