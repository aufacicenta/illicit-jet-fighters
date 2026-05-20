import { createHash } from "node:crypto";

import { clearPendingForFighter, sendToFighter } from "../ws/store";
import {
  createFighterAgentVersion,
  getNextFighterAgentVersionNumber,
} from "./agent-version-repository";
import { touchFighterUpdatedAt } from "./fighter-access";
import {
  generateAgentCode,
  generateCharacterDescription,
  generateCharacterDescriptionRefine,
  generateSpecsheetImage,
  generateSpecsheetPrompt,
  generateSpecsheetPromptRefine,
  generateSpritesheetImage,
  generateSpritesheetPrompt,
  generateStrikecraftSpecsheetImage,
  generateStrikecraftSpecsheetPrompt,
  generateStrikecraftSpriteImage,
  generateStrikecraftSpritePrompt,
} from "./generate";
import { decodeImagePayload, extensionForMime } from "./image-payload";
import { withFighterContext as withContext } from "./log-context";
import { logger } from "./logger";
import type { SectionStatus } from "./pipeline-status";
import { deriveSectionStatuses } from "./pipeline-status";
import {
  fighterAgentVersionScriptObjectKey,
  getObjectBuffer,
  getSignedReadUrl,
  pipelineStateObjectKey,
  putObject,
  specsheetObjectKey,
  spritesheetImageObjectKey,
  strikecraftSpecsheetObjectKey,
  strikecraftSpriteObjectKey,
} from "./r2";
import type { ChatMessage, SectionId, SectionOutput } from "./types";

export type PipelineTenant = {
  userId: string;
  fighterId: number;
};

type FighterPipelineState = {
  outputs: Partial<Record<SectionId, SectionOutput>>;
  histories: Partial<Record<SectionId, ChatMessage[]>>;
  activeSectionIds: SectionId[];
  lastErrorSectionId: SectionId | null;
  gateMessage: string | null;
};

type PersistedPipelineSnapshot = {
  version: 1;
  outputs: Partial<Record<SectionId, SectionOutput>>;
  histories: Partial<Record<SectionId, ChatMessage[]>>;
  activeSectionIds: SectionId[];
  activeSectionId?: SectionId | null;
  lastErrorSectionId: SectionId | null;
  gateMessage: string | null;
};

const PIPELINE_STORAGE_VERSION = 1 as const;
const stepOrder: SectionId[] = [
  "character-description",
  "specsheet-prompt",
  "specsheet-image",
  "spritesheet-prompt",
  "spritesheet-image",
  "agent-code",
  "strikecraft-specsheet-prompt",
  "strikecraft-specsheet-image",
  "strikecraft-sprite-prompt",
  "strikecraft-sprite-image",
];

const imageSections = new Set<SectionId>([
  "specsheet-image",
  "spritesheet-image",
  "strikecraft-specsheet-image",
  "strikecraft-sprite-image",
]);

const imageObjectKeyBuilders = {
  "specsheet-image": specsheetObjectKey,
  "spritesheet-image": spritesheetImageObjectKey,
  "strikecraft-specsheet-image": strikecraftSpecsheetObjectKey,
  "strikecraft-sprite-image": strikecraftSpriteObjectKey,
} as const;

const isImageSection = (sectionId: SectionId): sectionId is keyof typeof imageObjectKeyBuilders =>
  imageSections.has(sectionId);

const stateByFighter = new Map<string, FighterPipelineState>();
const tenantByFighter = new Map<string, PipelineTenant>();

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

const hashContent = (value: string) => createHash("sha256").update(value).digest("hex");

export const bindPipelineTenant = (fighterKey: string, tenant: PipelineTenant) => {
  tenantByFighter.set(fighterKey, tenant);
};

const requireTenant = (fighterKey: string): PipelineTenant => {
  const tenant = tenantByFighter.get(fighterKey);
  if (!tenant) {
    throw new Error("Pipeline session is missing authenticated fighter context.");
  }
  return tenant;
};

const stripOutputsForPersist = (
  outputs: Partial<Record<SectionId, SectionOutput>>,
): Partial<Record<SectionId, SectionOutput>> => {
  const next: Partial<Record<SectionId, SectionOutput>> = {};
  for (const sectionId of stepOrder) {
    const entry = outputs[sectionId];
    if (!entry) {
      continue;
    }
    const { assetUrl: _discard, ...rest } = entry;
    next[sectionId] = rest as SectionOutput;
  }
  return next;
};

const persistSnapshot = async (
  fighterKey: string,
  state: FighterPipelineState,
  tenant: PipelineTenant,
) => {
  try {
    const snapshot: PersistedPipelineSnapshot = {
      version: PIPELINE_STORAGE_VERSION,
      outputs: stripOutputsForPersist(state.outputs),
      histories: state.histories,
      activeSectionIds: state.activeSectionIds,
      activeSectionId: state.activeSectionIds[0] ?? null,
      lastErrorSectionId: state.lastErrorSectionId,
      gateMessage: state.gateMessage,
    };
    await putObject(
      pipelineStateObjectKey(tenant.userId, tenant.fighterId),
      Buffer.from(JSON.stringify(snapshot)),
      "application/json",
    );
    await touchFighterUpdatedAt(tenant.fighterId);
  } catch (error) {
    logger.warn("pipeline snapshot persist failed", {
      ...withContext(fighterKey),
      error: getErrorMessage(error),
    });
  }
};

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
  const contentHash = hashContent(code);
  const versionNumber = await getNextFighterAgentVersionNumber(tenant.fighterId);
  const objectKey = fighterAgentVersionScriptObjectKey(
    tenant.userId,
    tenant.fighterId,
    versionNumber,
  );
  await putObject(objectKey, Buffer.from(code), "application/typescript");
  const created = await createFighterAgentVersion({
    fighterId: tenant.fighterId,
    userId: tenant.userId,
    versionNumber,
    contentHash,
    objectKey,
    model,
  });

  logger.info("pipeline agent-code version persisted", {
    ...withContext(fighterKey, correlationId),
    fighterId: tenant.fighterId,
    versionNumber: created.versionNumber,
    contentHash,
    objectKey,
    model,
  });
};

const getState = (fighterKey: string, correlationId?: string): FighterPipelineState => {
  const current = stateByFighter.get(fighterKey);
  if (current) {
    logger.debug("pipeline state loaded", withContext(fighterKey, correlationId));
    return current;
  }

  const created: FighterPipelineState = {
    outputs: {},
    histories: {},
    activeSectionIds: [],
    lastErrorSectionId: null,
    gateMessage: null,
  };
  stateByFighter.set(fighterKey, created);
  logger.info("pipeline state created", withContext(fighterKey, correlationId));
  return created;
};

export const hydratePipelineFromBucket = async (
  fighterKey: string,
  tenant: PipelineTenant,
): Promise<boolean> => {
  const existing = stateByFighter.get(fighterKey);
  if (existing) {
    return true;
  }

  bindPipelineTenant(fighterKey, tenant);

  try {
    const raw = await getObjectBuffer(pipelineStateObjectKey(tenant.userId, tenant.fighterId));
    if (!raw) {
      return false;
    }

    const snapshot = JSON.parse(raw.toString()) as PersistedPipelineSnapshot;
    if (snapshot.version !== PIPELINE_STORAGE_VERSION || !snapshot.outputs) {
      return false;
    }

    const state = getState(fighterKey);
    state.outputs = snapshot.outputs ?? {};
    state.histories = snapshot.histories ?? {};
    state.activeSectionIds =
      snapshot.activeSectionIds ?? (snapshot.activeSectionId ? [snapshot.activeSectionId] : []);
    state.lastErrorSectionId = snapshot.lastErrorSectionId ?? null;
    state.gateMessage = snapshot.gateMessage ?? null;
    logger.info("pipeline hydrated from object storage", withContext(fighterKey));
    return true;
  } catch (error) {
    logger.warn("pipeline hydrate failed", {
      ...withContext(fighterKey),
      error: getErrorMessage(error),
    });
    return false;
  }
};

const sanitizeSectionOutput = async (
  sectionId: SectionId,
  output: SectionOutput,
): Promise<SectionOutput> => {
  if (!imageSections.has(sectionId)) {
    const { assetUrl: _discard, ...rest } = output;
    return rest;
  }

  if (output.content.startsWith("http://") || output.content.startsWith("https://")) {
    const { assetUrl: _discard, ...rest } = output;
    return { ...rest, assetUrl: output.content };
  }

  try {
    const signed = await getSignedReadUrl(output.content);
    const { assetUrl: _discard, ...rest } = output;
    return { ...rest, content: signed, assetUrl: signed };
  } catch {
    return output;
  }
};

const sanitizeOutputs = async (
  outputs: Partial<Record<SectionId, SectionOutput>>,
): Promise<Partial<Record<SectionId, SectionOutput>>> => {
  const next: Partial<Record<SectionId, SectionOutput>> = {};
  for (const sectionId of stepOrder) {
    const output = outputs[sectionId];
    if (!output) {
      continue;
    }
    next[sectionId] = await sanitizeSectionOutput(sectionId, output);
  }

  return next;
};

export type ClientPipelineStateSnapshot = {
  sectionStatuses: Record<SectionId, SectionStatus>;
  outputs: Partial<Record<SectionId, SectionOutput>>;
  histories: Partial<Record<SectionId, ChatMessage[]>>;
  gateMessage: string | null;
};

type FighterPipelinePreview = {
  characterDescription: string | null;
  specsheetPrompt: string | null;
  specsheetImageUrl: string | null;
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
    status,
  };
};

export const serializeClientPipelineState = async (
  fighterKey: string,
): Promise<ClientPipelineStateSnapshot | null> => {
  const tenant = tenantByFighter.get(fighterKey);
  if (!tenant) {
    return null;
  }

  let state = stateByFighter.get(fighterKey);

  if (!state) {
    await hydratePipelineFromBucket(fighterKey, tenant);
    state = stateByFighter.get(fighterKey);
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
    };
  }

  return {
    sectionStatuses: deriveSectionStatuses({
      outputs: state.outputs,
      activeSectionIds: state.activeSectionIds,
      lastErrorSectionId: state.lastErrorSectionId,
    }),
    outputs: await sanitizeOutputs(state.outputs),
    histories: state.histories,
    gateMessage: state.gateMessage,
  };
};

const nowIso = () => new Date().toISOString();

const setOutput = (
  fighterKey: string,
  sectionId: SectionId,
  content: string,
  model: string,
  mimeType?: string,
  correlationId?: string,
  assetUrl?: string,
): SectionOutput => {
  const output: SectionOutput = {
    sectionId,
    content,
    generatedAt: nowIso(),
    model,
    mimeType,
    ...(assetUrl ? { assetUrl } : {}),
  };

  const state = getState(fighterKey, correlationId);
  state.outputs[sectionId] = output;
  logger.debug("pipeline output stored", {
    ...withContext(fighterKey, correlationId),
    sectionId,
    model,
    mimeType,
    contentLength: content.length,
  });
  return output;
};

const setHistory = (
  fighterKey: string,
  sectionId: SectionId,
  history: ChatMessage[],
  correlationId?: string,
) => {
  const state = getState(fighterKey, correlationId);
  state.histories[sectionId] = history;
  logger.debug("pipeline history stored", {
    ...withContext(fighterKey, correlationId),
    sectionId,
    historyLength: history.length,
  });
};

const resetDownstream = (fighterKey: string, sectionId: SectionId, correlationId?: string) => {
  const state = getState(fighterKey, correlationId);
  const startIdx = stepOrder.indexOf(sectionId);
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

const buildSyncMessage = async (state: FighterPipelineState) => ({
  type: "pipeline:sync" as const,
  sectionStatuses: deriveSectionStatuses({
    outputs: state.outputs,
    activeSectionIds: state.activeSectionIds,
    lastErrorSectionId: state.lastErrorSectionId,
  }),
  outputs: await sanitizeOutputs(state.outputs),
  histories: state.histories,
  gateMessage: state.gateMessage,
});

export const syncPipelineState = async (fighterKey: string) => {
  const state = stateByFighter.get(fighterKey);
  if (!state) {
    return;
  }

  try {
    const tenant = tenantByFighter.get(fighterKey);
    if (tenant) {
      await persistSnapshot(fighterKey, state, tenant);
    }

    sendToFighter(fighterKey, await buildSyncMessage(state));
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
  error: unknown,
  correlationId?: string,
) => {
  const state = getState(fighterKey, correlationId);
  const errorMessage = error instanceof Error ? error.message : "Unknown pipeline error.";
  state.activeSectionIds = state.activeSectionIds.filter((id) => id !== sectionId);
  state.lastErrorSectionId = sectionId;
  sendToFighter(fighterKey, {
    type: "section:error",
    sectionId,
    error: errorMessage,
  });
};

const commitImageAsset = async ({
  fighterKey,
  mimeTypeHint,
  imageUrl,
  objectKeyBuilder,
}: {
  fighterKey: string;
  mimeTypeHint: string;
  imageUrl: string;
  objectKeyBuilder: (userId: string, fighterId: number, extension: string) => string;
}): Promise<{ objectKey: string; signedUrl: string }> => {
  const tenant = requireTenant(fighterKey);
  const { buffer, mimeType } = await decodeImagePayload(imageUrl, mimeTypeHint);
  const resolvedMime = mimeType || mimeTypeHint || "image/png";
  const extension = extensionForMime(resolvedMime);
  const objectKey = objectKeyBuilder(tenant.userId, tenant.fighterId, extension);
  await putObject(objectKey, buffer, resolvedMime);
  const signedUrl = await getSignedReadUrl(objectKey);
  return { objectKey, signedUrl };
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
    | "specsheet-prompt"
    | "spritesheet-prompt"
    | "agent-code"
    | "strikecraft-specsheet-prompt"
    | "strikecraft-sprite-prompt";
  input: string;
  correlationId?: string;
  generator: (input: string, onDelta?: (delta: string) => void) => Promise<TextSectionResult>;
}) => {
  const state = getState(fighterKey, correlationId);
  const tenant = tenantByFighter.get(fighterKey);
  const sectionStartedAt = Date.now();

  markSectionStarted(state, fighterKey, sectionId);
  const generated = await generator(input, (delta) =>
    emitSectionDelta(fighterKey, sectionId, delta),
  );

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
    | "specsheet-image"
    | "spritesheet-image"
    | "strikecraft-specsheet-image"
    | "strikecraft-sprite-image";
  prompt: string;
  correlationId?: string;
  startedAt?: number;
  objectKeyBuilder: (userId: string, fighterId: number, extension: string) => string;
  generator: (prompt: string) => Promise<{ imageBase64: string; mimeType: string; model: string }>;
  emitGateOnComplete?: boolean;
}) => {
  const tenant = tenantByFighter.get(fighterKey);
  const state = getState(fighterKey, correlationId);
  const imageStartedAt = Date.now();
  markSectionStarted(state, fighterKey, sectionId);

  const image = await generator(prompt);

  try {
    const { objectKey, signedUrl } = await commitImageAsset({
      fighterKey,
      imageUrl: image.imageBase64,
      mimeTypeHint: image.mimeType,
      objectKeyBuilder,
    });
    const output = setOutput(
      fighterKey,
      sectionId,
      objectKey,
      image.model,
      image.mimeType,
      correlationId,
      signedUrl,
    );
    await broadcastSectionComplete(fighterKey, sectionId, output);
    logger.info("pipeline section completed", {
      ...withContext(fighterKey, correlationId),
      sectionId,
      durationMs: Date.now() - imageStartedAt,
      model: image.model,
      mimeType: image.mimeType,
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
  } catch (error) {
    markSectionFinished(state, sectionId);
    emitSectionError(fighterKey, sectionId, error, correlationId);
    return;
  }
};

const runPhase2Pipeline = async (fighterKey: string, correlationId?: string) => {
  const state = getState(fighterKey, correlationId);
  const characterDescription = state.outputs["character-description"]?.content;
  if (!characterDescription) {
    throw new Error("Character description is required before continuing the pipeline.");
  }

  const [spritesheetPrompt, _agentCode, strikecraftSpecsheetPrompt] = await Promise.all([
    runTextSectionStep({
      fighterKey,
      sectionId: "spritesheet-prompt",
      input: characterDescription,
      correlationId,
      generator: async (input, onDelta) => {
        const generated = await generateSpritesheetPrompt(input, onDelta);
        return { content: generated.prompt, model: generated.model };
      },
    }),
    runTextSectionStep({
      fighterKey,
      sectionId: "agent-code",
      input: characterDescription,
      correlationId,
      generator: async (input, onDelta) => {
        const generated = await generateAgentCode(input, onDelta);
        return { content: generated.code, model: generated.model };
      },
    }),
    runTextSectionStep({
      fighterKey,
      sectionId: "strikecraft-specsheet-prompt",
      input: characterDescription,
      correlationId,
      generator: async (input, onDelta) => {
        const generated = await generateStrikecraftSpecsheetPrompt(input, onDelta);
        return { content: generated.prompt, model: generated.model };
      },
    }),
  ]);

  const [, , strikecraftSpritePrompt] = await Promise.all([
    runImageSectionStep({
      fighterKey,
      sectionId: "spritesheet-image",
      prompt: spritesheetPrompt.content,
      correlationId,
      objectKeyBuilder: spritesheetImageObjectKey,
      generator: generateSpritesheetImage,
    }),
    runImageSectionStep({
      fighterKey,
      sectionId: "strikecraft-specsheet-image",
      prompt: strikecraftSpecsheetPrompt.content,
      correlationId,
      objectKeyBuilder: strikecraftSpecsheetObjectKey,
      generator: generateStrikecraftSpecsheetImage,
    }),
    runTextSectionStep({
      fighterKey,
      sectionId: "strikecraft-sprite-prompt",
      input: strikecraftSpecsheetPrompt.content,
      correlationId,
      generator: async (input, onDelta) => {
        const generated = await generateStrikecraftSpritePrompt(input, onDelta);
        return { content: generated.prompt, model: generated.model };
      },
    }),
  ]);

  await runImageSectionStep({
    fighterKey,
    sectionId: "strikecraft-sprite-image",
    prompt: strikecraftSpritePrompt.content,
    correlationId,
    objectKeyBuilder: strikecraftSpriteObjectKey,
    generator: generateStrikecraftSpriteImage,
  });
};

export const startPipeline = async (fighterKey: string, prompt: string, correlationId?: string) => {
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

  const tenant = tenantByFighter.get(fighterKey);

  try {
    const character = await runTextSectionStep({
      fighterKey,
      sectionId: "character-description",
      input: prompt,
      correlationId,
      generator: async (input, onDelta) => {
        const generated = await generateCharacterDescription(input, onDelta);
        return { content: generated.markdown, model: generated.model };
      },
    });

    const specPrompt = await runTextSectionStep({
      fighterKey,
      sectionId: "specsheet-prompt",
      input: character.content,
      correlationId,
      generator: async (input, onDelta) => {
        const generated = await generateSpecsheetPrompt(input, onDelta);
        return { content: generated.prompt, model: generated.model };
      },
    });

    await runSpecsheetImageStep(fighterKey, specPrompt.content, correlationId, startedAt);
    if (tenant) {
      await syncPipelineState(fighterKey);
    }
  } catch (error) {
    logger.error("pipeline start failed", {
      ...withContext(fighterKey, correlationId),
      durationMs: Date.now() - startedAt,
      error: getErrorMessage(error),
    });
    emitSectionError(
      fighterKey,
      getState(fighterKey, correlationId).activeSectionIds[0] ?? "character-description",
      error,
      correlationId,
    );
  }
};

export const generateSpecsheetFromCharacterDescription = async (
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
  const tenant = tenantByFighter.get(fighterKey);

  try {
    const specPrompt = await runTextSectionStep({
      fighterKey,
      sectionId: "specsheet-prompt",
      input: characterDescription,
      correlationId,
      generator: async (input, onDelta) => {
        const generated = await generateSpecsheetPrompt(input, onDelta);
        return { content: generated.prompt, model: generated.model };
      },
    });

    await runSpecsheetImageStep(fighterKey, specPrompt.content, correlationId, startedAt);
    if (tenant) {
      await syncPipelineState(fighterKey);
    }
  } catch (error) {
    logger.error("pipeline specsheet generation failed", {
      ...withContext(fighterKey, correlationId),
      durationMs: Date.now() - startedAt,
      error: getErrorMessage(error),
    });
    emitSectionError(
      fighterKey,
      getState(fighterKey, correlationId).activeSectionIds[0] ?? "specsheet-prompt",
      error,
      correlationId,
    );
  }
};

export const generateAgentCodeFromCharacterDescription = async (
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
  const tenant = tenantByFighter.get(fighterKey);

  try {
    await runTextSectionStep({
      fighterKey,
      sectionId: "agent-code",
      input: resolvedCharacterDescription,
      correlationId,
      generator: async (input, onDelta) => {
        const generated = await generateAgentCode(input, onDelta);
        return { content: generated.code, model: generated.model };
      },
    });

    resetDownstream(fighterKey, "agent-code", correlationId);
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

export const continuePipeline = async (fighterKey: string, correlationId?: string) => {
  logger.info("pipeline continue requested", withContext(fighterKey, correlationId));
  requireTenant(fighterKey);
  const state = getState(fighterKey, correlationId);
  state.gateMessage = null;
  const tenant = tenantByFighter.get(fighterKey);
  if (tenant) {
    await persistSnapshot(fighterKey, state, tenant);
  }

  try {
    await runPhase2Pipeline(fighterKey, correlationId);
    sendToFighter(fighterKey, { type: "pipeline:complete" });
    logger.info("pipeline marked complete", withContext(fighterKey, correlationId));
  } catch (error) {
    logger.error("phase 2 pipeline failed", {
      ...withContext(fighterKey, correlationId),
      error: getErrorMessage(error),
    });
    emitSectionError(
      fighterKey,
      getState(fighterKey, correlationId).activeSectionIds[0] ?? "spritesheet-prompt",
      error,
      correlationId,
    );
  } finally {
    if (tenant) {
      await syncPipelineState(fighterKey);
    }
  }
};

export const refineSection = async (
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
  const tenant = tenantByFighter.get(fighterKey);
  markSectionStarted(state, fighterKey, sectionId);

  try {
    if (sectionId === "character-description") {
      const refined = await generateCharacterDescriptionRefine(history, message);
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

      logger.info("pipeline refine generated", {
        ...withContext(fighterKey, correlationId),
        sectionId,
        model: refined.model,
      });
    } else if (sectionId === "specsheet-prompt") {
      const refined = await generateSpecsheetPromptRefine(history, message);
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
      resetDownstream(fighterKey, sectionId, correlationId);
      await broadcastSectionComplete(fighterKey, sectionId, outputRecord);

      logger.info("pipeline refine generated", {
        ...withContext(fighterKey, correlationId),
        sectionId,
        model: refined.model,
      });
    } else if (sectionId === "specsheet-image") {
      const generated = await generateSpecsheetImage(message);
      const committed = await commitImageAsset({
        fighterKey,
        imageUrl: generated.imageBase64,
        mimeTypeHint: generated.mimeType,
        objectKeyBuilder: imageObjectKeyBuilders["specsheet-image"],
      });

      const outputRecord = setOutput(
        fighterKey,
        sectionId,
        committed.objectKey,
        generated.model,
        generated.mimeType,
        correlationId,
        committed.signedUrl,
      );
      resetDownstream(fighterKey, sectionId, correlationId);
      await broadcastSectionComplete(fighterKey, sectionId, outputRecord);
      logger.info("pipeline refine generated", {
        ...withContext(fighterKey, correlationId),
        sectionId,
        model: generated.model,
        mimeType: generated.mimeType,
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

export const editSection = async (
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

  const tenant = tenantByFighter.get(fighterKey);

  try {
    const previous = getState(fighterKey, correlationId).outputs[sectionId];
    const model = previous?.model ?? "manual-edit";
    const mimeType = previous?.mimeType;

    if (isImageSection(sectionId)) {
      const objectKeyBuilder = imageObjectKeyBuilders[sectionId];
      const committed = await commitImageAsset({
        fighterKey,
        imageUrl: content,
        mimeTypeHint: mimeType ?? "image/png",
        objectKeyBuilder,
      });
      const outputRecord = setOutput(
        fighterKey,
        sectionId,
        committed.objectKey,
        model,
        mimeType ?? "image/png",
        correlationId,
        committed.signedUrl,
      );
      resetDownstream(fighterKey, sectionId, correlationId);
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
      resetDownstream(fighterKey, sectionId, correlationId);
      await broadcastSectionComplete(fighterKey, sectionId, outputRecord);
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
