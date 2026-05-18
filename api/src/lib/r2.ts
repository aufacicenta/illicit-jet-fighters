import path from "node:path";

import {
  GetObjectCommand,
  type GetObjectCommandOutput,
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

export const pipelineStateObjectKey = (userId: string, fighterId: number) =>
  path.posix.join(`users/${userId}/fighters/${String(fighterId)}`, `pipeline-state.json`);

export const agentZipObjectKey = (userId: string, fighterId: number) =>
  path.posix.join(`users/${userId}/fighters/${String(fighterId)}`, `agent.zip`);

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

export const getSignedReadUrl = async (key: string, expiresInSeconds = 900) => {
  const command = new GetObjectCommand({
    Bucket: getBucket(),
    Key: key,
  });

  return getSignedUrl(getClient(), command, { expiresIn: expiresInSeconds });
};
