import { and, db, desc, eq, llmUsageEvents, sql } from "@ijf/database";

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

export const insertLlmUsageEvent = async ({
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
  const inserted = await db
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
