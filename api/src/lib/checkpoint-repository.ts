import { and, db, desc, eq, fighterCheckpoints } from "@ijf/database";

export type FighterCheckpoint = {
  id: string;
  fighterId: number;
  userId: string;
  simulationId: string;
  agentVersionId: string | null;
  objectKey: string;
  sizeBytes: number;
  createdAt: Date;
};

export const createFighterCheckpoint = async ({
  fighterId,
  userId,
  simulationId,
  agentVersionId,
  objectKey,
  sizeBytes,
}: {
  fighterId: number;
  userId: string;
  simulationId: string;
  agentVersionId?: string | null;
  objectKey: string;
  sizeBytes: number;
}): Promise<FighterCheckpoint> => {
  const inserted = await db
    .insert(fighterCheckpoints)
    .values({
      fighterId,
      userId,
      simulationId,
      agentVersionId: agentVersionId ?? null,
      objectKey,
      sizeBytes,
    })
    .returning({
      id: fighterCheckpoints.id,
      fighterId: fighterCheckpoints.fighterId,
      userId: fighterCheckpoints.userId,
      simulationId: fighterCheckpoints.simulationId,
      agentVersionId: fighterCheckpoints.agentVersionId,
      objectKey: fighterCheckpoints.objectKey,
      sizeBytes: fighterCheckpoints.sizeBytes,
      createdAt: fighterCheckpoints.createdAt,
    });

  const row = inserted[0];
  if (!row) {
    throw new Error("Failed to create fighter checkpoint.");
  }

  return row;
};

export const getLatestFighterCheckpointForOwner = async ({
  fighterId,
  userId,
  agentVersionId,
}: {
  fighterId: number;
  userId: string;
  agentVersionId?: string | null;
}): Promise<FighterCheckpoint | null> => {
  const conditions = [
    eq(fighterCheckpoints.fighterId, fighterId),
    eq(fighterCheckpoints.userId, userId),
  ];
  if (agentVersionId) {
    conditions.push(eq(fighterCheckpoints.agentVersionId, agentVersionId));
  }

  const rows = await db
    .select({
      id: fighterCheckpoints.id,
      fighterId: fighterCheckpoints.fighterId,
      userId: fighterCheckpoints.userId,
      simulationId: fighterCheckpoints.simulationId,
      agentVersionId: fighterCheckpoints.agentVersionId,
      objectKey: fighterCheckpoints.objectKey,
      sizeBytes: fighterCheckpoints.sizeBytes,
      createdAt: fighterCheckpoints.createdAt,
    })
    .from(fighterCheckpoints)
    .where(and(...conditions))
    .orderBy(desc(fighterCheckpoints.createdAt))
    .limit(1);

  return rows[0] ?? null;
};

export const getFighterCheckpointForSimulation = async ({
  fighterId,
  userId,
  simulationId,
}: {
  fighterId: number;
  userId: string;
  simulationId: string;
}): Promise<FighterCheckpoint | null> => {
  const rows = await db
    .select({
      id: fighterCheckpoints.id,
      fighterId: fighterCheckpoints.fighterId,
      userId: fighterCheckpoints.userId,
      simulationId: fighterCheckpoints.simulationId,
      agentVersionId: fighterCheckpoints.agentVersionId,
      objectKey: fighterCheckpoints.objectKey,
      sizeBytes: fighterCheckpoints.sizeBytes,
      createdAt: fighterCheckpoints.createdAt,
    })
    .from(fighterCheckpoints)
    .where(
      and(
        eq(fighterCheckpoints.fighterId, fighterId),
        eq(fighterCheckpoints.userId, userId),
        eq(fighterCheckpoints.simulationId, simulationId),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
};

export const fighterHasCheckpointForOwner = async ({
  fighterId,
  userId,
}: {
  fighterId: number;
  userId: string;
}): Promise<boolean> => {
  const latest = await getLatestFighterCheckpointForOwner({ fighterId, userId });
  return latest !== null;
};
