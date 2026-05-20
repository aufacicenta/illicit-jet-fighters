import { gunzipSync, gzipSync } from "node:zlib";

import type { BroadcastMessage, ReplayFrame } from "@ijf/shared";

import {
  getObjectBuffer,
  putObject,
  simulationBroadcastEventsObjectKey,
  simulationReplayObjectKey,
} from "./r2";

const toJsonGzipBuffer = (payload: unknown) =>
  gzipSync(Buffer.from(JSON.stringify(payload)), { level: 9 });

const toNdjsonGzipBuffer = (messages: BroadcastMessage[]) =>
  gzipSync(Buffer.from(messages.map((message) => JSON.stringify(message)).join("\n")), {
    level: 9,
  });

export const writeSimulationArtifacts = async ({
  userId,
  simulationId,
  frames,
  messages,
}: {
  userId: string;
  simulationId: string;
  frames: ReplayFrame[];
  messages: BroadcastMessage[];
}) => {
  const replayObjectKey = simulationReplayObjectKey(userId, simulationId);
  const broadcastEventsObjectKey = simulationBroadcastEventsObjectKey(userId, simulationId);

  await Promise.all([
    putObject(replayObjectKey, toJsonGzipBuffer({ frames }), "application/gzip"),
    putObject(broadcastEventsObjectKey, toNdjsonGzipBuffer(messages), "application/gzip"),
  ]);

  return {
    replayObjectKey,
    broadcastEventsObjectKey,
  };
};

export const readReplayFramesArtifact = async (
  replayObjectKey: string,
): Promise<ReplayFrame[] | null> => {
  const raw = await getObjectBuffer(replayObjectKey);
  if (!raw) {
    return null;
  }

  const parsed = JSON.parse(gunzipSync(raw).toString("utf8")) as { frames?: ReplayFrame[] };
  if (!Array.isArray(parsed.frames)) {
    return null;
  }
  return parsed.frames;
};
