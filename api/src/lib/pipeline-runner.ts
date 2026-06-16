import { createHash } from "node:crypto";

import {
  didInferMissingPromptOutputs,
  FIGHTER_PIPELINE_SECTION_ORDER,
  hasPersistedPromptContent,
  inferMissingPromptOutputsFromAssets,
} from "@ijf/shared";
import { parseFighterNameAndEpithet } from "@ijf/shared";

import { clearPendingForFighter, sendToFighter, sendToUser } from "../ws/store";
import {
  createFighterAgentVersion,
  getNextFighterAgentVersionNumber,
} from "./agent-version-repository";
import { getFighterBriefing, saveFighterName, touchFighterUpdatedAt } from "./fighter-access";
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
import { decodeImagePayload } from "./image-payload";
import { getImageDimensions, normalizeForStoragePng } from "./image-processing";
import { withFighterContext as withContext } from "./log-context";
import { logger } from "./logger";
import type { SectionStatus } from "./pipeline-status";
import { deriveSectionStatuses } from "./pipeline-status";
import {
  characterPfpObjectKey,
  fighterAgentVersionScriptObjectKey,
  getObjectBuffer,
  getSignedReadUrl,
  objectExists,
  pipelineStateObjectKey,
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
const stepOrder: SectionId[] = FIGHTER_PIPELINE_SECTION_ORDER;

const imageSections = new Set<SectionId>([
  "character-pfp-image",
  "specsheet-image",
  "spritesheet-image",
  "strikecraft-specsheet-image",
  "strikecraft-sprite-image",
]);

const assetBackedSections = new Set<SectionId>([...imageSections, "spritesheet-manifest"]);

const imageObjectKeyBuilders = {
  "character-pfp-image": characterPfpObjectKey,
  "specsheet-image": specsheetObjectKey,
  "spritesheet-image": spritesheetImageObjectKey,
  "strikecraft-specsheet-image": strikecraftSpecsheetObjectKey,
  "strikecraft-sprite-image": strikecraftSpriteObjectKey,
} as const;

const isImageSection = (sectionId: SectionId): sectionId is keyof typeof imageObjectKeyBuilders =>
  imageSections.has(sectionId);

const getCanonicalAssetObjectKey = (
  sectionId: SectionId,
  tenant: PipelineTenant,
): string | null => {
  if (sectionId === "spritesheet-manifest") {
    return spritesheetManifestObjectKey(tenant.userId, tenant.fighterId);
  }
  if (isImageSection(sectionId)) {
    return imageObjectKeyBuilders[sectionId](tenant.userId, tenant.fighterId, "png");
  }
  return null;
};

const getAssetSectionMimeType = (sectionId: SectionId): string | undefined => {
  if (sectionId === "spritesheet-manifest") {
    return "application/json";
  }
  if (isImageSection(sectionId)) {
    return "image/png";
  }
  return undefined;
};

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
  if (!assetBackedSections.has(sectionId)) {
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

const reconcileAssetBackedOutputs = async ({
  outputs,
  tenant,
}: {
  outputs: Partial<Record<SectionId, SectionOutput>>;
  tenant: PipelineTenant;
}): Promise<Partial<Record<SectionId, SectionOutput>>> => {
  const reconciled: Partial<Record<SectionId, SectionOutput>> = { ...outputs };

  for (const sectionId of stepOrder) {
    if (!assetBackedSections.has(sectionId)) {
      continue;
    }

    const currentOutput = reconciled[sectionId];
    const candidateKeys: string[] = [];
    if (currentOutput?.content && !currentOutput.content.startsWith("http")) {
      candidateKeys.push(currentOutput.content);
    }

    const canonicalKey = getCanonicalAssetObjectKey(sectionId, tenant);
    if (canonicalKey && !candidateKeys.includes(canonicalKey)) {
      candidateKeys.push(canonicalKey);
    }

    let resolvedObjectKey: string | null = null;
    for (const key of candidateKeys) {
      if (await objectExists(key)) {
        resolvedObjectKey = key;
        break;
      }
    }

    if (!resolvedObjectKey) {
      delete reconciled[sectionId];
      continue;
    }

    reconciled[sectionId] = {
      sectionId,
      content: resolvedObjectKey,
      generatedAt: currentOutput?.generatedAt ?? new Date().toISOString(),
      model: currentOutput?.model ?? "storage-recovered",
      mimeType: currentOutput?.mimeType ?? getAssetSectionMimeType(sectionId),
    };
  }

  return reconciled;
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
  const tenant = tenantByFighter.get(fighterKey);
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
  const tenant = tenantByFighter.get(fighterKey);
  if (!tenant) {
    return null;
  }

  let state = stateByFighter.get(fighterKey);
  if (!state) {
    await hydratePipelineFromBucket(fighterKey, tenant);
    state = stateByFighter.get(fighterKey);
  }

  return deriveSectionStatuses({
    outputs: state?.outputs ?? {},
    activeSectionIds: state?.activeSectionIds ?? [],
    lastErrorSectionId: state?.lastErrorSectionId ?? null,
  });
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
  const state = stateByFighter.get(fighterKey);
  if (!state) {
    return;
  }

  try {
    const tenant = tenantByFighter.get(fighterKey);
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
  error: unknown,
  correlationId?: string,
) => {
  const state = getState(fighterKey, correlationId);
  const errorMessage = error instanceof Error ? error.message : "Unknown pipeline error.";
  state.activeSectionIds = state.activeSectionIds.filter((id) => id !== sectionId);
  state.lastErrorSectionId = sectionId;
  if (error instanceof InsufficientBalanceError) {
    const tenant = tenantByFighter.get(fighterKey);
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
    if (tenant) {
      sendToUser(tenant.userId, {
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

const commitImageAsset = async ({
  fighterKey,
  sectionId,
  mimeTypeHint,
  imageUrl,
  objectKeyBuilder,
  requireTransparentBackground,
}: {
  fighterKey: string;
  sectionId: SectionId;
  mimeTypeHint: string;
  imageUrl: string;
  objectKeyBuilder: (userId: string, fighterId: number, extension: string) => string;
  requireTransparentBackground: boolean;
}): Promise<{ objectKey: string; signedUrl: string; width: number; height: number }> => {
  const tenant = requireTenant(fighterKey);
  const { buffer } = await decodeImagePayload(imageUrl, mimeTypeHint);
  const normalized = await normalizeForStoragePng({
    sourceBuffer: buffer,
    sectionLabel: sectionId,
    requireTransparentBackground,
  });
  const extension = "png";
  const objectKey = objectKeyBuilder(tenant.userId, tenant.fighterId, extension);
  await putObject(objectKey, normalized.buffer, normalized.mimeType);
  const signedUrl = await getSignedReadUrl(objectKey);
  const { width, height } = await getImageDimensions(normalized.buffer);
  return { objectKey, signedUrl, width, height };
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
  const tenant = tenantByFighter.get(fighterKey);
  const sectionStartedAt = Date.now();
  const llmCallContext = buildLlmCallContext({ tenant, sectionId, correlationId });
  if (tenant) {
    await requirePreflightBalance({ userId: tenant.userId, sectionId });
  }

  markSectionStarted(state, fighterKey, sectionId);
  const generated = await generator(
    input,
    (delta) => emitSectionDelta(fighterKey, sectionId, delta),
    llmCallContext,
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
  const tenant = tenantByFighter.get(fighterKey);
  const state = getState(fighterKey, correlationId);
  const imageStartedAt = Date.now();
  const llmCallContext = buildLlmCallContext({ tenant, sectionId, correlationId });
  const requireTransparentBackground = sectionId === "strikecraft-sprite-image";
  const maxAttempts = requireTransparentBackground ? 2 : 1;
  if (tenant) {
    await requirePreflightBalance({ userId: tenant.userId, sectionId });
  }
  markSectionStarted(state, fighterKey, sectionId);

  try {
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
          fighterKey,
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
  await requirePreflightBalance({ userId: tenant.userId, sectionId });
  markSectionStarted(state, fighterKey, sectionId);

  try {
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

  const [spritesheetPrompt, _agentCode, strikecraftSpecsheetPrompt] = await Promise.all([
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
  ]);

  const [spritesheetImageResult, , strikecraftSpritePrompt] = await Promise.all([
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
      generator: async (input, onDelta, context) => {
        const generated = await generateStrikecraftSpritePrompt(input, onDelta, context);
        return { content: generated.prompt, model: generated.model };
      },
    }),
  ]);

  if (!spritesheetImageResult) {
    throw new Error("Spritesheet image generation failed.");
  }

  await runSpritesheetManifestStep({
    fighterKey,
    imageUrl: spritesheetImageResult.signedUrl,
    sheetWidth: spritesheetImageResult.width,
    sheetHeight: spritesheetImageResult.height,
    correlationId,
    modelHint: spritesheetImageResult.model,
  });

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

export const generateCharacterPfpFromCharacterDescription = async (
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
  const tenant = tenantByFighter.get(fighterKey);

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
    logger.error("pipeline character-pfp generation failed", {
      ...withContext(fighterKey, correlationId),
      durationMs: Date.now() - startedAt,
      error: getErrorMessage(error),
    });
    emitSectionError(
      fighterKey,
      getState(fighterKey, correlationId).activeSectionIds[0] ?? "character-pfp-prompt",
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

export const generateSpritesheetImageFromPrompt = async (
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
  const tenant = tenantByFighter.get(fighterKey);

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

export const generateStrikecraftSpriteImageFromPrompt = async (
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
  const tenant = tenantByFighter.get(fighterKey);

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

export const generateStrikecraftSpecsheetImageFromPrompt = async (
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
  const tenant = tenantByFighter.get(fighterKey);

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
  const tenant = tenantByFighter.get(fighterKey);
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

  const needsSpecsheet =
    !state.outputs["specsheet-prompt"]?.content || !state.outputs["specsheet-image"]?.content;
  const needsPfp =
    !state.outputs["character-pfp-prompt"]?.content ||
    !state.outputs["character-pfp-image"]?.content;

  const tasks: Promise<unknown>[] = [];

  if (needsSpecsheet) {
    tasks.push(
      (async () => {
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
        await runSpecsheetImageStep(fighterKey, specPrompt.content, correlationId);
      })(),
    );
  }

  if (needsPfp) {
    tasks.push(
      runCharacterPfpFromCharacterDescription(fighterKey, characterDescription, correlationId),
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
    if (!isPhaseOneComplete(state)) {
      await resumePhaseOne(fighterKey, correlationId);
      if (tenant) {
        await syncPipelineState(fighterKey);
      }
      return;
    }

    await runPhase2Pipeline(fighterKey, correlationId);
    sendToFighter(fighterKey, { type: "pipeline:complete" });
    logger.info("pipeline marked complete", withContext(fighterKey, correlationId));
  } catch (error) {
    logger.error("pipeline continue failed", {
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
        fighterKey,
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

export const clearPipelineStateForFighter = (fighterKey: string) => {
  clearPendingForFighter(fighterKey);
  stateByFighter.delete(fighterKey);
  tenantByFighter.delete(fighterKey);
};
