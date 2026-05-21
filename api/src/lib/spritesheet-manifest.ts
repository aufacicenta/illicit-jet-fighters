import type { SpriteFrame, SpritePoseKey, SpritesheetManifest } from "@ijf/shared/simulation";

const poseKeys: SpritePoseKey[] = [
  "idle",
  "planning",
  "attacking",
  "hit-target",
  "got-hit",
  "low-fuel",
  "down",
];

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const toInteger = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value);
  }
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) {
      return Math.round(parsed);
    }
  }
  return null;
};

const parseJsonObject = (raw: string): Record<string, unknown> => {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Try fenced payload extraction below.
  }

  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (!fenceMatch?.[1]) {
    throw new Error("Manifest mapper returned invalid JSON.");
  }
  const parsed = JSON.parse(fenceMatch[1]) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Manifest mapper returned invalid JSON object.");
  }
  return parsed as Record<string, unknown>;
};

const normalizeFrame = (
  rawFrame: unknown,
  sheetWidth: number,
  sheetHeight: number,
): SpriteFrame | null => {
  if (!rawFrame || typeof rawFrame !== "object" || Array.isArray(rawFrame)) {
    return null;
  }
  const asRecord = rawFrame as Record<string, unknown>;
  const rawX = toInteger(asRecord.x);
  const rawY = toInteger(asRecord.y);
  const rawW = toInteger(asRecord.w);
  const rawH = toInteger(asRecord.h);
  if (rawX === null || rawY === null || rawW === null || rawH === null) {
    return null;
  }

  const x = clamp(rawX, 0, Math.max(0, sheetWidth - 1));
  const y = clamp(rawY, 0, Math.max(0, sheetHeight - 1));
  const maxWidth = Math.max(1, sheetWidth - x);
  const maxHeight = Math.max(1, sheetHeight - y);
  const w = clamp(rawW, 1, maxWidth);
  const h = clamp(rawH, 1, maxHeight);

  return { x, y, w, h };
};

export const normalizeSpritesheetManifest = ({
  raw,
  sheetWidth,
  sheetHeight,
}: {
  raw: string;
  sheetWidth: number;
  sheetHeight: number;
}): SpritesheetManifest => {
  const parsed = parseJsonObject(raw);
  const rawPoses =
    parsed.poses && typeof parsed.poses === "object" && !Array.isArray(parsed.poses)
      ? (parsed.poses as Record<string, unknown>)
      : {};

  const poses = {} as Record<SpritePoseKey, SpriteFrame>;
  for (const pose of poseKeys) {
    const frame = normalizeFrame(rawPoses[pose], sheetWidth, sheetHeight);
    if (!frame) {
      throw new Error(`Spritesheet manifest is missing a valid frame for "${pose}".`);
    }
    poses[pose] = frame;
  }

  return {
    schemaVersion: 1,
    image: "spritesheet-image.png",
    sheetWidth,
    sheetHeight,
    poses,
  };
};
