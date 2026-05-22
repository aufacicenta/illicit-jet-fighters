import { and, db, desc, eq, llmUsageEvents, sql } from "@ijf/database";

import type { SectionId } from "./types";

export type LlmUsageEvent = {
  id: string;
  userId: string;
  fighterId: number | null;
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
  latestRunCorrelationId: string | null;
  latestRunSectionCosts: Partial<Record<SectionId, string>>;
};

const allSectionIds: SectionId[] = [
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

const buildZeroSectionCosts = (): Partial<Record<SectionId, string>> => {
  const costs: Partial<Record<SectionId, string>> = {};
  for (const sectionId of allSectionIds) {
    costs[sectionId] = "0";
  }
  return costs;
};

export const insertLlmUsageEvent = async ({
  executor,
  userId,
  fighterId,
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
}): Promise<{ correlationId: string | null; sectionCosts: Partial<Record<SectionId, string>> }> => {
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
    return { correlationId: null, sectionCosts: buildZeroSectionCosts() };
  }

  const sectionCosts = buildZeroSectionCosts();
  const latestCorrelationBySection: Partial<Record<SectionId, string | null>> = {};

  for (const row of latestEventRows) {
    const sectionId = row.sectionId as SectionId;
    if (latestCorrelationBySection[sectionId] === undefined) {
      latestCorrelationBySection[sectionId] = row.correlationId;
    }
  }

  const sectionTotals = new Map<SectionId, number>();

  for (const row of latestEventRows) {
    const sectionId = row.sectionId as SectionId;
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
  const [totalCostUsd, latestRun] = await Promise.all([
    getTotalCostForFighter({ userId, fighterId }),
    getLatestRunSectionCosts({ userId, fighterId }),
  ]);

  return {
    fighterId,
    totalCostUsd,
    latestRunCorrelationId: latestRun.correlationId,
    latestRunSectionCosts: latestRun.sectionCosts,
  };
};
