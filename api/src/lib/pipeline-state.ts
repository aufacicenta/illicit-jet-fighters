import { FIGHTER_PIPELINE_SECTION_ORDER } from "@ijf/shared";

import { clearPendingForFighter } from "../ws/store";
import { touchFighterUpdatedAt } from "./fighter-access";
import { withFighterContext as withContext } from "./log-context";
import { logger } from "./logger";
import { getObjectBuffer, pipelineStateObjectKey, putObject } from "./r2";
import type { ChatMessage, FighterSectionId as SectionId, SectionOutput } from "./types";

export type PipelineTenant = {
  userId: string;
  fighterId: number;
};

export type FighterPipelineState = {
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

const stateByFighter = new Map<string, FighterPipelineState>();
const tenantByFighter = new Map<string, PipelineTenant>();

export const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

export const nowIso = () => new Date().toISOString();

// Serializes all mutating operations per fighter so concurrent requests
// (overlapping regenerations, repeated "continue", multiple tabs) cannot
// interleave mutations of the shared in-memory state or race on snapshot persist.
const operationQueues = new Map<string, Promise<unknown>>();

export const withFighterLock = <T>(fighterKey: string, operation: () => Promise<T>): Promise<T> => {
  const previous = operationQueues.get(fighterKey) ?? Promise.resolve();
  const run = previous.then(operation, operation);
  const tail = run.then(
    () => undefined,
    () => undefined,
  );
  operationQueues.set(fighterKey, tail);
  void tail.finally(() => {
    if (operationQueues.get(fighterKey) === tail) {
      operationQueues.delete(fighterKey);
    }
  });
  return run;
};

export const bindPipelineTenant = (fighterKey: string, tenant: PipelineTenant) => {
  tenantByFighter.set(fighterKey, tenant);
};

export const getTenant = (fighterKey: string): PipelineTenant | undefined =>
  tenantByFighter.get(fighterKey);

export const requireTenant = (fighterKey: string): PipelineTenant => {
  const tenant = tenantByFighter.get(fighterKey);
  if (!tenant) {
    throw new Error("Pipeline session is missing authenticated fighter context.");
  }
  return tenant;
};

export const peekState = (fighterKey: string): FighterPipelineState | undefined =>
  stateByFighter.get(fighterKey);

export const getState = (fighterKey: string, correlationId?: string): FighterPipelineState => {
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

export const persistSnapshot = async (
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

export const setOutput = (
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

export const setHistory = (
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

export const clearPipelineStateForFighter = (fighterKey: string) => {
  clearPendingForFighter(fighterKey);
  stateByFighter.delete(fighterKey);
  tenantByFighter.delete(fighterKey);
};
