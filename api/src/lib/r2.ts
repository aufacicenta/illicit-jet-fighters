import path from "node:path";

import {
  DeleteObjectsCommand,
  GetObjectCommand,
  type GetObjectCommandOutput,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { env } from "../config/env";

let cachedClient: S3Client | null = null;

const getBucket = () => {
  const bucket = env.R2_BUCKET;
  if (!bucket) {
    throw new Error("R2_BUCKET is required.");
  }

  return bucket;
};

const getClient = (): S3Client => {
  if (cachedClient) {
    return cachedClient;
  }

  const bucket = env.R2_BUCKET;
  const endpoint = env.R2_ENDPOINT;

  if (!bucket || !endpoint) {
    throw new Error("R2_BUCKET and R2_ENDPOINT are required.");
  }

  const region = env.R2_REGION ?? "auto";

  cachedClient = new S3Client({
    region,
    endpoint,
    credentials:
      env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY
        ? {
            accessKeyId: env.R2_ACCESS_KEY_ID,
            secretAccessKey: env.R2_SECRET_ACCESS_KEY,
          }
        : undefined,
    forcePathStyle: true,
  });

  return cachedClient;
};

export const specsheetObjectKey = (userId: string, fighterId: number, extension: string) =>
  path.posix.join(`users/${userId}/fighters/${String(fighterId)}`, `specsheet-image.${extension}`);

export const characterPfpObjectKey = (userId: string, fighterId: number, extension: string) =>
  path.posix.join(`users/${userId}/fighters/${String(fighterId)}`, `character-pfp.${extension}`);

export const spritesheetImageObjectKey = (userId: string, fighterId: number, extension: string) =>
  path.posix.join(
    `users/${userId}/fighters/${String(fighterId)}`,
    `spritesheet-image.${extension}`,
  );

export const spritesheetManifestObjectKey = (userId: string, fighterId: number) =>
  path.posix.join(`users/${userId}/fighters/${String(fighterId)}`, "spritesheet.json");

export const strikecraftSpecsheetObjectKey = (
  userId: string,
  fighterId: number,
  extension: string,
) =>
  path.posix.join(
    `users/${userId}/fighters/${String(fighterId)}`,
    `strikecraft-specsheet-image.${extension}`,
  );

export const strikecraftSpriteObjectKey = (userId: string, fighterId: number, extension: string) =>
  path.posix.join(
    `users/${userId}/fighters/${String(fighterId)}`,
    `strikecraft-sprite-top.${extension}`,
  );

export const pipelineStateObjectKey = (userId: string, fighterId: number) =>
  path.posix.join(`users/${userId}/fighters/${String(fighterId)}`, `pipeline-state.json`);

export const agentZipObjectKey = (userId: string, fighterId: number) =>
  path.posix.join(`users/${userId}/fighters/${String(fighterId)}`, `agent.zip`);

export const fighterAgentScriptObjectKey = (userId: string, fighterId: number) =>
  path.posix.join(`users/${userId}/fighters/${String(fighterId)}`, `agent.ts`);

export const fighterAgentVersionScriptObjectKey = (
  userId: string,
  fighterId: number,
  versionNumber: number,
) =>
  path.posix.join(
    `users/${userId}/fighters/${String(fighterId)}`,
    "agents",
    String(versionNumber),
    "agent.ts",
  );

export const fighterCheckpointObjectKey = (
  userId: string,
  fighterId: number,
  simulationId: string,
) =>
  path.posix.join(
    `users/${userId}/fighters/${String(fighterId)}`,
    "checkpoints",
    `${simulationId}.json.gz`,
  );

export const fighterLatestCheckpointObjectKey = (userId: string, fighterId: number) =>
  path.posix.join(`users/${userId}/fighters/${String(fighterId)}`, "checkpoints", "latest.json.gz");

export const simulationReplayObjectKey = (userId: string, simulationId: string) =>
  path.posix.join(`users/${userId}/simulations/${simulationId}`, `replay.json.gz`);

export const simulationBroadcastEventsObjectKey = (userId: string, simulationId: string) =>
  path.posix.join(`users/${userId}/simulations/${simulationId}`, `broadcast-events.ndjson.gz`);

export const battlefieldDescriptionObjectKey = (userId: string, battlefieldId: number) =>
  path.posix.join(
    `users/${userId}/battlefields/${String(battlefieldId)}`,
    "battlefield-description.md",
  );

export const battlefieldSheetPromptObjectKey = (userId: string, battlefieldId: number) =>
  path.posix.join(
    `users/${userId}/battlefields/${String(battlefieldId)}`,
    "battlefield-sheet-gen.md",
  );

export const battlefieldSheetImageObjectKey = (userId: string, battlefieldId: number) =>
  path.posix.join(`users/${userId}/battlefields/${String(battlefieldId)}`, "specsheet.jpeg");

export const battlefieldConfigObjectKey = (userId: string, battlefieldId: number) =>
  path.posix.join(
    `users/${userId}/battlefields/${String(battlefieldId)}`,
    "battlefield-config.json",
  );

export const battlefieldPipelineStateObjectKey = (userId: string, battlefieldId: number) =>
  path.posix.join(
    `users/${userId}/battlefields/${String(battlefieldId)}`,
    "battlefield-pipeline-state.json",
  );

export const putObject = async (key: string, body: Buffer, contentType?: string) => {
  const client = getClient();
  const bucket = getBucket();

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ...(contentType ? { ContentType: contentType } : {}),
    }),
  );
};

export const getObjectBuffer = async (key: string): Promise<Buffer | null> => {
  let result: GetObjectCommandOutput;

  try {
    result = await getClient().send(
      new GetObjectCommand({
        Bucket: getBucket(),
        Key: key,
      }),
    );
  } catch {
    return null;
  }

  if (!result.Body) {
    return null;
  }

  return Buffer.from(await result.Body.transformToByteArray());
};

export const objectExists = async (key: string): Promise<boolean> => {
  try {
    await getClient().send(
      new HeadObjectCommand({
        Bucket: getBucket(),
        Key: key,
      }),
    );
    return true;
  } catch {
    return false;
  }
};

export const getSignedReadUrl = async (key: string, expiresInSeconds = 900) => {
  const command = new GetObjectCommand({
    Bucket: getBucket(),
    Key: key,
  });

  return getSignedUrl(getClient(), command, { expiresIn: expiresInSeconds });
};

export const deleteObjectsByPrefix = async (prefix: string) => {
  const client = getClient();
  const bucket = getBucket();

  let continuationToken: string | undefined;
  do {
    const listed = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      }),
    );

    const keys = (listed.Contents ?? [])
      .map((entry) => entry.Key)
      .filter((value): value is string => typeof value === "string" && value.length > 0);

    if (keys.length > 0) {
      await client.send(
        new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: {
            Objects: keys.map((key) => ({ Key: key })),
            Quiet: true,
          },
        }),
      );
    }

    continuationToken = listed.IsTruncated ? listed.NextContinuationToken : undefined;
  } while (continuationToken);
};
