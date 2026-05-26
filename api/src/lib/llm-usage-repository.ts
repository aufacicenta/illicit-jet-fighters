import {
  and,
  db,
  desc,
  eq,
  inArray,
  llmUsageEvents,
  sql,
  walletLedgerEntries,
} from "@ijf/database";

import type { BattlefieldSectionId, FighterSectionId, SectionId } from "./types";

export type LlmUsageEvent = {
  id: string;
  userId: string;
  fighterId: number | null;
  battlefieldId: number | null;
  sectionId: string;
  correlationId: string | null;
  openrouterGenerationId: string | null;
  model: string;
  provider: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costCredits: string;
  durationMs: number;
  createdAt: Date;
};

export type FighterCostSnapshot = {
  fighterId: number;
  totalCostUsd: string;
  totalCostNative: string;
  latestRunCorrelationId: string | null;
  latestRunSectionCosts: Partial<Record<FighterSectionId, string>>;
};

export type BattlefieldCostSnapshot = {
  battlefieldId: number;
  totalCostUsd: string;
  latestRunCorrelationId: string | null;
  latestRunSectionCosts: Partial<Record<BattlefieldSectionId, string>>;
};

const fighterSectionIds: FighterSectionId[] = [
  "character-description",
  "specsheet-prompt",
  "specsheet-image",
  "spritesheet-prompt",
  "spritesheet-image",
  "spritesheet-manifest",
  "agent-code",
  "strikecraft-specsheet-prompt",
  "strikecraft-specsheet-image",
  "strikecraft-sprite-prompt",
  "strikecraft-sprite-image",
];

const battlefieldSectionIds: BattlefieldSectionId[] = [
  "battlefield-description",
  "battlefield-sheet-prompt",
  "battlefield-sheet-image",
  "battlefield-config",
];

const billingKinds = ["charge", "fee"] as const;

const buildZeroSectionCosts = <TSectionId extends SectionId>(
  sectionIds: TSectionId[],
): Partial<Record<TSectionId, string>> => {
  const costs: Partial<Record<TSectionId, string>> = {};
  for (const sectionId of sectionIds) {
    costs[sectionId] = "0";
  }
  return costs;
};

export const insertLlmUsageEvent = async ({
  executor,
  userId,
  fighterId,
  battlefieldId,
  sectionId,
  correlationId,
  openrouterGenerationId,
  model,
  provider,
  promptTokens,
  completionTokens,
  totalTokens,
  costCredits,
  durationMs,
}: {
  executor?: typeof db;
  userId: string;
  fighterId?: number | null;
  battlefieldId?: number | null;
  sectionId: string;
  correlationId?: string;
  openrouterGenerationId?: string;
  model: string;
  provider: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  costCredits?: string;
  durationMs: number;
}): Promise<LlmUsageEvent> => {
  const run = executor ?? db;
  const inserted = await run
    .insert(llmUsageEvents)
    .values({
      userId,
      fighterId: fighterId ?? null,
      battlefieldId: battlefieldId ?? null,
      sectionId,
      correlationId: correlationId ?? null,
      openrouterGenerationId: openrouterGenerationId ?? null,
      model,
      provider,
      promptTokens: promptTokens ?? 0,
      completionTokens: completionTokens ?? 0,
      totalTokens: totalTokens ?? 0,
      costCredits: costCredits ?? "0",
      durationMs,
    })
    .returning({
      id: llmUsageEvents.id,
      userId: llmUsageEvents.userId,
      fighterId: llmUsageEvents.fighterId,
      battlefieldId: llmUsageEvents.battlefieldId,
      sectionId: llmUsageEvents.sectionId,
      correlationId: llmUsageEvents.correlationId,
      openrouterGenerationId: llmUsageEvents.openrouterGenerationId,
      model: llmUsageEvents.model,
      provider: llmUsageEvents.provider,
      promptTokens: llmUsageEvents.promptTokens,
      completionTokens: llmUsageEvents.completionTokens,
      totalTokens: llmUsageEvents.totalTokens,
      costCredits: llmUsageEvents.costCredits,
      durationMs: llmUsageEvents.durationMs,
      createdAt: llmUsageEvents.createdAt,
    });

  const row = inserted[0];
  if (!row) {
    throw new Error("Failed to create llm usage event.");
  }

  return row;
};

export const getLlmUsageEventsForFighter = async ({
  userId,
  fighterId,
}: {
  userId: string;
  fighterId: number;
}): Promise<LlmUsageEvent[]> =>
  db
    .select({
      id: llmUsageEvents.id,
      userId: llmUsageEvents.userId,
      fighterId: llmUsageEvents.fighterId,
      battlefieldId: llmUsageEvents.battlefieldId,
      sectionId: llmUsageEvents.sectionId,
      correlationId: llmUsageEvents.correlationId,
      openrouterGenerationId: llmUsageEvents.openrouterGenerationId,
      model: llmUsageEvents.model,
      provider: llmUsageEvents.provider,
      promptTokens: llmUsageEvents.promptTokens,
      completionTokens: llmUsageEvents.completionTokens,
      totalTokens: llmUsageEvents.totalTokens,
      costCredits: llmUsageEvents.costCredits,
      durationMs: llmUsageEvents.durationMs,
      createdAt: llmUsageEvents.createdAt,
    })
    .from(llmUsageEvents)
    .where(and(eq(llmUsageEvents.userId, userId), eq(llmUsageEvents.fighterId, fighterId)))
    .orderBy(desc(llmUsageEvents.createdAt));

export const getLlmUsageEventsForUser = async ({
  userId,
  limit = 50,
  offset = 0,
}: {
  userId: string;
  limit?: number;
  offset?: number;
}): Promise<LlmUsageEvent[]> =>
  db
    .select({
      id: llmUsageEvents.id,
      userId: llmUsageEvents.userId,
      fighterId: llmUsageEvents.fighterId,
      battlefieldId: llmUsageEvents.battlefieldId,
      sectionId: llmUsageEvents.sectionId,
      correlationId: llmUsageEvents.correlationId,
      openrouterGenerationId: llmUsageEvents.openrouterGenerationId,
      model: llmUsageEvents.model,
      provider: llmUsageEvents.provider,
      promptTokens: llmUsageEvents.promptTokens,
      completionTokens: llmUsageEvents.completionTokens,
      totalTokens: llmUsageEvents.totalTokens,
      costCredits: llmUsageEvents.costCredits,
      durationMs: llmUsageEvents.durationMs,
      createdAt: llmUsageEvents.createdAt,
    })
    .from(llmUsageEvents)
    .where(eq(llmUsageEvents.userId, userId))
    .orderBy(desc(llmUsageEvents.createdAt))
    .limit(Math.max(1, Math.min(500, Math.floor(limit))))
    .offset(Math.max(0, Math.floor(offset)));

export const sumCostForFighter = async ({
  userId,
  fighterId,
}: {
  userId: string;
  fighterId: number;
}): Promise<string> => {
  const rows = await db
    .select({
      totalCostCredits: sql<string>`coalesce(sum(${llmUsageEvents.costCredits}), 0)`,
    })
    .from(llmUsageEvents)
    .where(and(eq(llmUsageEvents.userId, userId), eq(llmUsageEvents.fighterId, fighterId)))
    .limit(1);

  return rows[0]?.totalCostCredits ?? "0";
};

export const sumNativeCostForFighter = async ({
  userId,
  fighterId,
}: {
  userId: string;
  fighterId: number;
}): Promise<string> => {
  const rows = await db
    .select({
      totalCostNative: sql<string>`coalesce(sum(abs(${walletLedgerEntries.amountNative})), 0)::text`,
    })
    .from(llmUsageEvents)
    .innerJoin(walletLedgerEntries, eq(walletLedgerEntries.llmUsageEventId, llmUsageEvents.id))
    .where(
      and(
        eq(llmUsageEvents.userId, userId),
        eq(llmUsageEvents.fighterId, fighterId),
        inArray(walletLedgerEntries.kind, billingKinds),
      ),
    )
    .limit(1);

  return rows[0]?.totalCostNative ?? "0";
};

export const sumCostForUser = async (userId: string): Promise<string> => {
  const rows = await db
    .select({
      totalCostCredits: sql<string>`coalesce(sum(${llmUsageEvents.costCredits}), 0)`,
    })
    .from(llmUsageEvents)
    .where(eq(llmUsageEvents.userId, userId))
    .limit(1);

  return rows[0]?.totalCostCredits ?? "0";
};

export const getLatestCorrelationIdForFighter = async ({
  userId,
  fighterId,
}: {
  userId: string;
  fighterId: number;
}): Promise<string | null> => {
  const rows = await db
    .select({
      correlationId: llmUsageEvents.correlationId,
    })
    .from(llmUsageEvents)
    .where(and(eq(llmUsageEvents.userId, userId), eq(llmUsageEvents.fighterId, fighterId)))
    .orderBy(desc(llmUsageEvents.createdAt))
    .limit(1);

  return rows[0]?.correlationId ?? null;
};

export const getLatestRunSectionCosts = async ({
  userId,
  fighterId,
}: {
  userId: string;
  fighterId: number;
}): Promise<{
  correlationId: string | null;
  sectionCosts: Partial<Record<FighterSectionId, string>>;
}> => {
  const latestEventRows = await db
    .select({
      sectionId: llmUsageEvents.sectionId,
      correlationId: llmUsageEvents.correlationId,
      costCredits: llmUsageEvents.costCredits,
    })
    .from(llmUsageEvents)
    .where(and(eq(llmUsageEvents.userId, userId), eq(llmUsageEvents.fighterId, fighterId)))
    .orderBy(desc(llmUsageEvents.createdAt));

  const latestEventCorrelationId = latestEventRows[0]?.correlationId ?? null;
  if (latestEventRows.length === 0) {
    return { correlationId: null, sectionCosts: buildZeroSectionCosts(fighterSectionIds) };
  }

  const sectionCosts = buildZeroSectionCosts(fighterSectionIds);
  const latestCorrelationBySection: Partial<Record<FighterSectionId, string | null>> = {};

  for (const row of latestEventRows) {
    const sectionId = row.sectionId as FighterSectionId;
    if (latestCorrelationBySection[sectionId] === undefined) {
      latestCorrelationBySection[sectionId] = row.correlationId;
    }
  }

  const sectionTotals = new Map<FighterSectionId, number>();

  for (const row of latestEventRows) {
    const sectionId = row.sectionId as FighterSectionId;
    const latestSectionCorrelationId = latestCorrelationBySection[sectionId];
    if (
      latestSectionCorrelationId === undefined ||
      latestSectionCorrelationId !== row.correlationId
    ) {
      continue;
    }

    const cost = Number.parseFloat(row.costCredits);
    if (!Number.isFinite(cost)) {
      continue;
    }

    sectionTotals.set(sectionId, (sectionTotals.get(sectionId) ?? 0) + cost);
  }

  for (const [sectionId, totalCost] of sectionTotals.entries()) {
    sectionCosts[sectionId] = totalCost.toFixed(8);
  }

  return { correlationId: latestEventCorrelationId, sectionCosts };
};

export const getTotalCostForFighter = async ({
  userId,
  fighterId,
}: {
  userId: string;
  fighterId: number;
}): Promise<string> => sumCostForFighter({ userId, fighterId });

export const buildFighterCostSnapshot = async ({
  userId,
  fighterId,
}: {
  userId: string;
  fighterId: number;
}): Promise<FighterCostSnapshot> => {
  const [totalCostUsd, totalCostNative, latestRun] = await Promise.all([
    getTotalCostForFighter({ userId, fighterId }),
    sumNativeCostForFighter({ userId, fighterId }),
    getLatestRunSectionCosts({ userId, fighterId }),
  ]);

  return {
    fighterId,
    totalCostUsd,
    totalCostNative,
    latestRunCorrelationId: latestRun.correlationId,
    latestRunSectionCosts: latestRun.sectionCosts,
  };
};

export const sumCostForBattlefield = async ({
  userId,
  battlefieldId,
}: {
  userId: string;
  battlefieldId: number;
}): Promise<string> => {
  const rows = await db
    .select({
      totalCostCredits: sql<string>`coalesce(sum(${llmUsageEvents.costCredits}), 0)`,
    })
    .from(llmUsageEvents)
    .where(and(eq(llmUsageEvents.userId, userId), eq(llmUsageEvents.battlefieldId, battlefieldId)))
    .limit(1);

  return rows[0]?.totalCostCredits ?? "0";
};

export const getLatestRunSectionCostsForBattlefield = async ({
  userId,
  battlefieldId,
}: {
  userId: string;
  battlefieldId: number;
}): Promise<{
  correlationId: string | null;
  sectionCosts: Partial<Record<BattlefieldSectionId, string>>;
}> => {
  const latestEventRows = await db
    .select({
      sectionId: llmUsageEvents.sectionId,
      correlationId: llmUsageEvents.correlationId,
      costCredits: llmUsageEvents.costCredits,
    })
    .from(llmUsageEvents)
    .where(and(eq(llmUsageEvents.userId, userId), eq(llmUsageEvents.battlefieldId, battlefieldId)))
    .orderBy(desc(llmUsageEvents.createdAt));

  const latestEventCorrelationId = latestEventRows[0]?.correlationId ?? null;
  if (latestEventRows.length === 0) {
    return { correlationId: null, sectionCosts: buildZeroSectionCosts(battlefieldSectionIds) };
  }

  const sectionCosts = buildZeroSectionCosts(battlefieldSectionIds);
  const latestCorrelationBySection: Partial<Record<BattlefieldSectionId, string | null>> = {};

  for (const row of latestEventRows) {
    const sectionId = row.sectionId as BattlefieldSectionId;
    if (latestCorrelationBySection[sectionId] === undefined) {
      latestCorrelationBySection[sectionId] = row.correlationId;
    }
  }

  const sectionTotals = new Map<BattlefieldSectionId, number>();

  for (const row of latestEventRows) {
    const sectionId = row.sectionId as BattlefieldSectionId;
    const latestSectionCorrelationId = latestCorrelationBySection[sectionId];
    if (
      latestSectionCorrelationId === undefined ||
      latestSectionCorrelationId !== row.correlationId
    ) {
      continue;
    }

    const cost = Number.parseFloat(row.costCredits);
    if (!Number.isFinite(cost)) {
      continue;
    }

    sectionTotals.set(sectionId, (sectionTotals.get(sectionId) ?? 0) + cost);
  }

  for (const [sectionId, totalCost] of sectionTotals.entries()) {
    sectionCosts[sectionId] = totalCost.toFixed(8);
  }

  return { correlationId: latestEventCorrelationId, sectionCosts };
};

export const buildBattlefieldCostSnapshot = async ({
  userId,
  battlefieldId,
}: {
  userId: string;
  battlefieldId: number;
}): Promise<BattlefieldCostSnapshot> => {
  const [totalCostUsd, latestRun] = await Promise.all([
    sumCostForBattlefield({ userId, battlefieldId }),
    getLatestRunSectionCostsForBattlefield({ userId, battlefieldId }),
  ]);

  return {
    battlefieldId,
    totalCostUsd,
    latestRunCorrelationId: latestRun.correlationId,
    latestRunSectionCosts: latestRun.sectionCosts,
  };
};
