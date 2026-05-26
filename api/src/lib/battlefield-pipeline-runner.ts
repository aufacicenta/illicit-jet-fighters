import sharp from "sharp";

import { clearPendingForBattlefield, sendToBattlefield, sendToUser } from "../ws/store";
import {
  getVerifiedUsageBillingSections,
  saveBattlefieldName,
  touchBattlefieldUpdatedAt,
} from "./battlefield-access";
import type { LlmCallContext } from "./generate";
import {
  generateBattlefieldConfig,
  generateBattlefieldDescription,
  generateBattlefieldSheetImage,
  generateBattlefieldSheetPrompt,
} from "./generate";
import { decodeImagePayload } from "./image-payload";
import { withFighterContext as withContext } from "./log-context";
import { logger } from "./logger";
import {
  battlefieldConfigObjectKey,
  battlefieldDescriptionObjectKey,
  battlefieldPipelineStateObjectKey,
  battlefieldSheetImageObjectKey,
  battlefieldSheetPromptObjectKey,
  getObjectBuffer,
  getSignedReadUrl,
  objectExists,
  putObject,
} from "./r2";
import type { BattlefieldSectionId, ChatMessage, SectionOutput } from "./types";
import { InsufficientBalanceError, requirePreflightBalance } from "./wallet";

export type BattlefieldPipelineTenant = {
  userId: string;
  battlefieldId: number;
};

type BattlefieldPipelineStatus = "locked" | "ready" | "generating" | "complete" | "error";

type BattlefieldPipelineState = {
  outputs: Partial<Record<BattlefieldSectionId, SectionOutput>>;
  histories: Partial<Record<BattlefieldSectionId, ChatMessage[]>>;
  activeSectionIds: BattlefieldSectionId[];
  lastErrorSectionId: BattlefieldSectionId | null;
  gateMessage: string | null;
};

type PersistedBattlefieldPipelineSnapshot = {
  version: 1;
  outputs: Partial<Record<BattlefieldSectionId, SectionOutput>>;
  histories: Partial<Record<BattlefieldSectionId, ChatMessage[]>>;
  activeSectionIds: BattlefieldSectionId[];
  activeSectionId?: BattlefieldSectionId | null;
  lastErrorSectionId: BattlefieldSectionId | null;
  gateMessage: string | null;
};

export type ClientBattlefieldPipelineStateSnapshot = {
  sectionStatuses: Record<BattlefieldSectionId, BattlefieldPipelineStatus>;
  outputs: Partial<Record<BattlefieldSectionId, SectionOutput>>;
  histories: Partial<Record<BattlefieldSectionId, ChatMessage[]>>;
  gateMessage: string | null;
};

const PIPELINE_STORAGE_VERSION = 1 as const;
const stepOrder: BattlefieldSectionId[] = [
  "battlefield-description",
  "battlefield-sheet-prompt",
  "battlefield-sheet-image",
  "battlefield-config",
];
const imageSections = new Set<BattlefieldSectionId>(["battlefield-sheet-image"]);

const stateByBattlefield = new Map<string, BattlefieldPipelineState>();
const tenantByBattlefield = new Map<string, BattlefieldPipelineTenant>();

const nowIso = () => new Date().toISOString();

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

const deriveSectionStatuses = ({
  outputs,
  activeSectionIds,
  lastErrorSectionId,
}: {
  outputs: Partial<Record<BattlefieldSectionId, SectionOutput>>;
  activeSectionIds: BattlefieldSectionId[];
  lastErrorSectionId: BattlefieldSectionId | null;
}): Record<BattlefieldSectionId, BattlefieldPipelineStatus> => {
  const statuses: Record<BattlefieldSectionId, BattlefieldPipelineStatus> = {
    "battlefield-description": "ready",
    "battlefield-sheet-prompt": "locked",
    "battlefield-sheet-image": "locked",
    "battlefield-config": "locked",
  };

  for (const sectionId of stepOrder) {
    if (outputs[sectionId]) {
      statuses[sectionId] = "complete";
    }
  }

  for (let index = 0; index < stepOrder.length - 1; index += 1) {
    const current = stepOrder[index]!;
    const next = stepOrder[index + 1]!;
    if (statuses[current] === "complete" && statuses[next] === "locked") {
      statuses[next] = "ready";
    }
  }

  for (const activeSectionId of activeSectionIds) {
    statuses[activeSectionId] = "generating";
  }

  if (lastErrorSectionId) {
    statuses[lastErrorSectionId] = "error";
  }

  return statuses;
};

const getState = (battlefieldKey: string, correlationId?: string): BattlefieldPipelineState => {
  const current = stateByBattlefield.get(battlefieldKey);
  if (current) {
    logger.debug("battlefield pipeline state loaded", withContext(battlefieldKey, correlationId));
    return current;
  }

  const created: BattlefieldPipelineState = {
    outputs: {},
    histories: {},
    activeSectionIds: [],
    lastErrorSectionId: null,
    gateMessage: null,
  };
  stateByBattlefield.set(battlefieldKey, created);
  logger.info("battlefield pipeline state created", withContext(battlefieldKey, correlationId));
  return created;
};

export const bindBattlefieldPipelineTenant = (
  battlefieldKey: string,
  tenant: BattlefieldPipelineTenant,
) => {
  tenantByBattlefield.set(battlefieldKey, tenant);
};

const requireTenant = (battlefieldKey: string): BattlefieldPipelineTenant => {
  const tenant = tenantByBattlefield.get(battlefieldKey);
  if (!tenant) {
    throw new Error("Pipeline session is missing authenticated battlefield context.");
  }
  return tenant;
};

const setOutput = (
  battlefieldKey: string,
  sectionId: BattlefieldSectionId,
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

  const state = getState(battlefieldKey, correlationId);
  state.outputs[sectionId] = output;
  return output;
};

const setHistory = (
  battlefieldKey: string,
  sectionId: BattlefieldSectionId,
  history: ChatMessage[],
  correlationId?: string,
) => {
  const state = getState(battlefieldKey, correlationId);
  state.histories[sectionId] = history;
};

const markSectionStarted = (
  state: BattlefieldPipelineState,
  battlefieldKey: string,
  sectionId: BattlefieldSectionId,
) => {
  if (!state.activeSectionIds.includes(sectionId)) {
    state.activeSectionIds.push(sectionId);
  }
  state.lastErrorSectionId = null;
  sendToBattlefield(battlefieldKey, { type: "section:start", sectionId });
};

const markSectionFinished = (state: BattlefieldPipelineState, sectionId: BattlefieldSectionId) => {
  state.activeSectionIds = state.activeSectionIds.filter((id) => id !== sectionId);
};

const emitSectionDelta = (
  battlefieldKey: string,
  sectionId: BattlefieldSectionId,
  delta: string,
) => {
  if (!delta) {
    return;
  }
  sendToBattlefield(battlefieldKey, {
    type: "section:delta",
    sectionId,
    delta,
  });
};

const sanitizeSectionOutput = async (
  sectionId: BattlefieldSectionId,
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
  outputs: Partial<Record<BattlefieldSectionId, SectionOutput>>,
): Promise<Partial<Record<BattlefieldSectionId, SectionOutput>>> => {
  const next: Partial<Record<BattlefieldSectionId, SectionOutput>> = {};
  for (const sectionId of stepOrder) {
    const output = outputs[sectionId];
    if (!output) {
      continue;
    }
    next[sectionId] = await sanitizeSectionOutput(sectionId, output);
  }
  return next;
};

const resolveBattlefieldSectionAssetObjectKey = (
  tenant: BattlefieldPipelineTenant,
  sectionId: BattlefieldSectionId,
) => {
  if (sectionId === "battlefield-description") {
    return battlefieldDescriptionObjectKey(tenant.userId, tenant.battlefieldId);
  }
  if (sectionId === "battlefield-sheet-prompt") {
    return battlefieldSheetPromptObjectKey(tenant.userId, tenant.battlefieldId);
  }
  if (sectionId === "battlefield-sheet-image") {
    return battlefieldSheetImageObjectKey(tenant.userId, tenant.battlefieldId);
  }
  return battlefieldConfigObjectKey(tenant.userId, tenant.battlefieldId);
};

const getVerifiedBillingSections = async (
  tenant: BattlefieldPipelineTenant,
): Promise<Set<BattlefieldSectionId>> => {
  const verifiedSections = await getVerifiedUsageBillingSections({
    userId: tenant.userId,
    battlefieldId: tenant.battlefieldId,
    sectionIds: stepOrder,
  });
  return new Set(Array.from(verifiedSections, (sectionId) => sectionId as BattlefieldSectionId));
};

const reconcileOutputsWithSectionProofs = async ({
  battlefieldKey,
  tenant,
  outputs,
  activeSectionIds,
}: {
  battlefieldKey: string;
  tenant: BattlefieldPipelineTenant;
  outputs: Partial<Record<BattlefieldSectionId, SectionOutput>>;
  activeSectionIds: BattlefieldSectionId[];
}): Promise<Partial<Record<BattlefieldSectionId, SectionOutput>>> => {
  const verifiedBillingSections = await getVerifiedBillingSections(tenant);
  const reconciled = { ...outputs };

  for (const sectionId of stepOrder) {
    if (activeSectionIds.includes(sectionId)) {
      continue;
    }

    const hasOutput = Boolean(reconciled[sectionId]);
    const hasAsset = await objectExists(resolveBattlefieldSectionAssetObjectKey(tenant, sectionId));
    const hasUsageBilling = verifiedBillingSections.has(sectionId);
    const isVerified = hasAsset && hasUsageBilling;

    if (!isVerified && hasOutput) {
      delete reconciled[sectionId];
      logger.warn("battlefield section output removed due to missing source-of-truth artifacts", {
        ...withContext(battlefieldKey),
        sectionId,
        hasAsset,
        hasUsageBilling,
      });
    }
  }

  return reconciled;
};

const buildSyncMessage = async (state: BattlefieldPipelineState) => ({
  type: "pipeline:sync" as const,
  sectionStatuses: deriveSectionStatuses({
    outputs: state.outputs,
    activeSectionIds: state.activeSectionIds,
    lastErrorSectionId: state.lastErrorSectionId,
  }),
  outputs: await sanitizeOutputs(state.outputs),
  histories: state.histories,
  gateMessage: state.gateMessage,
  fighterLedger: {
    isReady: false,
    balanceNative: "0",
  },
});

const persistSnapshot = async (
  battlefieldKey: string,
  state: BattlefieldPipelineState,
  tenant: BattlefieldPipelineTenant,
) => {
  try {
    const snapshot: PersistedBattlefieldPipelineSnapshot = {
      version: PIPELINE_STORAGE_VERSION,
      outputs: state.outputs,
      histories: state.histories,
      activeSectionIds: state.activeSectionIds,
      activeSectionId: state.activeSectionIds[0] ?? null,
      lastErrorSectionId: state.lastErrorSectionId,
      gateMessage: state.gateMessage,
    };
    await putObject(
      battlefieldPipelineStateObjectKey(tenant.userId, tenant.battlefieldId),
      Buffer.from(JSON.stringify(snapshot)),
      "application/json",
    );
    await touchBattlefieldUpdatedAt(tenant.battlefieldId);
  } catch (error) {
    logger.warn("battlefield pipeline snapshot persist failed", {
      ...withContext(battlefieldKey),
      error: getErrorMessage(error),
    });
  }
};

const parseBattlefieldName = (markdown: string): string | null => {
  const trimmed = markdown.trim();
  if (!trimmed) {
    return null;
  }

  const headingMatch = trimmed.match(/^#\s+(.+)$/m);
  const fallbackMatch = trimmed.match(/^([^\n]{3,80})$/m);
  const candidate = headingMatch?.[1] ?? fallbackMatch?.[1] ?? null;
  if (!candidate) {
    return null;
  }

  const normalized = candidate.trim().replace(/^"+|"+$/g, "");
  return normalized.length > 0 ? normalized.slice(0, 120) : null;
};

const syncBattlefieldNameFromDescription = async ({
  tenant,
  markdown,
}: {
  tenant: BattlefieldPipelineTenant;
  markdown: string;
}) => {
  await saveBattlefieldName(tenant.battlefieldId, parseBattlefieldName(markdown));
};

const buildLlmCallContext = ({
  tenant,
  sectionId,
  correlationId,
}: {
  tenant?: BattlefieldPipelineTenant;
  sectionId: BattlefieldSectionId;
  correlationId?: string;
}): LlmCallContext | undefined => {
  if (!tenant) {
    return undefined;
  }

  return {
    userId: tenant.userId,
    battlefieldId: tenant.battlefieldId,
    sectionId,
    correlationId,
  };
};

const emitSectionError = (
  battlefieldKey: string,
  sectionId: BattlefieldSectionId,
  error: unknown,
  correlationId?: string,
) => {
  const state = getState(battlefieldKey, correlationId);
  const errorMessage = error instanceof Error ? error.message : "Unknown pipeline error.";
  state.activeSectionIds = state.activeSectionIds.filter((id) => id !== sectionId);
  state.lastErrorSectionId = sectionId;

  if (error instanceof InsufficientBalanceError) {
    const tenant = tenantByBattlefield.get(battlefieldKey);
    sendToBattlefield(battlefieldKey, {
      type: "wallet:insufficient-balance",
      sectionId,
      requiredNative: error.requiredNative.toString(),
      balanceNative: error.balanceNative.toString(),
    });
    sendToBattlefield(battlefieldKey, {
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

  sendToBattlefield(battlefieldKey, {
    type: "section:error",
    sectionId,
    error: errorMessage,
  });
};

const saveTextAsset = async (
  tenant: BattlefieldPipelineTenant,
  sectionId: BattlefieldSectionId,
  content: string,
) => {
  if (sectionId === "battlefield-description") {
    await putObject(
      battlefieldDescriptionObjectKey(tenant.userId, tenant.battlefieldId),
      Buffer.from(content),
      "text/markdown",
    );
    return;
  }
  if (sectionId === "battlefield-sheet-prompt") {
    await putObject(
      battlefieldSheetPromptObjectKey(tenant.userId, tenant.battlefieldId),
      Buffer.from(content),
      "text/markdown",
    );
    return;
  }
  if (sectionId === "battlefield-config") {
    await putObject(
      battlefieldConfigObjectKey(tenant.userId, tenant.battlefieldId),
      Buffer.from(content),
      "application/json",
    );
  }
};

const runTextSectionStep = async ({
  battlefieldKey,
  sectionId,
  input,
  correlationId,
  generator,
}: {
  battlefieldKey: string;
  sectionId: "battlefield-description" | "battlefield-sheet-prompt" | "battlefield-config";
  input: string;
  correlationId?: string;
  generator: (
    input: string,
    onDelta?: (delta: string) => void,
    context?: LlmCallContext,
  ) => Promise<{ content: string; model: string }>;
}) => {
  const state = getState(battlefieldKey, correlationId);
  const tenant = tenantByBattlefield.get(battlefieldKey);
  if (tenant) {
    await requirePreflightBalance({ userId: tenant.userId, sectionId });
  }

  markSectionStarted(state, battlefieldKey, sectionId);
  const generated = await generator(
    input,
    (delta) => emitSectionDelta(battlefieldKey, sectionId, delta),
    buildLlmCallContext({ tenant, sectionId, correlationId }),
  );
  const output = setOutput(
    battlefieldKey,
    sectionId,
    generated.content,
    generated.model,
    undefined,
    correlationId,
  );
  if (tenant) {
    await saveTextAsset(tenant, sectionId, generated.content);
  }
  sendToBattlefield(battlefieldKey, {
    type: "section:complete",
    sectionId,
    output: await sanitizeSectionOutput(sectionId, output),
  });
  setHistory(
    battlefieldKey,
    sectionId,
    [
      { role: "user", content: input },
      { role: "assistant", content: generated.content },
    ],
    correlationId,
  );
  markSectionFinished(state, sectionId);
  if (sectionId === "battlefield-description" && tenant) {
    await syncBattlefieldNameFromDescription({ tenant, markdown: generated.content });
  }
  if (tenant) {
    await persistSnapshot(battlefieldKey, state, tenant);
  }
  return generated;
};

const runBattlefieldSheetImageStep = async (
  battlefieldKey: string,
  prompt: string,
  correlationId?: string,
) => {
  const state = getState(battlefieldKey, correlationId);
  const tenant = requireTenant(battlefieldKey);
  const sectionId: BattlefieldSectionId = "battlefield-sheet-image";
  await requirePreflightBalance({ userId: tenant.userId, sectionId });
  markSectionStarted(state, battlefieldKey, sectionId);

  try {
    const generated = await generateBattlefieldSheetImage(
      prompt,
      buildLlmCallContext({ tenant, sectionId, correlationId }),
    );
    const { buffer } = await decodeImagePayload(generated.imageBase64, generated.mimeType);
    const jpegBuffer = await sharp(buffer, { failOn: "none" }).jpeg({ quality: 92 }).toBuffer();
    const objectKey = battlefieldSheetImageObjectKey(tenant.userId, tenant.battlefieldId);
    await putObject(objectKey, jpegBuffer, "image/jpeg");
    const signedUrl = await getSignedReadUrl(objectKey);
    const output = setOutput(
      battlefieldKey,
      sectionId,
      objectKey,
      generated.model,
      "image/jpeg",
      correlationId,
      signedUrl,
    );
    sendToBattlefield(battlefieldKey, {
      type: "section:complete",
      sectionId,
      output: await sanitizeSectionOutput(sectionId, output),
    });
    markSectionFinished(state, sectionId);
    await persistSnapshot(battlefieldKey, state, tenant);
    return generated;
  } catch (error) {
    markSectionFinished(state, sectionId);
    emitSectionError(battlefieldKey, sectionId, error, correlationId);
    return null;
  }
};

const runPhaseTwoPipeline = async (battlefieldKey: string, correlationId?: string) => {
  const state = getState(battlefieldKey, correlationId);
  const description = state.outputs["battlefield-description"]?.content?.trim();
  if (!description) {
    throw new Error("Battlefield description is required before continuing the pipeline.");
  }

  const sheetPrompt = await runTextSectionStep({
    battlefieldKey,
    sectionId: "battlefield-sheet-prompt",
    input: description,
    correlationId,
    generator: async (input, onDelta, context) => {
      const generated = await generateBattlefieldSheetPrompt(input, onDelta, context);
      return { content: generated.prompt, model: generated.model };
    },
  });

  const image = await runBattlefieldSheetImageStep(
    battlefieldKey,
    sheetPrompt.content,
    correlationId,
  );
  if (!image) {
    throw new Error("Battlefield sheet image generation failed.");
  }

  await runTextSectionStep({
    battlefieldKey,
    sectionId: "battlefield-config",
    input: description,
    correlationId,
    generator: async (input, onDelta, context) => {
      const generated = await generateBattlefieldConfig(input, onDelta, context);
      return { content: generated.config, model: generated.model };
    },
  });
};

export const startBattlefieldPipeline = async (
  battlefieldKey: string,
  prompt: string,
  correlationId?: string,
) => {
  requireTenant(battlefieldKey);
  clearPendingForBattlefield(battlefieldKey);

  const state = getState(battlefieldKey, correlationId);
  state.outputs = {};
  state.histories = {};
  state.activeSectionIds = [];
  state.lastErrorSectionId = null;
  state.gateMessage = null;
  const tenant = tenantByBattlefield.get(battlefieldKey);

  try {
    await runTextSectionStep({
      battlefieldKey,
      sectionId: "battlefield-description",
      input: prompt,
      correlationId,
      generator: async (input, onDelta, context) => {
        const generated = await generateBattlefieldDescription(input, onDelta, context);
        return { content: generated.markdown, model: generated.model };
      },
    });
    state.gateMessage = "Review description and continue to generate battlefield assets";
    sendToBattlefield(battlefieldKey, {
      type: "pipeline:gate",
      sectionId: "battlefield-description",
      message: state.gateMessage,
    });
    if (tenant) {
      await persistSnapshot(battlefieldKey, state, tenant);
    }
  } catch (error) {
    emitSectionError(battlefieldKey, "battlefield-description", error, correlationId);
  }
};

export const continueBattlefieldPipeline = async (
  battlefieldKey: string,
  correlationId?: string,
) => {
  requireTenant(battlefieldKey);
  const state = getState(battlefieldKey, correlationId);
  state.gateMessage = null;
  const tenant = tenantByBattlefield.get(battlefieldKey);
  if (tenant) {
    await persistSnapshot(battlefieldKey, state, tenant);
  }

  try {
    await runPhaseTwoPipeline(battlefieldKey, correlationId);
    sendToBattlefield(battlefieldKey, { type: "pipeline:complete" });
  } catch (error) {
    emitSectionError(
      battlefieldKey,
      getState(battlefieldKey, correlationId).activeSectionIds[0] ?? "battlefield-sheet-prompt",
      error,
      correlationId,
    );
  } finally {
    await syncBattlefieldPipelineState(battlefieldKey);
  }
};

export const generateBattlefieldSheetFromDescription = async (
  battlefieldKey: string,
  correlationId?: string,
) => {
  requireTenant(battlefieldKey);
  const state = getState(battlefieldKey, correlationId);
  const description = state.outputs["battlefield-description"]?.content?.trim();
  if (!description) {
    emitSectionError(
      battlefieldKey,
      "battlefield-sheet-prompt",
      new Error("Battlefield description is required before regenerating sheet."),
      correlationId,
    );
    return;
  }

  try {
    const sheetPrompt = await runTextSectionStep({
      battlefieldKey,
      sectionId: "battlefield-sheet-prompt",
      input: description,
      correlationId,
      generator: async (input, onDelta, context) => {
        const generated = await generateBattlefieldSheetPrompt(input, onDelta, context);
        return { content: generated.prompt, model: generated.model };
      },
    });
    await runBattlefieldSheetImageStep(battlefieldKey, sheetPrompt.content, correlationId);
  } finally {
    await syncBattlefieldPipelineState(battlefieldKey);
  }
};

export const generateBattlefieldConfigFromDescription = async (
  battlefieldKey: string,
  correlationId?: string,
) => {
  requireTenant(battlefieldKey);
  const state = getState(battlefieldKey, correlationId);
  const description = state.outputs["battlefield-description"]?.content?.trim();
  if (!description) {
    emitSectionError(
      battlefieldKey,
      "battlefield-config",
      new Error("Battlefield description is required before regenerating config."),
      correlationId,
    );
    return;
  }

  try {
    await runTextSectionStep({
      battlefieldKey,
      sectionId: "battlefield-config",
      input: description,
      correlationId,
      generator: async (input, onDelta, context) => {
        const generated = await generateBattlefieldConfig(input, onDelta, context);
        return { content: generated.config, model: generated.model };
      },
    });
  } finally {
    await syncBattlefieldPipelineState(battlefieldKey);
  }
};

export const hydrateBattlefieldPipelineFromBucket = async (
  battlefieldKey: string,
  tenant: BattlefieldPipelineTenant,
): Promise<boolean> => {
  const existing = stateByBattlefield.get(battlefieldKey);
  if (existing) {
    return true;
  }

  bindBattlefieldPipelineTenant(battlefieldKey, tenant);
  try {
    const raw = await getObjectBuffer(
      battlefieldPipelineStateObjectKey(tenant.userId, tenant.battlefieldId),
    );
    if (!raw) {
      return false;
    }

    const snapshot = JSON.parse(raw.toString()) as PersistedBattlefieldPipelineSnapshot;
    if (snapshot.version !== PIPELINE_STORAGE_VERSION || !snapshot.outputs) {
      return false;
    }

    const state = getState(battlefieldKey);
    state.outputs = snapshot.outputs ?? {};
    state.histories = snapshot.histories ?? {};
    state.activeSectionIds =
      snapshot.activeSectionIds ?? (snapshot.activeSectionId ? [snapshot.activeSectionId] : []);
    state.lastErrorSectionId = snapshot.lastErrorSectionId ?? null;
    state.gateMessage = snapshot.gateMessage ?? null;
    return true;
  } catch {
    return false;
  }
};

const reconcileImageOutput = async ({
  outputs,
  tenant,
}: {
  outputs: Partial<Record<BattlefieldSectionId, SectionOutput>>;
  tenant: BattlefieldPipelineTenant;
}): Promise<Partial<Record<BattlefieldSectionId, SectionOutput>>> => {
  const reconciled = { ...outputs };
  const sectionId: BattlefieldSectionId = "battlefield-sheet-image";
  const current = reconciled[sectionId];
  const objectKey = battlefieldSheetImageObjectKey(tenant.userId, tenant.battlefieldId);

  if (!(await objectExists(objectKey))) {
    if (!current) {
      return reconciled;
    }
    delete reconciled[sectionId];
    return reconciled;
  }

  reconciled[sectionId] = {
    sectionId,
    content: objectKey,
    generatedAt: current?.generatedAt ?? new Date().toISOString(),
    model: current?.model ?? "storage-recovered",
    mimeType: current?.mimeType ?? "image/jpeg",
  };
  return reconciled;
};

export const serializeClientBattlefieldPipelineState = async (
  battlefieldKey: string,
): Promise<ClientBattlefieldPipelineStateSnapshot | null> => {
  const tenant = tenantByBattlefield.get(battlefieldKey);
  if (!tenant) {
    return null;
  }

  let state = stateByBattlefield.get(battlefieldKey);
  if (!state) {
    await hydrateBattlefieldPipelineFromBucket(battlefieldKey, tenant);
    state = stateByBattlefield.get(battlefieldKey);
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

  state.outputs = await reconcileImageOutput({ outputs: state.outputs, tenant });
  state.outputs = await reconcileOutputsWithSectionProofs({
    battlefieldKey,
    tenant,
    outputs: state.outputs,
    activeSectionIds: state.activeSectionIds,
  });

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

export const syncBattlefieldPipelineState = async (battlefieldKey: string) => {
  const state = stateByBattlefield.get(battlefieldKey);
  if (!state) {
    return;
  }

  const tenant = tenantByBattlefield.get(battlefieldKey);
  if (tenant) {
    state.outputs = await reconcileImageOutput({ outputs: state.outputs, tenant });
    state.outputs = await reconcileOutputsWithSectionProofs({
      battlefieldKey,
      tenant,
      outputs: state.outputs,
      activeSectionIds: state.activeSectionIds,
    });
    await persistSnapshot(battlefieldKey, state, tenant);
  }

  sendToBattlefield(battlefieldKey, await buildSyncMessage(state));
};

export const clearPipelineStateForBattlefield = (battlefieldKey: string) => {
  clearPendingForBattlefield(battlefieldKey);
  stateByBattlefield.delete(battlefieldKey);
  tenantByBattlefield.delete(battlefieldKey);
};
