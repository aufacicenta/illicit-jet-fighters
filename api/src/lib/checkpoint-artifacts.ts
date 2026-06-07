import { gunzipSync, gzipSync } from "node:zlib";

import {
  fighterCheckpointObjectKey,
  fighterLatestCheckpointObjectKey,
  getObjectBuffer,
  putObject,
} from "./r2";

const MAX_CHECKPOINT_BYTES = 2 * 1024 * 1024;

export const readCheckpointArtifact = async (objectKey: string): Promise<string | null> => {
  const raw = await getObjectBuffer(objectKey);
  if (!raw) {
    return null;
  }

  try {
    const decompressed = gunzipSync(raw).toString("utf8");
    return decompressed.length > 0 ? decompressed : null;
  } catch {
    return null;
  }
};

export const writeCheckpointArtifacts = async ({
  userId,
  fighterId,
  simulationId,
  checkpointData,
}: {
  userId: string;
  fighterId: number;
  simulationId: string;
  checkpointData: string;
}): Promise<{ objectKey: string; latestObjectKey: string; sizeBytes: number } | null> => {
  if (checkpointData.length === 0 || checkpointData.length > MAX_CHECKPOINT_BYTES) {
    return null;
  }

  const compressed = gzipSync(Buffer.from(checkpointData, "utf8"), { level: 9 });
  const objectKey = fighterCheckpointObjectKey(userId, fighterId, simulationId);
  const latestObjectKey = fighterLatestCheckpointObjectKey(userId, fighterId);

  await Promise.all([
    putObject(objectKey, compressed, "application/gzip"),
    putObject(latestObjectKey, compressed, "application/gzip"),
  ]);

  return {
    objectKey,
    latestObjectKey,
    sizeBytes: compressed.byteLength,
  };
};
