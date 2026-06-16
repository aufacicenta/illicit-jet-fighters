import { createHash } from "node:crypto";

import { and, db, desc, eq, fighterAgentVersions } from "@ijf/database";

import { fighterAgentVersionScriptObjectKey, putObject } from "./r2";

export type FighterAgentVersion = {
  id: string;
  fighterId: number;
  userId: string;
  versionNumber: number;
  contentHash: string;
  objectKey: string;
  model: string | null;
  createdAt: Date;
};

export const getNextFighterAgentVersionNumber = async (fighterId: number): Promise<number> => {
  const latest = await db
    .select({
      versionNumber: fighterAgentVersions.versionNumber,
    })
    .from(fighterAgentVersions)
    .where(eq(fighterAgentVersions.fighterId, fighterId))
    .orderBy(desc(fighterAgentVersions.versionNumber))
    .limit(1);

  return (latest[0]?.versionNumber ?? 0) + 1;
};

export const createFighterAgentVersion = async ({
  fighterId,
  userId,
  versionNumber,
  contentHash,
  objectKey,
  model,
}: {
  fighterId: number;
  userId: string;
  versionNumber: number;
  contentHash: string;
  objectKey: string;
  model?: string | null;
}): Promise<FighterAgentVersion> => {
  const inserted = await db
    .insert(fighterAgentVersions)
    .values({
      fighterId,
      userId,
      versionNumber,
      contentHash,
      objectKey,
      model: model ?? null,
    })
    .returning({
      id: fighterAgentVersions.id,
      fighterId: fighterAgentVersions.fighterId,
      userId: fighterAgentVersions.userId,
      versionNumber: fighterAgentVersions.versionNumber,
      contentHash: fighterAgentVersions.contentHash,
      objectKey: fighterAgentVersions.objectKey,
      model: fighterAgentVersions.model,
      createdAt: fighterAgentVersions.createdAt,
    });

  const row = inserted[0];
  if (!row) {
    throw new Error("Failed to create fighter agent version.");
  }

  return row;
};

export const persistFighterAgentVersion = async ({
  fighterId,
  userId,
  code,
  model,
}: {
  fighterId: number;
  userId: string;
  code: string;
  model?: string | null;
}): Promise<FighterAgentVersion> => {
  const contentHash = createHash("sha256").update(code).digest("hex");
  const versionNumber = await getNextFighterAgentVersionNumber(fighterId);
  const objectKey = fighterAgentVersionScriptObjectKey(userId, fighterId, versionNumber);

  await putObject(objectKey, Buffer.from(code), "application/typescript");

  return createFighterAgentVersion({
    fighterId,
    userId,
    versionNumber,
    contentHash,
    objectKey,
    model,
  });
};

export const getLatestFighterAgentVersion = async (
  fighterId: number,
): Promise<FighterAgentVersion | null> => {
  const rows = await db
    .select({
      id: fighterAgentVersions.id,
      fighterId: fighterAgentVersions.fighterId,
      userId: fighterAgentVersions.userId,
      versionNumber: fighterAgentVersions.versionNumber,
      contentHash: fighterAgentVersions.contentHash,
      objectKey: fighterAgentVersions.objectKey,
      model: fighterAgentVersions.model,
      createdAt: fighterAgentVersions.createdAt,
    })
    .from(fighterAgentVersions)
    .where(eq(fighterAgentVersions.fighterId, fighterId))
    .orderBy(desc(fighterAgentVersions.versionNumber))
    .limit(1);

  return rows[0] ?? null;
};

export const getLatestFighterAgentVersionForHash = async ({
  fighterId,
  contentHash,
}: {
  fighterId: number;
  contentHash: string;
}): Promise<FighterAgentVersion | null> => {
  const rows = await db
    .select({
      id: fighterAgentVersions.id,
      fighterId: fighterAgentVersions.fighterId,
      userId: fighterAgentVersions.userId,
      versionNumber: fighterAgentVersions.versionNumber,
      contentHash: fighterAgentVersions.contentHash,
      objectKey: fighterAgentVersions.objectKey,
      model: fighterAgentVersions.model,
      createdAt: fighterAgentVersions.createdAt,
    })
    .from(fighterAgentVersions)
    .where(
      and(
        eq(fighterAgentVersions.fighterId, fighterId),
        eq(fighterAgentVersions.contentHash, contentHash),
      ),
    )
    .orderBy(desc(fighterAgentVersions.versionNumber))
    .limit(1);

  return rows[0] ?? null;
};

export const getFighterAgentVersionByIdForOwnerAndFighter = async ({
  id,
  fighterId,
  userId,
}: {
  id: string;
  fighterId: number;
  userId: string;
}): Promise<FighterAgentVersion | null> => {
  const rows = await db
    .select({
      id: fighterAgentVersions.id,
      fighterId: fighterAgentVersions.fighterId,
      userId: fighterAgentVersions.userId,
      versionNumber: fighterAgentVersions.versionNumber,
      contentHash: fighterAgentVersions.contentHash,
      objectKey: fighterAgentVersions.objectKey,
      model: fighterAgentVersions.model,
      createdAt: fighterAgentVersions.createdAt,
    })
    .from(fighterAgentVersions)
    .where(
      and(
        eq(fighterAgentVersions.id, id),
        eq(fighterAgentVersions.fighterId, fighterId),
        eq(fighterAgentVersions.userId, userId),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
};

export const listFighterAgentVersionsForOwnerAndFighter = async ({
  fighterId,
  userId,
}: {
  fighterId: number;
  userId: string;
}): Promise<FighterAgentVersion[]> =>
  db
    .select({
      id: fighterAgentVersions.id,
      fighterId: fighterAgentVersions.fighterId,
      userId: fighterAgentVersions.userId,
      versionNumber: fighterAgentVersions.versionNumber,
      contentHash: fighterAgentVersions.contentHash,
      objectKey: fighterAgentVersions.objectKey,
      model: fighterAgentVersions.model,
      createdAt: fighterAgentVersions.createdAt,
    })
    .from(fighterAgentVersions)
    .where(
      and(eq(fighterAgentVersions.fighterId, fighterId), eq(fighterAgentVersions.userId, userId)),
    )
    .orderBy(desc(fighterAgentVersions.versionNumber));

export const listFighterAgentVersionSummaries = async ({
  fighterId,
  userId,
}: {
  fighterId: number;
  userId: string;
}): Promise<{ id: string; versionNumber: number }[]> =>
  db
    .select({
      id: fighterAgentVersions.id,
      versionNumber: fighterAgentVersions.versionNumber,
    })
    .from(fighterAgentVersions)
    .where(
      and(eq(fighterAgentVersions.fighterId, fighterId), eq(fighterAgentVersions.userId, userId)),
    )
    .orderBy(desc(fighterAgentVersions.versionNumber));
