import { db } from "@ijf/database";

import { sendToBattlefield, sendToFighter, sendToUser } from "../ws/store";
import { aiModels } from "./ai-models";
import {
  buildBattlefieldCostSnapshot,
  buildFighterCostSnapshot,
  insertLlmUsageEvent,
} from "./llm-usage-repository";
import { logger } from "./logger";
import { openrouter } from "./openrouter";
import { skills } from "./skills";
import type { ChatMessage, SectionId } from "./types";
import { chargeForUsage, getWalletNetworkEnv } from "./wallet";

type StreamDeltaHandler = (delta: string) => void;
type OpenRouterResult<T> = { ok: true; value: T } | { ok: false; error: unknown };
export type LlmCallContext = {
  userId: string;
  fighterId?: number;
  battlefieldId?: number;
  sectionId: SectionId;
  correlationId?: string;
};

type OpenRouterUsageSnapshot = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costCredits: string;
};

const getText = (content: unknown): string => {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    const textParts = content
      .map((part) => {
        if (typeof part === "string") {
          return part;
        }

        if (typeof part === "object" && part && "text" in part) {
          const maybeText = part.text;
          return typeof maybeText === "string" ? maybeText : "";
        }

        return "";
      })
      .filter(Boolean);

    return textParts.join("\n").trim();
  }

  return "";
};

type SpecsheetImagePart = {
  type?: string;
  imageUrl: string;
};

const getImageUrl = (image: Record<string, unknown>): string | undefined => {
  if ("image_url" in image) {
    const imageUrlValue = image.image_url;
    if (
      imageUrlValue &&
      typeof imageUrlValue === "object" &&
      "url" in imageUrlValue &&
      typeof imageUrlValue.url === "string"
    ) {
      return imageUrlValue.url;
    }
  }

  if ("imageUrl" in image) {
    const imageUrlValue = image.imageUrl;
    if (
      imageUrlValue &&
      typeof imageUrlValue === "object" &&
      "url" in imageUrlValue &&
      typeof imageUrlValue.url === "string"
    ) {
      return imageUrlValue.url;
    }
  }

  if ("url" in image && typeof image.url === "string") {
    return image.url;
  }

  return undefined;
};

const getNumber = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return undefined;
};

const getString = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim().length > 0 ? value : undefined;

const extractGenerationId = (payload: unknown): string | undefined => {
  if (!payload || typeof payload !== "object") {
    return undefined;
  }

  const maybeId = "id" in payload ? getString(payload.id) : undefined;
  return maybeId;
};

const extractUsage = (payload: unknown): OpenRouterUsageSnapshot | null => {
  if (!payload || typeof payload !== "object" || !("usage" in payload)) {
    return null;
  }

  const usageValue = payload.usage;
  if (!usageValue || typeof usageValue !== "object") {
    return null;
  }
  const usageRecord = usageValue as Record<string, unknown>;

  const promptTokens =
    ("prompt_tokens" in usageRecord ? getNumber(usageRecord.prompt_tokens) : undefined) ??
    ("promptTokens" in usageRecord ? getNumber(usageRecord.promptTokens) : undefined) ??
    0;
  const completionTokens =
    ("completion_tokens" in usageRecord ? getNumber(usageRecord.completion_tokens) : undefined) ??
    ("completionTokens" in usageRecord ? getNumber(usageRecord.completionTokens) : undefined) ??
    0;
  const totalTokens =
    ("total_tokens" in usageRecord ? getNumber(usageRecord.total_tokens) : undefined) ??
    ("totalTokens" in usageRecord ? getNumber(usageRecord.totalTokens) : undefined) ??
    promptTokens + completionTokens;
  const cost =
    ("cost" in usageRecord ? getNumber(usageRecord.cost) : undefined) ??
    ("total_cost" in usageRecord ? getNumber(usageRecord.total_cost) : undefined) ??
    ("totalCost" in usageRecord ? getNumber(usageRecord.totalCost) : undefined) ??
    0;

  return {
    promptTokens,
    completionTokens,
    totalTokens,
    costCredits: String(cost),
  };
};

const getProviderFromModel = (model: string) => {
  const prefix = model.split("/")[0];
  return prefix && prefix.length > 0 ? prefix : "unknown";
};

const trackLlmUsage = async ({
  model,
  context,
  startedAt,
  payload,
  usageOverride,
  generationIdOverride,
}: {
  model: string;
  context?: LlmCallContext;
  startedAt: number;
  payload?: unknown;
  usageOverride?: OpenRouterUsageSnapshot | null;
  generationIdOverride?: string;
}) => {
  if (!context) {
    return;
  }

  const usage = usageOverride ?? extractUsage(payload);
  const generationId = generationIdOverride ?? extractGenerationId(payload);
  const costUsd = Number.parseFloat(usage?.costCredits ?? "0");

  try {
    const chargeResult = await db.transaction(async (tx) => {
      const usageEvent = await insertLlmUsageEvent({
        executor: tx as unknown as typeof db,
        userId: context.userId,
        fighterId: context.fighterId ?? null,
        battlefieldId: context.battlefieldId ?? null,
        sectionId: context.sectionId,
        correlationId: context.correlationId,
        openrouterGenerationId: generationId,
        model,
        provider: getProviderFromModel(model),
        promptTokens: usage?.promptTokens ?? 0,
        completionTokens: usage?.completionTokens ?? 0,
        totalTokens: usage?.totalTokens ?? 0,
        costCredits: usage?.costCredits ?? "0",
        durationMs: Date.now() - startedAt,
      });

      const billing = await chargeForUsage({
        executor: tx as unknown as typeof db,
        userId: context.userId,
        llmUsageEventId: usageEvent.id,
        costUsd: Number.isFinite(costUsd) ? costUsd : 0,
        correlationId: context.correlationId,
      });

      return { usageEvent, billing };
    });

    if (context.fighterId !== undefined) {
      const snapshot = await buildFighterCostSnapshot({
        userId: context.userId,
        fighterId: context.fighterId,
      });
      sendToFighter(String(context.fighterId), {
        type: "pipeline:cost-update",
        ...snapshot,
      });
    }
    if (context.battlefieldId !== undefined) {
      const snapshot = await buildBattlefieldCostSnapshot({
        userId: context.userId,
        battlefieldId: context.battlefieldId,
      });
      sendToBattlefield(String(context.battlefieldId), {
        type: "pipeline:cost-update",
        ...snapshot,
      });
    }

    sendToUser(context.userId, {
      type: "wallet:balance-update",
      walletId: chargeResult.billing.wallet.id,
      networkEnv: getWalletNetworkEnv(),
      balanceNative: chargeResult.billing.balanceNative.toString(),
      balanceUsd: chargeResult.billing.balanceUsd.toFixed(8),
      fxNativePerUsd: chargeResult.billing.fxNativePerUsd.toFixed(12),
      at: new Date().toISOString(),
    });
  } catch (error) {
    logger.warn("llm usage event tracking failed", {
      model,
      sectionId: context.sectionId,
      correlationId: context.correlationId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
};

const buildSpecsheetImageDiagnostic = (completion: unknown) => {
  if (!completion || typeof completion !== "object") {
    return {
      completionType: typeof completion,
      hasChoices: false,
    };
  }

  const withChoices = completion as { choices?: unknown; usage?: unknown };
  const choices = withChoices.choices;
  const firstChoice = Array.isArray(choices) && choices.length > 0 ? choices[0] : undefined;
  const firstMessage =
    firstChoice && typeof firstChoice === "object" && "message" in firstChoice
      ? firstChoice.message
      : undefined;
  const images =
    firstMessage && typeof firstMessage === "object" && "images" in firstMessage
      ? firstMessage.images
      : undefined;
  const content =
    firstMessage && typeof firstMessage === "object" && "content" in firstMessage
      ? firstMessage.content
      : undefined;
  const finishReason =
    firstChoice && typeof firstChoice === "object"
      ? "finishReason" in firstChoice
        ? firstChoice.finishReason
        : "finish_reason" in firstChoice
          ? firstChoice.finish_reason
          : undefined
      : undefined;

  return {
    completionKeys: Object.keys(completion),
    hasChoices: Array.isArray(choices),
    choicesCount: Array.isArray(choices) ? choices.length : 0,
    firstChoiceKeys: firstChoice && typeof firstChoice === "object" ? Object.keys(firstChoice) : [],
    finishReason,
    hasMessage: Boolean(firstMessage && typeof firstMessage === "object"),
    messageKeys:
      firstMessage && typeof firstMessage === "object" ? Object.keys(firstMessage) : undefined,
    imagesCount: Array.isArray(images) ? images.length : 0,
    firstImageKeys:
      Array.isArray(images) &&
      images[0] &&
      typeof images[0] === "object" &&
      !Array.isArray(images[0])
        ? Object.keys(images[0] as Record<string, unknown>)
        : [],
    contentType: typeof content,
    contentPreview:
      typeof content === "string" ? content.slice(0, 180) : Array.isArray(content) ? "array" : "",
    usage: withChoices.usage,
  };
};

const getSpecsheetImage = (completion: unknown): SpecsheetImagePart | undefined => {
  if (!completion || typeof completion !== "object" || !("choices" in completion)) {
    return undefined;
  }

  const choices = completion.choices;
  if (!Array.isArray(choices) || choices.length === 0) {
    return undefined;
  }

  const firstChoice = choices[0];
  if (!firstChoice || typeof firstChoice !== "object" || !("message" in firstChoice)) {
    return undefined;
  }

  const message = firstChoice.message;
  if (!message || typeof message !== "object" || !("images" in message)) {
    return undefined;
  }

  const images = message.images;
  if (!Array.isArray(images) || images.length === 0) {
    return undefined;
  }

  const image = images[0];
  if (!image || typeof image !== "object") {
    return undefined;
  }

  const imageUrl = getImageUrl(image as Record<string, unknown>);
  if (!imageUrl) {
    return undefined;
  }

  return {
    type: "type" in image && typeof image.type === "string" ? image.type : undefined,
    imageUrl,
  };
};

const generateImageWithModel = async (
  model: string,
  prompt: string,
  label: string,
  context?: LlmCallContext,
): Promise<{ imageBase64: string; mimeType: string; model: string }> => {
  const startedAt = Date.now();
  const completion = await openrouter.chat.send({
    chatRequest: {
      model,
      modalities: ["image"],
      messages: [{ role: "user", content: prompt }],
    },
  });
  await trackLlmUsage({ model, context, payload: completion, startedAt });

  const image = getSpecsheetImage(completion);
  if (!image) {
    const diagnostics = buildSpecsheetImageDiagnostic(completion);
    logger.warn(`${label} response had no image payload`, {
      model,
      promptLength: prompt.length,
      ...diagnostics,
    });
    throw new Error(`${label} returned no image.`);
  }

  const mimeType = image.type || "image/png";
  const imageBase64 = image.imageUrl;

  return { imageBase64, mimeType, model };
};

const unwrapOpenRouterResult = <T>(result: T | OpenRouterResult<T>): T => {
  if (
    typeof result === "object" &&
    result !== null &&
    "ok" in result &&
    typeof result.ok === "boolean"
  ) {
    const typedResult = result as OpenRouterResult<T>;
    if (!typedResult.ok) {
      const message =
        typedResult.error instanceof Error
          ? typedResult.error.message
          : "OpenRouter request failed.";
      throw new Error(message);
    }
    return typedResult.value;
  }

  return result;
};

const generateTextWithModel = async ({
  model,
  messages,
  emptyErrorMessage,
  onDelta,
  context,
}: {
  model: string;
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  emptyErrorMessage: string;
  onDelta?: StreamDeltaHandler;
  context?: LlmCallContext;
}) => {
  const startedAt = Date.now();
  if (onDelta) {
    const streamResponse = await openrouter.chat.send({
      chatRequest: {
        model,
        stream: true,
        messages,
      },
    });
    const stream = unwrapOpenRouterResult(streamResponse);
    let streamedText = "";
    let streamUsage: OpenRouterUsageSnapshot | null = null;
    let streamGenerationId: string | undefined;

    for await (const chunk of stream as AsyncIterable<{
      choices?: Array<{ delta?: { content?: string | null } }>;
    }>) {
      const usage = extractUsage(chunk);
      if (usage) {
        streamUsage = usage;
      }
      const generationId = extractGenerationId(chunk);
      if (generationId) {
        streamGenerationId = generationId;
      }

      const delta = chunk.choices?.[0]?.delta?.content;
      if (typeof delta !== "string" || delta.length === 0) {
        continue;
      }
      streamedText += delta;
      onDelta(delta);
    }
    await trackLlmUsage({
      model,
      context,
      startedAt,
      usageOverride: streamUsage,
      generationIdOverride: streamGenerationId,
    });

    if (!streamedText.trim()) {
      throw new Error(emptyErrorMessage);
    }

    return streamedText;
  }

  const completionResponse = await openrouter.chat.send({
    chatRequest: {
      model,
      messages,
    },
  });
  await trackLlmUsage({ model, context, payload: completionResponse, startedAt });
  const completion = unwrapOpenRouterResult(completionResponse) as {
    choices?: Array<{ message?: { content?: unknown } }>;
  };
  const text = getText(completion.choices?.[0]?.message?.content);

  if (!text) {
    throw new Error(emptyErrorMessage);
  }

  return text;
};

export const generateCharacterDescription = async (
  prompt: string,
  onDelta?: StreamDeltaHandler,
  context?: LlmCallContext,
) => {
  const markdown = await generateTextWithModel({
    model: aiModels.characterDescription,
    messages: [
      { role: "system", content: skills.characterDescription },
      { role: "user", content: prompt },
    ],
    emptyErrorMessage: "Character description generation returned empty output.",
    onDelta,
    context,
  });

  return {
    markdown,
    model: aiModels.characterDescription,
  };
};

export const generateCharacterDescriptionRefine = async (
  history: ChatMessage[],
  message: string,
  context?: LlmCallContext,
) => {
  const markdown = await generateTextWithModel({
    model: aiModels.characterDescription,
    messages: [
      { role: "system", content: skills.characterDescription },
      ...history,
      { role: "user", content: message },
    ],
    emptyErrorMessage: "Character description refinement returned empty output.",
    context,
  });

  return {
    markdown,
    model: aiModels.characterDescription,
  };
};

export const generateSpecsheetPrompt = async (
  characterDescription: string,
  onDelta?: StreamDeltaHandler,
  context?: LlmCallContext,
) => {
  const prompt = await generateTextWithModel({
    model: aiModels.specsheetPrompt,
    messages: [
      { role: "system", content: skills.specsheetPrompt },
      { role: "user", content: characterDescription },
    ],
    emptyErrorMessage: "Specsheet prompt generation returned empty output.",
    onDelta,
    context,
  });

  return {
    prompt,
    model: aiModels.specsheetPrompt,
  };
};

export const generateSpecsheetPromptRefine = async (
  history: ChatMessage[],
  message: string,
  context?: LlmCallContext,
) => {
  const prompt = await generateTextWithModel({
    model: aiModels.specsheetPrompt,
    messages: [
      { role: "system", content: skills.specsheetPrompt },
      ...history,
      { role: "user", content: message },
    ],
    emptyErrorMessage: "Specsheet prompt refinement returned empty output.",
    context,
  });

  return {
    prompt,
    model: aiModels.specsheetPrompt,
  };
};

export const generateSpecsheetImage = async (prompt: string, context?: LlmCallContext) => {
  return generateImageWithModel(
    aiModels.specsheetImage,
    prompt,
    "Specsheet image generation",
    context,
  );
};

export const generateSpritesheetPrompt = async (
  characterDescription: string,
  onDelta?: StreamDeltaHandler,
  context?: LlmCallContext,
) => {
  const prompt = await generateTextWithModel({
    model: aiModels.spritesheetPrompt,
    messages: [
      { role: "system", content: skills.spritesheetPrompt },
      { role: "user", content: characterDescription },
    ],
    emptyErrorMessage: "Spritesheet prompt generation returned empty output.",
    onDelta,
    context,
  });

  return {
    prompt,
    model: aiModels.spritesheetPrompt,
  };
};

export const generateSpritesheetImage = async (prompt: string, context?: LlmCallContext) => {
  return generateImageWithModel(
    aiModels.spritesheetImage,
    prompt,
    "Spritesheet image generation",
    context,
  );
};

export const generateSpritesheetManifest = async ({
  imageUrl,
  sheetWidth,
  sheetHeight,
  context,
}: {
  imageUrl: string;
  sheetWidth: number;
  sheetHeight: number;
  context?: LlmCallContext;
}) => {
  const startedAt = Date.now();
  const completionResponse = await openrouter.chat.send({
    chatRequest: {
      model: aiModels.spritesheetManifest,
      messages: [
        { role: "system", content: skills.spritesheetManifestMapper },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Analyze this spritesheet and produce the strict JSON manifest. sheetWidth=${sheetWidth}, sheetHeight=${sheetHeight}.`,
            },
            {
              type: "image_url",
              imageUrl: { url: imageUrl },
            },
          ],
        },
      ],
    },
  });
  await trackLlmUsage({
    model: aiModels.spritesheetManifest,
    context,
    payload: completionResponse,
    startedAt,
  });
  const completion = unwrapOpenRouterResult(completionResponse) as {
    choices?: Array<{ message?: { content?: unknown } }>;
  };
  const manifest = getText(completion.choices?.[0]?.message?.content);
  if (!manifest.trim()) {
    throw new Error("Spritesheet manifest generation returned empty output.");
  }
  return {
    manifest,
    model: aiModels.spritesheetManifest,
  };
};

export const generateAgentCode = async (
  characterDescription: string,
  onDelta?: StreamDeltaHandler,
  context?: LlmCallContext,
) => {
  const code = await generateTextWithModel({
    model: aiModels.agentCode,
    messages: [
      { role: "system", content: skills.agentCode },
      { role: "user", content: characterDescription },
    ],
    emptyErrorMessage: "Agent code generation returned empty output.",
    onDelta,
    context,
  });

  return {
    code,
    model: aiModels.agentCode,
  };
};

export const generateStrikecraftSpecsheetPrompt = async (
  characterDescription: string,
  onDelta?: StreamDeltaHandler,
  context?: LlmCallContext,
) => {
  const prompt = await generateTextWithModel({
    model: aiModels.strikecraftSpecsheetPrompt,
    messages: [
      { role: "system", content: skills.strikecraftSpecsheetPrompt },
      { role: "user", content: characterDescription },
    ],
    emptyErrorMessage: "Strikecraft specsheet prompt generation returned empty output.",
    onDelta,
    context,
  });

  return {
    prompt,
    model: aiModels.strikecraftSpecsheetPrompt,
  };
};

export const generateStrikecraftSpecsheetImage = async (
  prompt: string,
  context?: LlmCallContext,
) => {
  return generateImageWithModel(
    aiModels.strikecraftSpecsheetImage,
    prompt,
    "Strikecraft specsheet image generation",
    context,
  );
};

export const generateStrikecraftSpritePrompt = async (
  strikecraftSpecsheet: string,
  onDelta?: StreamDeltaHandler,
  context?: LlmCallContext,
) => {
  const prompt = await generateTextWithModel({
    model: aiModels.strikecraftSpritePrompt,
    messages: [
      { role: "system", content: skills.strikecraftSpritePrompt },
      { role: "user", content: strikecraftSpecsheet },
    ],
    emptyErrorMessage: "Strikecraft sprite prompt generation returned empty output.",
    onDelta,
    context,
  });

  return {
    prompt,
    model: aiModels.strikecraftSpritePrompt,
  };
};

export const generateStrikecraftSpriteImage = async (prompt: string, context?: LlmCallContext) => {
  return generateImageWithModel(
    aiModels.strikecraftSpriteImage,
    prompt,
    "Strikecraft sprite image generation",
    context,
  );
};

export const generateBattlefieldDescription = async (
  prompt: string,
  onDelta?: StreamDeltaHandler,
  context?: LlmCallContext,
) => {
  const markdown = await generateTextWithModel({
    model: aiModels.battlefieldDescription,
    messages: [
      { role: "system", content: skills.battlefieldDescription },
      { role: "user", content: prompt },
    ],
    emptyErrorMessage: "Battlefield description generation returned empty output.",
    onDelta,
    context,
  });

  return {
    markdown,
    model: aiModels.battlefieldDescription,
  };
};

export const generateBattlefieldSheetPrompt = async (
  battlefieldDescription: string,
  onDelta?: StreamDeltaHandler,
  context?: LlmCallContext,
) => {
  const prompt = await generateTextWithModel({
    model: aiModels.battlefieldSheetPrompt,
    messages: [
      { role: "system", content: skills.battlefieldSheetPrompt },
      { role: "user", content: battlefieldDescription },
    ],
    emptyErrorMessage: "Battlefield sheet prompt generation returned empty output.",
    onDelta,
    context,
  });

  return {
    prompt,
    model: aiModels.battlefieldSheetPrompt,
  };
};

export const generateBattlefieldSheetImage = async (prompt: string, context?: LlmCallContext) => {
  return generateImageWithModel(
    aiModels.battlefieldSheetImage,
    prompt,
    "Battlefield sheet image generation",
    context,
  );
};

export const generateBattlefieldConfig = async (
  battlefieldDescription: string,
  onDelta?: StreamDeltaHandler,
  context?: LlmCallContext,
) => {
  const config = await generateTextWithModel({
    model: aiModels.battlefieldConfig,
    messages: [
      { role: "system", content: skills.battlefieldConfig },
      { role: "user", content: battlefieldDescription },
    ],
    emptyErrorMessage: "Battlefield config generation returned empty output.",
    onDelta,
    context,
  });

  return {
    config,
    model: aiModels.battlefieldConfig,
  };
};
