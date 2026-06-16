import {
  didInferMissingPromptOutputs,
  FIGHTER_PIPELINE_SECTION_ORDER,
  hasPersistedPromptContent,
  inferMissingPromptOutputsFromAssets,
} from "@ijf/shared";
import { parseFighterNameAndEpithet } from "@ijf/shared";

import { clearPendingForFighter, sendToFighter, sendToUser } from "../ws/store";
import { persistFighterAgentVersion } from "./agent-version-repository";
import { getFighterBriefing, saveFighterName } from "./fighter-access";
import type { LlmCallContext } from "./generate";
import {
  generateAgentCode,
  generateCharacterDescription,
  generateCharacterDescriptionRefine,
  generateCharacterPfpImage,
  generateCharacterPfpPrompt,
  generateSpecsheetImage,
  generateSpecsheetPrompt,
  generateSpecsheetPromptRefine,
  generateSpritesheetImage,
  generateSpritesheetManifest,
  generateSpritesheetPrompt,
  generateStrikecraftSpecsheetImage,
  generateStrikecraftSpecsheetPrompt,
  generateStrikecraftSpriteImage,
  generateStrikecraftSpritePrompt,
} from "./generate";
import { withFighterContext as withContext } from "./log-context";
import { logger } from "./logger";
import {
  commitImageAsset,
  imageObjectKeyBuilders,
  isImageSection,
  reconcileAssetBackedOutputs,
  resolveStoredImageForManifest,
  sanitizeOutputs,
  sanitizeSectionOutput,
} from "./pipeline-assets";
import {
  bindPipelineTenant,
  clearPipelineStateForFighter,
  type FighterPipelineState,
  getErrorMessage,
  getState,
  getTenant,
  hydratePipelineFromBucket,
  peekState,
  persistSnapshot,
  type PipelineTenant,
  requireTenant,
  setHistory,
  setOutput,
  withFighterLock,
} from "./pipeline-state";
import type { SectionStatus } from "./pipeline-status";
import { deriveSectionStatuses } from "./pipeline-status";
import {
  characterPfpObjectKey,
  getSignedReadUrl,
  putObject,
  specsheetObjectKey,
  spritesheetImageObjectKey,
  spritesheetManifestObjectKey,
  strikecraftSpecsheetObjectKey,
  strikecraftSpriteObjectKey,
} from "./r2";
import { normalizeSpritesheetManifest } from "./spritesheet-manifest";
import type { ChatMessage, FighterSectionId as SectionId, SectionOutput } from "./types";
import { InsufficientBalanceError, requirePreflightBalance } from "./wallet";
import { getFighterBalanceNative } from "./wallet/ledger";

export type { PipelineTenant };
export { bindPipelineTenant, clearPipelineStateForFighter, hydratePipelineFromBucket };

const stepOrder: SectionId[] = FIGHTER_PIPELINE_SECTION_ORDER;

class PipelineSectionError extends Error {
  readonly sectionId: SectionId;

  constructor(sectionId: SectionId, cause: unknown) {
    super(cause instanceof Error ? cause.message : String(cause));
    this.name = "PipelineSectionError";
    this.sectionId = sectionId;
    this.cause = cause;
  }
}

const unwrapSectionError = (error: unknown): unknown =>
  error instanceof PipelineSectionError ? (error.cause ?? error) : error;

const resolveErrorSectionId = (
  error: unknown,
  fallback: SectionId,
): { sectionId: SectionId; cause: unknown } =>
  error instanceof PipelineSectionError
    ? { sectionId: error.sectionId, cause: error.cause ?? error }
    : { sectionId: fallback, cause: error };

const persistAgentCodeVersion = async ({
  fighterKey,
  tenant,
  code,
  model,
  correlationId,
}: {
  fighterKey: string;
  tenant: PipelineTenant;
  code: string;
  model: string;
  correlationId?: string;
}) => {
  const created = await persistFighterAgentVersion({
    fighterId: tenant.fighterId,
    userId: tenant.userId,
    code,
    model,
  });

  logger.info("pipeline agent-code version persisted", {
    ...withContext(fighterKey, correlationId),
    fighterId: tenant.fighterId,
    versionNumber: created.versionNumber,
    contentHash: created.contentHash,
    objectKey: created.objectKey,
    model,
  });
};

export type ClientPipelineStateSnapshot = {
  sectionStatuses: Record<SectionId, SectionStatus>;
  outputs: Partial<Record<SectionId, SectionOutput>>;
  histories: Partial<Record<SectionId, ChatMessage[]>>;
  gateMessage: string | null;
  fighterLedger: {
    isReady: boolean;
    balanceNative: string;
  };
};

const resolveFighterLedgerSnapshot = async (fighterKey: string) => {
  const tenant = getTenant(fighterKey);
  if (!tenant) {
    return { isReady: false, balanceNative: "0" };
  }
  const balanceNative = await getFighterBalanceNative(tenant.fighterId);
  return {
    isReady: true,
    balanceNative: balanceNative.toString(),
  };
};

type FighterPipelinePreview = {
  characterDescription: string | null;
  specsheetPrompt: string | null;
  specsheetImageUrl: string | null;
  pfpUrl: string | null;
  status: SectionStatus;
};

export const buildFighterPreviewFromSnapshot = (
  snapshot: ClientPipelineStateSnapshot,
): FighterPipelinePreview => {
  const characterDescription = snapshot.outputs["character-description"]?.content ?? null;
  const specsheetPrompt = snapshot.outputs["specsheet-prompt"]?.content ?? null;
  const specsheetImageUrl =
    snapshot.outputs["specsheet-image"]?.assetUrl ??
    snapshot.outputs["specsheet-image"]?.content ??
    null;
  const pfpUrl =
    snapshot.outputs["character-pfp-image"]?.assetUrl ??
    snapshot.outputs["character-pfp-image"]?.content ??
    null;

  const statuses = Object.values(snapshot.sectionStatuses);
  let status: SectionStatus = "ready";
  if (statuses.includes("error")) {
    status = "error";
  } else if (statuses.includes("generating")) {
    status = "generating";
  } else if (snapshot.sectionStatuses["specsheet-image"] === "complete") {
    status = "complete";
  } else if (statuses.includes("complete")) {
    status = "ready";
  } else if (statuses.includes("locked")) {
    status = "locked";
  }

  return {
    characterDescription,
    specsheetPrompt,
    specsheetImageUrl,
    pfpUrl,
    status,
  };
};

export const serializeClientPipelineState = async (
  fighterKey: string,
): Promise<ClientPipelineStateSnapshot | null> => {
  const tenant = getTenant(fighterKey);
  if (!tenant) {
    return null;
  }

  let state = peekState(fighterKey);

  if (!state) {
    await hydratePipelineFromBucket(fighterKey, tenant);
    state = peekState(fighterKey);
  }

  if (!state) {
    return {
      sectionStatuses: deriveSectionStatuses({
        outputs: {},
        activeSectionIds: [],
        lastErrorSectionId: null,
      }),
      outputs: {},
      histories: {},
      gateMessage: null,
      fighterLedger: await resolveFighterLedgerSnapshot(fighterKey),
    };
  }

  const reconciledOutputs = await reconcileAssetBackedOutputs({
    outputs: state.outputs,
    tenant,
  });
  const inferredOutputs = inferMissingPromptOutputsFromAssets(reconciledOutputs);
  state.outputs = inferredOutputs;

  if (didInferMissingPromptOutputs(reconciledOutputs, inferredOutputs)) {
    await persistSnapshot(fighterKey, state, tenant);
  }

  return {
    sectionStatuses: deriveSectionStatuses({
      outputs: inferredOutputs,
      activeSectionIds: state.activeSectionIds,
      lastErrorSectionId: state.lastErrorSectionId,
    }),
    outputs: await sanitizeOutputs(inferredOutputs),
    histories: state.histories,
    gateMessage: state.gateMessage,
    fighterLedger: await resolveFighterLedgerSnapshot(fighterKey),
  };
};

export const deriveSectionStatusesOnly = async (
  fighterKey: string,
): Promise<Record<string, string> | null> => {
  const tenant = getTenant(fighterKey);
  if (!tenant) {
    return null;
  }

  let state = peekState(fighterKey);
  if (!state) {
    await hydratePipelineFromBucket(fighterKey, tenant);
    state = peekState(fighterKey);
  }

  return deriveSectionStatuses({
    outputs: state?.outputs ?? {},
    activeSectionIds: state?.activeSectionIds ?? [],
    lastErrorSectionId: state?.lastErrorSectionId ?? null,
  });
};

const resetDownstream = (fighterKey: string, sectionId: SectionId, correlationId?: string) => {
  if (sectionId !== "character-description") {
    return;
  }

  const state = getState(fighterKey, correlationId);
  const startIdx = stepOrder.indexOf("character-description");
  const downstream = stepOrder.slice(startIdx + 1);

  for (const step of downstream) {
    delete state.outputs[step];
    delete state.histories[step];
  }

  logger.info("pipeline downstream reset", {
    ...withContext(fighterKey, correlationId),
    sectionId,
    clearedSections: downstream,
  });
};

const buildSyncMessage = async (fighterKey: string, state: FighterPipelineState) => ({
  type: "pipeline:sync" as const,
  sectionStatuses: deriveSectionStatuses({
    outputs: state.outputs,
    activeSectionIds: state.activeSectionIds,
    lastErrorSectionId: state.lastErrorSectionId,
  }),
  outputs: await sanitizeOutputs(state.outputs),
  histories: state.histories,
  gateMessage: state.gateMessage,
  fighterLedger: await resolveFighterLedgerSnapshot(fighterKey),
});

export const syncPipelineState = async (fighterKey: string) => {
  const state = peekState(fighterKey);
  if (!state) {
    return;
  }

  try {
    const tenant = getTenant(fighterKey);
    if (tenant) {
      const reconciledOutputs = await reconcileAssetBackedOutputs({
        outputs: state.outputs,
        tenant,
      });
      const inferredOutputs = inferMissingPromptOutputsFromAssets(reconciledOutputs);
      state.outputs = inferredOutputs;
      await persistSnapshot(fighterKey, state, tenant);
    }

    sendToFighter(fighterKey, await buildSyncMessage(fighterKey, state));
  } catch (error) {
    logger.error("pipeline sync broadcast failed", {
      ...withContext(fighterKey),
      error: getErrorMessage(error),
    });
  }
};

export const sanitizeSingleOutputForClient = (sectionId: SectionId, output: SectionOutput) =>
  sanitizeSectionOutput(sectionId, output);

const emitSectionError = (
  fighterKey: string,
  sectionId: SectionId,
  rawError: unknown,
  correlationId?: string,
) => {
  const error = unwrapSectionError(rawError);
  const state = getState(fighterKey, correlationId);
  const errorMessage = error instanceof Error ? error.message : "Unknown pipeline error.";
  state.activeSectionIds = state.activeSectionIds.filter((id) => id !== sectionId);
  state.lastErrorSectionId = sectionId;
  const tenantForPersist = getTenant(fighterKey);
  if (tenantForPersist) {
    void persistSnapshot(fighterKey, state, tenantForPersist);
  }
  if (error instanceof InsufficientBalanceError) {
    sendToFighter(fighterKey, {
      type: "wallet:insufficient-balance",
      sectionId,
      requiredNative: error.requiredNative.toString(),
      balanceNative: error.balanceNative.toString(),
    });
    sendToFighter(fighterKey, {
      type: "section:error",
      sectionId,
      error: errorMessage,
      code: "INSUFFICIENT_BALANCE",
      requiredNative: error.requiredNative.toString(),
      balanceNative: error.balanceNative.toString(),
    });
    if (tenantForPersist) {
      sendToUser(tenantForPersist.userId, {
        type: "wallet:insufficient-balance",
        sectionId,
        requiredNative: error.requiredNative.toString(),
        balanceNative: error.balanceNative.toString(),
      });
    }
    return;
  }

  sendToFighter(fighterKey, {
    type: "section:error",
    sectionId,
    error: errorMessage,
  });
};

const broadcastSectionComplete = async (
  fighterKey: string,
  sectionId: SectionId,
  output: SectionOutput,
) => {
  sendToFighter(fighterKey, {
    type: "section:complete",
    sectionId,
    output: await sanitizeSectionOutput(sectionId, output),
  });
};

const markSectionStarted = (
  state: FighterPipelineState,
  fighterKey: string,
  sectionId: SectionId,
) => {
  if (!state.activeSectionIds.includes(sectionId)) {
    state.activeSectionIds.push(sectionId);
  }
  state.lastErrorSectionId = null;
  sendToFighter(fighterKey, { type: "section:start", sectionId });
};

const markSectionFinished = (state: FighterPipelineState, sectionId: SectionId) => {
  state.activeSectionIds = state.activeSectionIds.filter((id) => id !== sectionId);
};

const emitSectionDelta = (fighterKey: string, sectionId: SectionId, delta: string) => {
  if (!delta) {
    return;
  }
  sendToFighter(fighterKey, {
    type: "section:delta",
    sectionId,
    delta,
  });
};

const syncFighterNameFromCharacterDescription = async ({
  tenant,
  markdown,
}: {
  tenant: PipelineTenant;
  markdown: string;
}) => {
  const parsedName = parseFighterNameAndEpithet(markdown).name;
  await saveFighterName(tenant.fighterId, parsedName);
};

const buildLlmCallContext = ({
  tenant,
  sectionId,
  correlationId,
}: {
  tenant?: PipelineTenant;
  sectionId: SectionId;
  correlationId?: string;
}): LlmCallContext | undefined => {
  if (!tenant) {
    return undefined;
  }

  return {
    userId: tenant.userId,
    fighterId: tenant.fighterId,
    sectionId,
    correlationId,
  };
};

type TextSectionResult = {
  content: string;
  model: string;
};

const runTextSectionStep = async ({
  fighterKey,
  sectionId,
  input,
  correlationId,
  generator,
}: {
  fighterKey: string;
  sectionId:
    | "character-description"
    | "character-pfp-prompt"
    | "specsheet-prompt"
    | "spritesheet-prompt"
    | "agent-code"
    | "strikecraft-specsheet-prompt"
    | "strikecraft-sprite-prompt";
  input: string;
  correlationId?: string;
  generator: (
    input: string,
    onDelta?: (delta: string) => void,
    context?: LlmCallContext,
  ) => Promise<TextSectionResult>;
}) => {
  const state = getState(fighterKey, correlationId);
  const tenant = getTenant(fighterKey);
  const sectionStartedAt = Date.now();
  const llmCallContext = buildLlmCallContext({ tenant, sectionId, correlationId });
  if (tenant) {
    try {
      await requirePreflightBalance({ userId: tenant.userId, sectionId });
    } catch (error) {
      throw new PipelineSectionError(sectionId, error);
    }
  }

  markSectionStarted(state, fighterKey, sectionId);
  let generated: TextSectionResult;
  try {
    generated = await generator(
      input,
      (delta) => emitSectionDelta(fighterKey, sectionId, delta),
      llmCallContext,
    );
  } catch (error) {
    markSectionFinished(state, sectionId);
    throw new PipelineSectionError(sectionId, error);
  }

  const output = setOutput(
    fighterKey,
    sectionId,
    generated.content,
    generated.model,
    undefined,
    correlationId,
  );
  await broadcastSectionComplete(fighterKey, sectionId, output);
  setHistory(
    fighterKey,
    sectionId,
    [
      { role: "user", content: input },
      { role: "assistant", content: generated.content },
    ],
    correlationId,
  );
  logger.info("pipeline section completed", {
    ...withContext(fighterKey, correlationId),
    sectionId,
    durationMs: Date.now() - sectionStartedAt,
    model: generated.model,
  });

  markSectionFinished(state, sectionId);
  if (sectionId === "character-description" && tenant) {
    try {
      await syncFighterNameFromCharacterDescription({
        tenant,
        markdown: generated.content,
      });
    } catch (error) {
      logger.warn("pipeline character-description fighter name persist failed", {
        ...withContext(fighterKey, correlationId),
        error: getErrorMessage(error),
      });
    }
  }
  if (sectionId === "agent-code" && tenant) {
    try {
      await persistAgentCodeVersion({
        fighterKey,
        tenant,
        code: generated.content,
        model: generated.model,
        correlationId,
      });
    } catch (error) {
      logger.warn("pipeline agent-code version persist failed", {
        ...withContext(fighterKey, correlationId),
        error: getErrorMessage(error),
      });
    }
  }

  if (tenant) {
    await persistSnapshot(fighterKey, state, tenant);
  }

  return generated;
};

const runSpecsheetImageStep = async (
  fighterKey: string,
  prompt: string,
  correlationId?: string,
  startedAt?: number,
) => {
  return runImageSectionStep({
    fighterKey,
    sectionId: "specsheet-image",
    prompt,
    correlationId,
    startedAt,
    objectKeyBuilder: specsheetObjectKey,
    generator: generateSpecsheetImage,
    emitGateOnComplete: true,
  });
};

const runCharacterPfpImageStep = async (
  fighterKey: string,
  prompt: string,
  correlationId?: string,
) => {
  return runImageSectionStep({
    fighterKey,
    sectionId: "character-pfp-image",
    prompt,
    correlationId,
    objectKeyBuilder: characterPfpObjectKey,
    generator: generateCharacterPfpImage,
  });
};

const runCharacterPfpFromCharacterDescription = async (
  fighterKey: string,
  characterDescription: string,
  correlationId?: string,
) => {
  const pfpPrompt = await runTextSectionStep({
    fighterKey,
    sectionId: "character-pfp-prompt",
    input: characterDescription,
    correlationId,
    generator: async (input, onDelta, context) => {
      const generated = await generateCharacterPfpPrompt(input, onDelta, context);
      return { content: generated.prompt, model: generated.model };
    },
  });

  await runCharacterPfpImageStep(fighterKey, pfpPrompt.content, correlationId);
};

const runImageSectionStep = async ({
  fighterKey,
  sectionId,
  prompt,
  correlationId,
  startedAt,
  objectKeyBuilder,
  generator,
  emitGateOnComplete,
}: {
  fighterKey: string;
  sectionId:
    | "character-pfp-image"
    | "specsheet-image"
    | "spritesheet-image"
    | "strikecraft-specsheet-image"
    | "strikecraft-sprite-image";
  prompt: string;
  correlationId?: string;
  startedAt?: number;
  objectKeyBuilder: (userId: string, fighterId: number, extension: string) => string;
  generator: (
    prompt: string,
    context?: LlmCallContext,
  ) => Promise<{ imageBase64: string; mimeType: string; model: string }>;
  emitGateOnComplete?: boolean;
}): Promise<{
  objectKey: string;
  signedUrl: string;
  width: number;
  height: number;
  model: string;
} | null> => {
  const tenant = getTenant(fighterKey);
  const state = getState(fighterKey, correlationId);
  const imageStartedAt = Date.now();
  const llmCallContext = buildLlmCallContext({ tenant, sectionId, correlationId });
  const requireTransparentBackground = sectionId === "strikecraft-sprite-image";
  const maxAttempts = requireTransparentBackground ? 2 : 1;
  markSectionStarted(state, fighterKey, sectionId);

  try {
    if (tenant) {
      await requirePreflightBalance({ userId: tenant.userId, sectionId });
    }

    let resolvedImage: {
      imageBase64: string;
      mimeType: string;
      model: string;
    } | null = null;
    let resolvedObjectKey = "";
    let resolvedSignedUrl = "";
    let resolvedWidth = 0;
    let resolvedHeight = 0;
    let lastAttemptError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const effectivePrompt =
        requireTransparentBackground && attempt > 1
          ? `${prompt}

CRITICAL TECHNICAL OUTPUT REQUIREMENTS:
- Return a TRUE alpha-channel PNG (RGBA), not a painted checkerboard.
- Every background pixel must have alpha=0.
- Do not draw gray/white square patterns to simulate transparency.
- Keep all non-subject pixels fully transparent.`
          : prompt;

      try {
        const image = await generator(effectivePrompt, llmCallContext);
        const committed = await commitImageAsset({
          tenant: requireTenant(fighterKey),
          sectionId,
          imageUrl: image.imageBase64,
          mimeTypeHint: image.mimeType,
          objectKeyBuilder,
          requireTransparentBackground,
        });
        resolvedImage = image;
        resolvedObjectKey = committed.objectKey;
        resolvedSignedUrl = committed.signedUrl;
        resolvedWidth = committed.width;
        resolvedHeight = committed.height;
        break;
      } catch (error) {
        lastAttemptError = error;
        logger.warn("pipeline image generation attempt failed", {
          ...withContext(fighterKey, correlationId),
          sectionId,
          attempt,
          maxAttempts,
          error: getErrorMessage(error),
        });
      }
    }

    if (!resolvedImage) {
      throw lastAttemptError ?? new Error(`${sectionId} image generation failed.`);
    }

    const output = setOutput(
      fighterKey,
      sectionId,
      resolvedObjectKey,
      resolvedImage.model,
      "image/png",
      correlationId,
      resolvedSignedUrl,
    );
    await broadcastSectionComplete(fighterKey, sectionId, output);
    logger.info("pipeline section completed", {
      ...withContext(fighterKey, correlationId),
      sectionId,
      durationMs: Date.now() - imageStartedAt,
      model: resolvedImage.model,
      mimeType: "image/png",
    });

    if (tenant) {
      await persistSnapshot(fighterKey, state, tenant);
    }

    markSectionFinished(state, sectionId);
    if (emitGateOnComplete) {
      state.gateMessage = "Happy with the result? Continue generating remaining assets";
      sendToFighter(fighterKey, {
        type: "pipeline:gate",
        sectionId,
        message: state.gateMessage,
      });
      logger.info("pipeline gate emitted", {
        ...withContext(fighterKey, correlationId),
        sectionId,
        totalDurationMs: startedAt ? Date.now() - startedAt : Date.now() - imageStartedAt,
      });
    }

    return {
      objectKey: resolvedObjectKey,
      signedUrl: resolvedSignedUrl,
      width: resolvedWidth,
      height: resolvedHeight,
      model: resolvedImage.model,
    };
  } catch (error) {
    markSectionFinished(state, sectionId);
    emitSectionError(fighterKey, sectionId, error, correlationId);
    return null;
  }
};

const runSpritesheetManifestStep = async ({
  fighterKey,
  imageUrl,
  sheetWidth,
  sheetHeight,
  correlationId,
  modelHint,
}: {
  fighterKey: string;
  imageUrl: string;
  sheetWidth: number;
  sheetHeight: number;
  correlationId?: string;
  modelHint?: string;
}) => {
  const tenant = requireTenant(fighterKey);
  const state = getState(fighterKey, correlationId);
  const sectionId: SectionId = "spritesheet-manifest";
  markSectionStarted(state, fighterKey, sectionId);

  try {
    await requirePreflightBalance({ userId: tenant.userId, sectionId });

    const generated = await generateSpritesheetManifest({
      imageUrl,
      sheetWidth,
      sheetHeight,
      context: buildLlmCallContext({ tenant, sectionId, correlationId }),
    });
    const normalized = normalizeSpritesheetManifest({
      raw: generated.manifest,
      sheetWidth,
      sheetHeight,
    });
    const objectKey = spritesheetManifestObjectKey(tenant.userId, tenant.fighterId);
    await putObject(
      objectKey,
      Buffer.from(JSON.stringify(normalized, null, 2)),
      "application/json",
    );
    const signedUrl = await getSignedReadUrl(objectKey);
    const output = setOutput(
      fighterKey,
      sectionId,
      objectKey,
      generated.model || modelHint || "spritesheet-manifest-mapper",
      "application/json",
      correlationId,
      signedUrl,
    );
    await broadcastSectionComplete(fighterKey, sectionId, output);
    markSectionFinished(state, sectionId);
    if (tenant) {
      await persistSnapshot(fighterKey, state, tenant);
    }
  } catch (error) {
    markSectionFinished(state, sectionId);
    emitSectionError(fighterKey, sectionId, error, correlationId);
  }
};

const runPhase2Pipeline = async (fighterKey: string, correlationId?: string) => {
  const state = getState(fighterKey, correlationId);
  const characterDescription = state.outputs["character-description"]?.content;
  if (!characterDescription) {
    throw new Error("Character description is required before continuing the pipeline.");
  }

  const needsSpritesheetPrompt = !hasPersistedPromptContent(
    state.outputs["spritesheet-prompt"]?.content,
  );
  const needsAgentCode = !state.outputs["agent-code"]?.content;
  const needsStrikecraftSpecsheetPrompt = !hasPersistedPromptContent(
    state.outputs["strikecraft-specsheet-prompt"]?.content,
  );

  const batch1: Promise<TextSectionResult>[] = [];
  const batch1Indices = { spritesheet: -1, agent: -1, specsheet: -1 };

  if (needsSpritesheetPrompt) {
    batch1Indices.spritesheet = batch1.length;
    batch1.push(
      runTextSectionStep({
        fighterKey,
        sectionId: "spritesheet-prompt",
        input: characterDescription,
        correlationId,
        generator: async (input, onDelta, context) => {
          const generated = await generateSpritesheetPrompt(input, onDelta, context);
          return { content: generated.prompt, model: generated.model };
        },
      }),
    );
  }

  if (needsAgentCode) {
    batch1Indices.agent = batch1.length;
    batch1.push(
      runTextSectionStep({
        fighterKey,
        sectionId: "agent-code",
        input: characterDescription,
        correlationId,
        generator: async (input, onDelta, context) => {
          const generated = await generateAgentCode(input, onDelta, context);
          return { content: generated.code, model: generated.model };
        },
      }),
    );
  }

  if (needsStrikecraftSpecsheetPrompt) {
    batch1Indices.specsheet = batch1.length;
    batch1.push(
      runTextSectionStep({
        fighterKey,
        sectionId: "strikecraft-specsheet-prompt",
        input: characterDescription,
        correlationId,
        generator: async (input, onDelta, context) => {
          const generated = await generateStrikecraftSpecsheetPrompt(input, onDelta, context);
          return { content: generated.prompt, model: generated.model };
        },
      }),
    );
  }

  const batch1Results = await Promise.all(batch1);

  const spritesheetPromptContent =
    batch1Indices.spritesheet >= 0
      ? batch1Results[batch1Indices.spritesheet]!.content
      : state.outputs["spritesheet-prompt"]!.content;
  const strikecraftSpecsheetPromptContent =
    batch1Indices.specsheet >= 0
      ? batch1Results[batch1Indices.specsheet]!.content
      : state.outputs["strikecraft-specsheet-prompt"]!.content;

  const needsSpritesheetImage = !state.outputs["spritesheet-image"]?.content;
  const needsStrikecraftSpecsheetImage = !state.outputs["strikecraft-specsheet-image"]?.content;
  const needsStrikecraftSpritePrompt = !hasPersistedPromptContent(
    state.outputs["strikecraft-sprite-prompt"]?.content,
  );

  const batch2: Promise<unknown>[] = [];
  const batch2Indices = { spritesheetImage: -1, specsheetImage: -1, spritePrompt: -1 };

  if (needsSpritesheetImage) {
    batch2Indices.spritesheetImage = batch2.length;
    batch2.push(
      runImageSectionStep({
        fighterKey,
        sectionId: "spritesheet-image",
        prompt: spritesheetPromptContent,
        correlationId,
        objectKeyBuilder: spritesheetImageObjectKey,
        generator: generateSpritesheetImage,
      }),
    );
  }

  if (needsStrikecraftSpecsheetImage) {
    batch2Indices.specsheetImage = batch2.length;
    batch2.push(
      runImageSectionStep({
        fighterKey,
        sectionId: "strikecraft-specsheet-image",
        prompt: strikecraftSpecsheetPromptContent,
        correlationId,
        objectKeyBuilder: strikecraftSpecsheetObjectKey,
        generator: generateStrikecraftSpecsheetImage,
      }),
    );
  }

  if (needsStrikecraftSpritePrompt) {
    batch2Indices.spritePrompt = batch2.length;
    batch2.push(
      runTextSectionStep({
        fighterKey,
        sectionId: "strikecraft-sprite-prompt",
        input: strikecraftSpecsheetPromptContent,
        correlationId,
        generator: async (input, onDelta, context) => {
          const generated = await generateStrikecraftSpritePrompt(input, onDelta, context);
          return { content: generated.prompt, model: generated.model };
        },
      }),
    );
  }

  const batch2Results = await Promise.all(batch2);

  const spritesheetImageResult =
    batch2Indices.spritesheetImage >= 0
      ? (batch2Results[batch2Indices.spritesheetImage] as {
          objectKey: string;
          signedUrl: string;
          width: number;
          height: number;
          model: string;
        } | null)
      : null;

  const needsSpritesheetManifest = !state.outputs["spritesheet-manifest"]?.content;
  if (needsSpritesheetManifest) {
    const manifestSource = spritesheetImageResult
      ? {
          imageUrl: spritesheetImageResult.signedUrl,
          sheetWidth: spritesheetImageResult.width,
          sheetHeight: spritesheetImageResult.height,
          modelHint: spritesheetImageResult.model,
        }
      : await (async () => {
          const stored = await resolveStoredImageForManifest(
            state.outputs["spritesheet-image"]?.content,
          );
          if (!stored) {
            return null;
          }
          return {
            imageUrl: stored.signedUrl,
            sheetWidth: stored.width,
            sheetHeight: stored.height,
            modelHint: state.outputs["spritesheet-image"]?.model,
          };
        })();

    if (manifestSource) {
      await runSpritesheetManifestStep({
        fighterKey,
        ...manifestSource,
        correlationId,
      });
    }
  }

  const needsStrikecraftSpriteImage = !state.outputs["strikecraft-sprite-image"]?.content;
  if (needsStrikecraftSpriteImage) {
    const strikecraftSpritePromptContent =
      batch2Indices.spritePrompt >= 0
        ? (batch2Results[batch2Indices.spritePrompt] as TextSectionResult).content
        : state.outputs["strikecraft-sprite-prompt"]!.content;

    await runImageSectionStep({
      fighterKey,
      sectionId: "strikecraft-sprite-image",
      prompt: strikecraftSpritePromptContent,
      correlationId,
      objectKeyBuilder: strikecraftSpriteObjectKey,
      generator: generateStrikecraftSpriteImage,
    });
  }
};

const startPipelineImpl = async (fighterKey: string, prompt: string, correlationId?: string) => {
  requireTenant(fighterKey);

  const startedAt = Date.now();
  logger.info("pipeline start requested", {
    ...withContext(fighterKey, correlationId),
    promptLength: prompt.length,
  });

  clearPendingForFighter(fighterKey);

  const state = getState(fighterKey, correlationId);
  state.outputs = {};
  state.histories = {};
  state.activeSectionIds = [];
  state.lastErrorSectionId = null;
  state.gateMessage = null;
  logger.debug("pipeline state cleared", withContext(fighterKey, correlationId));

  const tenant = getTenant(fighterKey);

  try {
    const character = await runTextSectionStep({
      fighterKey,
      sectionId: "character-description",
      input: prompt,
      correlationId,
      generator: async (input, onDelta, context) => {
        const generated = await generateCharacterDescription(input, onDelta, context);
        return { content: generated.markdown, model: generated.model };
      },
    });

    await Promise.all([
      (async () => {
        const specPrompt = await runTextSectionStep({
          fighterKey,
          sectionId: "specsheet-prompt",
          input: character.content,
          correlationId,
          generator: async (input, onDelta, context) => {
            const generated = await generateSpecsheetPrompt(input, onDelta, context);
            return { content: generated.prompt, model: generated.model };
          },
        });

        await runSpecsheetImageStep(fighterKey, specPrompt.content, correlationId, startedAt);
      })(),
      runCharacterPfpFromCharacterDescription(fighterKey, character.content, correlationId),
    ]);
    if (tenant) {
      await syncPipelineState(fighterKey);
    }
  } catch (error) {
    const { sectionId, cause } = resolveErrorSectionId(
      error,
      getState(fighterKey, correlationId).activeSectionIds[0] ?? "character-description",
    );
    logger.error("pipeline start failed", {
      ...withContext(fighterKey, correlationId),
      durationMs: Date.now() - startedAt,
      sectionId,
      error: getErrorMessage(cause),
    });
    emitSectionError(fighterKey, sectionId, cause, correlationId);
  }
};

const generateSpecsheetFromCharacterDescriptionImpl = async (
  fighterKey: string,
  characterDescription: string,
  correlationId?: string,
) => {
  requireTenant(fighterKey);

  const startedAt = Date.now();
  logger.info("pipeline specsheet generation requested", {
    ...withContext(fighterKey, correlationId),
    descriptionLength: characterDescription.length,
  });

  const state = getState(fighterKey, correlationId);
  state.gateMessage = null;
  state.lastErrorSectionId = null;
  const tenant = getTenant(fighterKey);

  try {
    const specPrompt = await runTextSectionStep({
      fighterKey,
      sectionId: "specsheet-prompt",
      input: characterDescription,
      correlationId,
      generator: async (input, onDelta, context) => {
        const generated = await generateSpecsheetPrompt(input, onDelta, context);
        return { content: generated.prompt, model: generated.model };
      },
    });

    await runSpecsheetImageStep(fighterKey, specPrompt.content, correlationId, startedAt);
    if (tenant) {
      await syncPipelineState(fighterKey);
    }
  } catch (error) {
    const { sectionId, cause } = resolveErrorSectionId(
      error,
      getState(fighterKey, correlationId).activeSectionIds[0] ?? "specsheet-prompt",
    );
    logger.error("pipeline specsheet generation failed", {
      ...withContext(fighterKey, correlationId),
      durationMs: Date.now() - startedAt,
      sectionId,
      error: getErrorMessage(cause),
    });
    emitSectionError(fighterKey, sectionId, cause, correlationId);
  }
};

const generateCharacterPfpFromCharacterDescriptionImpl = async (
  fighterKey: string,
  characterDescription?: string,
  correlationId?: string,
) => {
  requireTenant(fighterKey);

  const startedAt = Date.now();
  const state = getState(fighterKey, correlationId);
  const resolvedCharacterDescription =
    characterDescription?.trim() || state.outputs["character-description"]?.content;
  logger.info("pipeline character-pfp generation requested", {
    ...withContext(fighterKey, correlationId),
    descriptionLength: resolvedCharacterDescription?.length ?? 0,
  });

  if (!resolvedCharacterDescription) {
    const error = new Error(
      "Character description is required before regenerating character profile picture.",
    );
    logger.error("pipeline character-pfp generation failed", {
      ...withContext(fighterKey, correlationId),
      durationMs: Date.now() - startedAt,
      error: error.message,
    });
    emitSectionError(fighterKey, "character-pfp-prompt", error, correlationId);
    return;
  }

  state.gateMessage = null;
  state.lastErrorSectionId = null;
  const tenant = getTenant(fighterKey);

  try {
    await runCharacterPfpFromCharacterDescription(
      fighterKey,
      resolvedCharacterDescription,
      correlationId,
    );
    if (tenant) {
      await syncPipelineState(fighterKey);
    }
  } catch (error) {
    const { sectionId, cause } = resolveErrorSectionId(
      error,
      getState(fighterKey, correlationId).activeSectionIds[0] ?? "character-pfp-prompt",
    );
    logger.error("pipeline character-pfp generation failed", {
      ...withContext(fighterKey, correlationId),
      durationMs: Date.now() - startedAt,
      sectionId,
      error: getErrorMessage(cause),
    });
    emitSectionError(fighterKey, sectionId, cause, correlationId);
  }
};

const generateAgentCodeFromCharacterDescriptionImpl = async (
  fighterKey: string,
  characterDescription?: string,
  correlationId?: string,
) => {
  requireTenant(fighterKey);

  const startedAt = Date.now();
  const state = getState(fighterKey, correlationId);
  const resolvedCharacterDescription =
    characterDescription?.trim() || state.outputs["character-description"]?.content;
  logger.info("pipeline agent-code generation requested", {
    ...withContext(fighterKey, correlationId),
    descriptionLength: resolvedCharacterDescription?.length ?? 0,
  });

  if (!resolvedCharacterDescription) {
    const error = new Error("Character description is required before regenerating agent code.");
    logger.error("pipeline agent-code generation failed", {
      ...withContext(fighterKey, correlationId),
      durationMs: Date.now() - startedAt,
      error: error.message,
    });
    emitSectionError(fighterKey, "agent-code", error, correlationId);
    return;
  }

  state.gateMessage = null;
  state.lastErrorSectionId = null;
  const tenant = getTenant(fighterKey);

  try {
    await runTextSectionStep({
      fighterKey,
      sectionId: "agent-code",
      input: resolvedCharacterDescription,
      correlationId,
      generator: async (input, onDelta, context) => {
        const generated = await generateAgentCode(input, onDelta, context);
        return { content: generated.code, model: generated.model };
      },
    });

    if (tenant) {
      await syncPipelineState(fighterKey);
    }
  } catch (error) {
    logger.error("pipeline agent-code generation failed", {
      ...withContext(fighterKey, correlationId),
      durationMs: Date.now() - startedAt,
      error: getErrorMessage(error),
    });
    emitSectionError(fighterKey, "agent-code", error, correlationId);
    return;
  }

  logger.info("pipeline agent-code generation completed", {
    ...withContext(fighterKey, correlationId),
    durationMs: Date.now() - startedAt,
  });
};

const requireCharacterDescriptionForRegeneration = (
  fighterKey: string,
  errorSectionId: SectionId,
  correlationId?: string,
): string | null => {
  const content = getState(fighterKey, correlationId).outputs[
    "character-description"
  ]?.content?.trim();
  if (content) {
    return content;
  }

  const error = new Error("Character description is required before regenerating this section.");
  emitSectionError(fighterKey, errorSectionId, error, correlationId);
  return null;
};

const ensureSpritesheetPrompt = async (
  fighterKey: string,
  correlationId?: string,
): Promise<string | null> => {
  const existing = getState(fighterKey, correlationId).outputs["spritesheet-prompt"]?.content;
  if (hasPersistedPromptContent(existing)) {
    return existing;
  }

  const characterDescription = requireCharacterDescriptionForRegeneration(
    fighterKey,
    "spritesheet-image",
    correlationId,
  );
  if (!characterDescription) {
    return null;
  }

  const generated = await runTextSectionStep({
    fighterKey,
    sectionId: "spritesheet-prompt",
    input: characterDescription,
    correlationId,
    generator: async (input, onDelta, context) => {
      const result = await generateSpritesheetPrompt(input, onDelta, context);
      return { content: result.prompt, model: result.model };
    },
  });

  return generated.content;
};

const ensureStrikecraftSpecsheetPrompt = async (
  fighterKey: string,
  correlationId?: string,
): Promise<string | null> => {
  const existing = getState(fighterKey, correlationId).outputs["strikecraft-specsheet-prompt"]
    ?.content;
  if (hasPersistedPromptContent(existing)) {
    return existing;
  }

  const characterDescription = requireCharacterDescriptionForRegeneration(
    fighterKey,
    "strikecraft-specsheet-image",
    correlationId,
  );
  if (!characterDescription) {
    return null;
  }

  const generated = await runTextSectionStep({
    fighterKey,
    sectionId: "strikecraft-specsheet-prompt",
    input: characterDescription,
    correlationId,
    generator: async (input, onDelta, context) => {
      const result = await generateStrikecraftSpecsheetPrompt(input, onDelta, context);
      return { content: result.prompt, model: result.model };
    },
  });

  return generated.content;
};

const ensureStrikecraftSpritePrompt = async (
  fighterKey: string,
  correlationId?: string,
): Promise<string | null> => {
  const existing = getState(fighterKey, correlationId).outputs["strikecraft-sprite-prompt"]
    ?.content;
  if (hasPersistedPromptContent(existing)) {
    return existing;
  }

  const specsheetPrompt = await ensureStrikecraftSpecsheetPrompt(fighterKey, correlationId);
  if (!specsheetPrompt) {
    return null;
  }

  const generated = await runTextSectionStep({
    fighterKey,
    sectionId: "strikecraft-sprite-prompt",
    input: specsheetPrompt,
    correlationId,
    generator: async (input, onDelta, context) => {
      const result = await generateStrikecraftSpritePrompt(input, onDelta, context);
      return { content: result.prompt, model: result.model };
    },
  });

  return generated.content;
};

const refreshStrikecraftSpriteAfterSpecsheetRegeneration = async (
  fighterKey: string,
  {
    hadSpecsheetPrompt,
    hadSpritePrompt,
  }: {
    hadSpecsheetPrompt: boolean;
    hadSpritePrompt: boolean;
  },
  correlationId?: string,
) => {
  if (!hadSpecsheetPrompt) {
    const state = getState(fighterKey, correlationId);
    delete state.outputs["strikecraft-sprite-prompt"];
    delete state.histories["strikecraft-sprite-prompt"];
  }

  const spritePrompt = await ensureStrikecraftSpritePrompt(fighterKey, correlationId);
  if (!spritePrompt) {
    return;
  }

  if (!hadSpritePrompt || !hadSpecsheetPrompt) {
    await runImageSectionStep({
      fighterKey,
      sectionId: "strikecraft-sprite-image",
      prompt: spritePrompt,
      correlationId,
      objectKeyBuilder: strikecraftSpriteObjectKey,
      generator: generateStrikecraftSpriteImage,
    });
  }
};

const generateSpritesheetImageFromPromptImpl = async (
  fighterKey: string,
  correlationId?: string,
) => {
  requireTenant(fighterKey);

  const startedAt = Date.now();
  const state = getState(fighterKey, correlationId);
  logger.info("pipeline spritesheet-image regeneration requested", {
    ...withContext(fighterKey, correlationId),
    promptLength: state.outputs["spritesheet-prompt"]?.content?.length ?? 0,
  });

  state.gateMessage = null;
  state.lastErrorSectionId = null;
  const tenant = getTenant(fighterKey);

  try {
    const prompt = await ensureSpritesheetPrompt(fighterKey, correlationId);
    if (!prompt) {
      return;
    }

    const imageResult = await runImageSectionStep({
      fighterKey,
      sectionId: "spritesheet-image",
      prompt,
      correlationId,
      objectKeyBuilder: spritesheetImageObjectKey,
      generator: generateSpritesheetImage,
    });
    if (imageResult) {
      await runSpritesheetManifestStep({
        fighterKey,
        imageUrl: imageResult.signedUrl,
        sheetWidth: imageResult.width,
        sheetHeight: imageResult.height,
        correlationId,
        modelHint: imageResult.model,
      });
    }

    if (tenant) {
      await syncPipelineState(fighterKey);
    }
  } catch (error) {
    logger.error("pipeline spritesheet-image regeneration failed", {
      ...withContext(fighterKey, correlationId),
      durationMs: Date.now() - startedAt,
      error: getErrorMessage(error),
    });
    emitSectionError(fighterKey, "spritesheet-image", error, correlationId);
    return;
  }

  logger.info("pipeline spritesheet-image regeneration completed", {
    ...withContext(fighterKey, correlationId),
    durationMs: Date.now() - startedAt,
  });
};

const generateStrikecraftSpriteImageFromPromptImpl = async (
  fighterKey: string,
  correlationId?: string,
) => {
  requireTenant(fighterKey);

  const startedAt = Date.now();
  const state = getState(fighterKey, correlationId);
  logger.info("pipeline strikecraft-sprite-image regeneration requested", {
    ...withContext(fighterKey, correlationId),
    promptLength: state.outputs["strikecraft-sprite-prompt"]?.content?.length ?? 0,
  });

  state.gateMessage = null;
  state.lastErrorSectionId = null;
  const tenant = getTenant(fighterKey);

  try {
    const hadSpritePrompt = hasPersistedPromptContent(
      getState(fighterKey, correlationId).outputs["strikecraft-sprite-prompt"]?.content,
    );
    const prompt = await ensureStrikecraftSpritePrompt(fighterKey, correlationId);
    if (!prompt) {
      return;
    }

    await runImageSectionStep({
      fighterKey,
      sectionId: "strikecraft-sprite-image",
      prompt,
      correlationId,
      objectKeyBuilder: strikecraftSpriteObjectKey,
      generator: generateStrikecraftSpriteImage,
    });

    if (!hadSpritePrompt && tenant) {
      await persistSnapshot(fighterKey, getState(fighterKey, correlationId), tenant);
    }

    if (tenant) {
      await syncPipelineState(fighterKey);
    }
  } catch (error) {
    logger.error("pipeline strikecraft-sprite-image regeneration failed", {
      ...withContext(fighterKey, correlationId),
      durationMs: Date.now() - startedAt,
      error: getErrorMessage(error),
    });
    emitSectionError(fighterKey, "strikecraft-sprite-image", error, correlationId);
    return;
  }

  logger.info("pipeline strikecraft-sprite-image regeneration completed", {
    ...withContext(fighterKey, correlationId),
    durationMs: Date.now() - startedAt,
  });
};

const generateStrikecraftSpecsheetImageFromPromptImpl = async (
  fighterKey: string,
  correlationId?: string,
) => {
  requireTenant(fighterKey);

  const startedAt = Date.now();
  const state = getState(fighterKey, correlationId);
  const hadSpecsheetPrompt = hasPersistedPromptContent(
    state.outputs["strikecraft-specsheet-prompt"]?.content,
  );
  const hadSpritePrompt = hasPersistedPromptContent(
    state.outputs["strikecraft-sprite-prompt"]?.content,
  );
  logger.info("pipeline strikecraft-specsheet-image regeneration requested", {
    ...withContext(fighterKey, correlationId),
    promptLength: state.outputs["strikecraft-specsheet-prompt"]?.content?.length ?? 0,
    hadSpritePrompt,
  });

  state.gateMessage = null;
  state.lastErrorSectionId = null;
  const tenant = getTenant(fighterKey);

  try {
    const prompt = await ensureStrikecraftSpecsheetPrompt(fighterKey, correlationId);
    if (!prompt) {
      return;
    }

    await runImageSectionStep({
      fighterKey,
      sectionId: "strikecraft-specsheet-image",
      prompt,
      correlationId,
      objectKeyBuilder: strikecraftSpecsheetObjectKey,
      generator: generateStrikecraftSpecsheetImage,
    });

    await refreshStrikecraftSpriteAfterSpecsheetRegeneration(
      fighterKey,
      { hadSpecsheetPrompt, hadSpritePrompt },
      correlationId,
    );

    if (tenant) {
      await syncPipelineState(fighterKey);
    }
  } catch (error) {
    logger.error("pipeline strikecraft-specsheet-image regeneration failed", {
      ...withContext(fighterKey, correlationId),
      durationMs: Date.now() - startedAt,
      error: getErrorMessage(error),
    });
    emitSectionError(fighterKey, "strikecraft-specsheet-image", error, correlationId);
    return;
  }

  logger.info("pipeline strikecraft-specsheet-image regeneration completed", {
    ...withContext(fighterKey, correlationId),
    durationMs: Date.now() - startedAt,
  });
};

const isPhaseOneComplete = (state: FighterPipelineState): boolean => {
  const phaseOneSectionIds: SectionId[] = stepOrder.slice(0, 5);
  return phaseOneSectionIds.every((id) => !!state.outputs[id]?.content);
};

const resumePhaseOne = async (fighterKey: string, correlationId?: string) => {
  const state = getState(fighterKey, correlationId);
  const tenant = getTenant(fighterKey);
  let characterDescription = state.outputs["character-description"]?.content;

  if (!characterDescription) {
    if (!tenant) {
      throw new Error(
        "Character description has not been generated yet. Submit an intake prompt to begin.",
      );
    }

    const briefing = await getFighterBriefing(tenant.fighterId);
    if (!briefing) {
      throw new Error(
        "Character description has not been generated yet. Submit an intake prompt to begin.",
      );
    }

    logger.info("pipeline resuming phase 1 from stored briefing", {
      ...withContext(fighterKey, correlationId),
      briefingLength: briefing.length,
    });

    const character = await runTextSectionStep({
      fighterKey,
      sectionId: "character-description",
      input: briefing,
      correlationId,
      generator: async (input, onDelta, context) => {
        const generated = await generateCharacterDescription(input, onDelta, context);
        return { content: generated.markdown, model: generated.model };
      },
    });

    characterDescription = character.content;
  }

  state.lastErrorSectionId = null;

  const needsSpecsheetPrompt = !hasPersistedPromptContent(
    state.outputs["specsheet-prompt"]?.content,
  );
  const needsSpecsheetImage = !state.outputs["specsheet-image"]?.content;
  const needsPfpPrompt = !hasPersistedPromptContent(state.outputs["character-pfp-prompt"]?.content);
  const needsPfpImage = !state.outputs["character-pfp-image"]?.content;

  const tasks: Promise<unknown>[] = [];

  if (needsSpecsheetPrompt || needsSpecsheetImage) {
    tasks.push(
      (async () => {
        let promptContent = state.outputs["specsheet-prompt"]?.content;
        if (!hasPersistedPromptContent(promptContent)) {
          const specPrompt = await runTextSectionStep({
            fighterKey,
            sectionId: "specsheet-prompt",
            input: characterDescription,
            correlationId,
            generator: async (input, onDelta, context) => {
              const generated = await generateSpecsheetPrompt(input, onDelta, context);
              return { content: generated.prompt, model: generated.model };
            },
          });
          promptContent = specPrompt.content;
        }
        if (!state.outputs["specsheet-image"]?.content) {
          await runSpecsheetImageStep(fighterKey, promptContent, correlationId);
        }
      })(),
    );
  }

  if (needsPfpPrompt || needsPfpImage) {
    tasks.push(
      (async () => {
        let promptContent = state.outputs["character-pfp-prompt"]?.content;
        if (!hasPersistedPromptContent(promptContent)) {
          const pfpPrompt = await runTextSectionStep({
            fighterKey,
            sectionId: "character-pfp-prompt",
            input: characterDescription,
            correlationId,
            generator: async (input, onDelta, context) => {
              const generated = await generateCharacterPfpPrompt(input, onDelta, context);
              return { content: generated.prompt, model: generated.model };
            },
          });
          promptContent = pfpPrompt.content;
        }
        if (!state.outputs["character-pfp-image"]?.content) {
          await runCharacterPfpImageStep(fighterKey, promptContent, correlationId);
        }
      })(),
    );
  }

  if (tasks.length === 0) {
    return;
  }

  await Promise.all(tasks);
  if (tenant) {
    await syncPipelineState(fighterKey);
  }
};

const continuePipelineImpl = async (fighterKey: string, correlationId?: string) => {
  logger.info("pipeline continue requested", withContext(fighterKey, correlationId));
  requireTenant(fighterKey);
  const state = getState(fighterKey, correlationId);
  state.gateMessage = null;
  const tenant = getTenant(fighterKey);
  if (tenant) {
    await persistSnapshot(fighterKey, state, tenant);
  }

  try {
    if (!isPhaseOneComplete(state)) {
      await resumePhaseOne(fighterKey, correlationId);
      if (tenant) {
        await syncPipelineState(fighterKey);
      }
      return;
    }

    await runPhase2Pipeline(fighterKey, correlationId);

    const statuses = deriveSectionStatuses({
      outputs: state.outputs,
      activeSectionIds: state.activeSectionIds,
      lastErrorSectionId: state.lastErrorSectionId,
    });
    const erroredSectionId = stepOrder.find((id) => statuses[id] === "error");
    if (erroredSectionId) {
      logger.warn("pipeline continue finished with section error", {
        ...withContext(fighterKey, correlationId),
        sectionId: erroredSectionId,
      });
    } else {
      sendToFighter(fighterKey, { type: "pipeline:complete" });
      logger.info("pipeline marked complete", withContext(fighterKey, correlationId));
    }
  } catch (error) {
    const { sectionId, cause } = resolveErrorSectionId(
      error,
      getState(fighterKey, correlationId).activeSectionIds[0] ?? "spritesheet-prompt",
    );
    logger.error("pipeline continue failed", {
      ...withContext(fighterKey, correlationId),
      sectionId,
      error: getErrorMessage(cause),
    });
    emitSectionError(fighterKey, sectionId, cause, correlationId);
  } finally {
    if (tenant) {
      await syncPipelineState(fighterKey);
    }
  }
};

const refineSectionImpl = async (
  fighterKey: string,
  sectionId: SectionId,
  message: string,
  history: ChatMessage[],
  correlationId?: string,
) => {
  requireTenant(fighterKey);

  const startedAt = Date.now();
  logger.info("pipeline refine requested", {
    ...withContext(fighterKey, correlationId),
    sectionId,
    messageLength: message.length,
    historyLength: history.length,
  });

  const state = getState(fighterKey, correlationId);
  const tenant = getTenant(fighterKey);
  markSectionStarted(state, fighterKey, sectionId);

  try {
    if (sectionId === "character-description") {
      const refined = await generateCharacterDescriptionRefine(
        history,
        message,
        buildLlmCallContext({ tenant, sectionId, correlationId }),
      );
      const outputRecord = setOutput(
        fighterKey,
        sectionId,
        refined.markdown,
        refined.model,
        undefined,
        correlationId,
      );
      setHistory(
        fighterKey,
        sectionId,
        [
          ...history,
          { role: "user", content: message },
          { role: "assistant", content: refined.markdown },
        ],
        correlationId,
      );
      resetDownstream(fighterKey, sectionId, correlationId);
      await broadcastSectionComplete(fighterKey, sectionId, outputRecord);
      if (tenant) {
        await syncFighterNameFromCharacterDescription({
          tenant,
          markdown: refined.markdown,
        });
      }

      logger.info("pipeline refine generated", {
        ...withContext(fighterKey, correlationId),
        sectionId,
        model: refined.model,
      });
    } else if (sectionId === "specsheet-prompt") {
      const refined = await generateSpecsheetPromptRefine(
        history,
        message,
        buildLlmCallContext({ tenant, sectionId, correlationId }),
      );
      const outputRecord = setOutput(
        fighterKey,
        sectionId,
        refined.prompt,
        refined.model,
        undefined,
        correlationId,
      );

      setHistory(
        fighterKey,
        sectionId,
        [
          ...history,
          { role: "user", content: message },
          { role: "assistant", content: refined.prompt },
        ],
        correlationId,
      );
      await broadcastSectionComplete(fighterKey, sectionId, outputRecord);

      logger.info("pipeline refine generated", {
        ...withContext(fighterKey, correlationId),
        sectionId,
        model: refined.model,
      });
    } else if (sectionId === "specsheet-image") {
      const generated = await generateSpecsheetImage(
        message,
        buildLlmCallContext({ tenant, sectionId, correlationId }),
      );
      const committed = await commitImageAsset({
        tenant: requireTenant(fighterKey),
        sectionId,
        imageUrl: generated.imageBase64,
        mimeTypeHint: generated.mimeType,
        objectKeyBuilder: imageObjectKeyBuilders["specsheet-image"],
        requireTransparentBackground: false,
      });

      const outputRecord = setOutput(
        fighterKey,
        sectionId,
        committed.objectKey,
        generated.model,
        "image/png",
        correlationId,
        committed.signedUrl,
      );
      await broadcastSectionComplete(fighterKey, sectionId, outputRecord);
      logger.info("pipeline refine generated", {
        ...withContext(fighterKey, correlationId),
        sectionId,
        model: generated.model,
        mimeType: "image/png",
      });
    } else {
      throw new Error(`Refine is not supported for section "${sectionId}".`);
    }

    markSectionFinished(state, sectionId);

    if (tenant) {
      await persistSnapshot(fighterKey, getState(fighterKey, correlationId), tenant);
      await syncPipelineState(fighterKey);
    }

    if (sectionId === "specsheet-prompt") {
      try {
        const output = getState(fighterKey, correlationId).outputs["specsheet-prompt"];
        if (!output) {
          throw new Error("Missing specsheet prompt.");
        }

        await runSpecsheetImageStep(fighterKey, output.content, correlationId);
      } catch (imageError) {
        logger.error("pipeline auto image generation failed after refine", {
          ...withContext(fighterKey, correlationId),
          sectionId: "specsheet-image",
          durationMs: Date.now() - startedAt,
          error: getErrorMessage(imageError),
        });
        emitSectionError(fighterKey, "specsheet-image", imageError, correlationId);
      }
    }

    logger.info("pipeline refine completed", {
      ...withContext(fighterKey, correlationId),
      sectionId,
      durationMs: Date.now() - startedAt,
    });
  } catch (error) {
    markSectionFinished(state, sectionId);
    logger.error("pipeline refine failed", {
      ...withContext(fighterKey, correlationId),
      sectionId,
      durationMs: Date.now() - startedAt,
      error: getErrorMessage(error),
    });
    emitSectionError(fighterKey, sectionId, error, correlationId);
  }
};

const editSectionImpl = async (
  fighterKey: string,
  sectionId: SectionId,
  content: string,
  correlationId?: string,
) => {
  requireTenant(fighterKey);

  const startedAt = Date.now();
  logger.info("pipeline edit requested", {
    ...withContext(fighterKey, correlationId),
    sectionId,
    contentLength: content.length,
  });

  const tenant = getTenant(fighterKey);

  try {
    const previous = getState(fighterKey, correlationId).outputs[sectionId];
    const model = previous?.model ?? "manual-edit";
    const mimeType = previous?.mimeType;

    if (isImageSection(sectionId)) {
      const objectKeyBuilder = imageObjectKeyBuilders[sectionId];
      const committed = await commitImageAsset({
        tenant: requireTenant(fighterKey),
        sectionId,
        imageUrl: content,
        mimeTypeHint: mimeType ?? "image/png",
        objectKeyBuilder,
        requireTransparentBackground:
          sectionId === "spritesheet-image" || sectionId === "strikecraft-sprite-image",
      });
      const outputRecord = setOutput(
        fighterKey,
        sectionId,
        committed.objectKey,
        model,
        "image/png",
        correlationId,
        committed.signedUrl,
      );
      await broadcastSectionComplete(fighterKey, sectionId, outputRecord);
    } else {
      const outputRecord = setOutput(
        fighterKey,
        sectionId,
        content,
        model,
        mimeType,
        correlationId,
      );
      if (sectionId === "character-description") {
        resetDownstream(fighterKey, sectionId, correlationId);
      }
      await broadcastSectionComplete(fighterKey, sectionId, outputRecord);
      if (sectionId === "character-description" && tenant) {
        await syncFighterNameFromCharacterDescription({
          tenant,
          markdown: content,
        });
      }
    }

    if (tenant) {
      await persistSnapshot(fighterKey, getState(fighterKey, correlationId), tenant);
      await syncPipelineState(fighterKey);
    }

    if (sectionId === "specsheet-prompt") {
      try {
        const output = getState(fighterKey, correlationId).outputs["specsheet-prompt"];
        if (!output) {
          throw new Error("Missing edited specsheet prompt.");
        }

        await runSpecsheetImageStep(fighterKey, output.content, correlationId);
      } catch (imageError) {
        logger.error("pipeline auto image generation failed after edit", {
          ...withContext(fighterKey, correlationId),
          sectionId: "specsheet-image",
          durationMs: Date.now() - startedAt,
          error: getErrorMessage(imageError),
        });
        emitSectionError(fighterKey, "specsheet-image", imageError, correlationId);
      }
    }

    logger.info("pipeline edit completed", {
      ...withContext(fighterKey, correlationId),
      sectionId,
      durationMs: Date.now() - startedAt,
    });
  } catch (error) {
    logger.error("pipeline edit failed", {
      ...withContext(fighterKey, correlationId),
      sectionId,
      durationMs: Date.now() - startedAt,
      error: getErrorMessage(error),
    });
    throw error;
  }
};

export const startPipeline = (fighterKey: string, prompt: string, correlationId?: string) =>
  withFighterLock(fighterKey, () => startPipelineImpl(fighterKey, prompt, correlationId));

export const generateSpecsheetFromCharacterDescription = (
  fighterKey: string,
  characterDescription: string,
  correlationId?: string,
) =>
  withFighterLock(fighterKey, () =>
    generateSpecsheetFromCharacterDescriptionImpl(fighterKey, characterDescription, correlationId),
  );

export const generateCharacterPfpFromCharacterDescription = (
  fighterKey: string,
  characterDescription?: string,
  correlationId?: string,
) =>
  withFighterLock(fighterKey, () =>
    generateCharacterPfpFromCharacterDescriptionImpl(
      fighterKey,
      characterDescription,
      correlationId,
    ),
  );

export const generateAgentCodeFromCharacterDescription = (
  fighterKey: string,
  characterDescription?: string,
  correlationId?: string,
) =>
  withFighterLock(fighterKey, () =>
    generateAgentCodeFromCharacterDescriptionImpl(fighterKey, characterDescription, correlationId),
  );

export const generateSpritesheetImageFromPrompt = (fighterKey: string, correlationId?: string) =>
  withFighterLock(fighterKey, () =>
    generateSpritesheetImageFromPromptImpl(fighterKey, correlationId),
  );

export const generateStrikecraftSpriteImageFromPrompt = (
  fighterKey: string,
  correlationId?: string,
) =>
  withFighterLock(fighterKey, () =>
    generateStrikecraftSpriteImageFromPromptImpl(fighterKey, correlationId),
  );

export const generateStrikecraftSpecsheetImageFromPrompt = (
  fighterKey: string,
  correlationId?: string,
) =>
  withFighterLock(fighterKey, () =>
    generateStrikecraftSpecsheetImageFromPromptImpl(fighterKey, correlationId),
  );

export const continuePipeline = (fighterKey: string, correlationId?: string) =>
  withFighterLock(fighterKey, () => continuePipelineImpl(fighterKey, correlationId));

export const refineSection = (
  fighterKey: string,
  sectionId: SectionId,
  message: string,
  history: ChatMessage[],
  correlationId?: string,
) =>
  withFighterLock(fighterKey, () =>
    refineSectionImpl(fighterKey, sectionId, message, history, correlationId),
  );

export const editSection = (
  fighterKey: string,
  sectionId: SectionId,
  content: string,
  correlationId?: string,
) =>
  withFighterLock(fighterKey, () => editSectionImpl(fighterKey, sectionId, content, correlationId));
