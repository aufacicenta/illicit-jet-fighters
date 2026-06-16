import { FIGHTER_PIPELINE_SECTION_ORDER } from "@ijf/shared";

import { decodeImagePayload } from "./image-payload";
import { getImageDimensions, normalizeForStoragePng } from "./image-processing";
import type { PipelineTenant } from "./pipeline-state";
import {
  characterPfpObjectKey,
  getObjectBuffer,
  getSignedReadUrl,
  objectExists,
  putObject,
  specsheetObjectKey,
  spritesheetImageObjectKey,
  spritesheetManifestObjectKey,
  strikecraftSpecsheetObjectKey,
  strikecraftSpriteObjectKey,
} from "./r2";
import type { FighterSectionId as SectionId, SectionOutput } from "./types";

const stepOrder: SectionId[] = FIGHTER_PIPELINE_SECTION_ORDER;

const imageSections = new Set<SectionId>([
  "character-pfp-image",
  "specsheet-image",
  "spritesheet-image",
  "strikecraft-specsheet-image",
  "strikecraft-sprite-image",
]);

export const assetBackedSections = new Set<SectionId>([...imageSections, "spritesheet-manifest"]);

export const imageObjectKeyBuilders = {
  "character-pfp-image": characterPfpObjectKey,
  "specsheet-image": specsheetObjectKey,
  "spritesheet-image": spritesheetImageObjectKey,
  "strikecraft-specsheet-image": strikecraftSpecsheetObjectKey,
  "strikecraft-sprite-image": strikecraftSpriteObjectKey,
} as const;

export const isImageSection = (
  sectionId: SectionId,
): sectionId is keyof typeof imageObjectKeyBuilders => imageSections.has(sectionId);

const getCanonicalAssetObjectKey = (
  sectionId: SectionId,
  tenant: PipelineTenant,
): string | null => {
  if (sectionId === "spritesheet-manifest") {
    return spritesheetManifestObjectKey(tenant.userId, tenant.fighterId);
  }
  if (isImageSection(sectionId)) {
    return imageObjectKeyBuilders[sectionId](tenant.userId, tenant.fighterId, "png");
  }
  return null;
};

const getAssetSectionMimeType = (sectionId: SectionId): string | undefined => {
  if (sectionId === "spritesheet-manifest") {
    return "application/json";
  }
  if (isImageSection(sectionId)) {
    return "image/png";
  }
  return undefined;
};

export const sanitizeSectionOutput = async (
  sectionId: SectionId,
  output: SectionOutput,
): Promise<SectionOutput> => {
  if (!assetBackedSections.has(sectionId)) {
    const { assetUrl: _discard, ...rest } = output;
    return rest;
  }

  if (output.content.startsWith("http://") || output.content.startsWith("https://")) {
    const { assetUrl: _discard, ...rest } = output;
    return { ...rest, assetUrl: output.content };
  }

  try {
    const signed = await getSignedReadUrl(output.content);
    const { assetUrl: _discard, ...rest } = output;
    return { ...rest, content: signed, assetUrl: signed };
  } catch {
    return output;
  }
};

export const sanitizeOutputs = async (
  outputs: Partial<Record<SectionId, SectionOutput>>,
): Promise<Partial<Record<SectionId, SectionOutput>>> => {
  const next: Partial<Record<SectionId, SectionOutput>> = {};
  for (const sectionId of stepOrder) {
    const output = outputs[sectionId];
    if (!output) {
      continue;
    }
    next[sectionId] = await sanitizeSectionOutput(sectionId, output);
  }

  return next;
};

export const reconcileAssetBackedOutputs = async ({
  outputs,
  tenant,
}: {
  outputs: Partial<Record<SectionId, SectionOutput>>;
  tenant: PipelineTenant;
}): Promise<Partial<Record<SectionId, SectionOutput>>> => {
  const reconciled: Partial<Record<SectionId, SectionOutput>> = { ...outputs };

  for (const sectionId of stepOrder) {
    if (!assetBackedSections.has(sectionId)) {
      continue;
    }

    const currentOutput = reconciled[sectionId];
    const candidateKeys: string[] = [];
    if (currentOutput?.content && !currentOutput.content.startsWith("http")) {
      candidateKeys.push(currentOutput.content);
    }

    const canonicalKey = getCanonicalAssetObjectKey(sectionId, tenant);
    if (canonicalKey && !candidateKeys.includes(canonicalKey)) {
      candidateKeys.push(canonicalKey);
    }

    let resolvedObjectKey: string | null = null;
    for (const key of candidateKeys) {
      if (await objectExists(key)) {
        resolvedObjectKey = key;
        break;
      }
    }

    if (!resolvedObjectKey) {
      delete reconciled[sectionId];
      continue;
    }

    reconciled[sectionId] = {
      sectionId,
      content: resolvedObjectKey,
      generatedAt: currentOutput?.generatedAt ?? new Date().toISOString(),
      model: currentOutput?.model ?? "storage-recovered",
      mimeType: currentOutput?.mimeType ?? getAssetSectionMimeType(sectionId),
    };
  }

  return reconciled;
};

export const resolveStoredImageForManifest = async (
  objectKey: string | undefined,
): Promise<{ signedUrl: string; width: number; height: number } | null> => {
  if (!objectKey || objectKey.startsWith("http")) {
    return null;
  }

  const buffer = await getObjectBuffer(objectKey);
  if (!buffer) {
    return null;
  }

  const { width, height } = await getImageDimensions(buffer);
  const signedUrl = await getSignedReadUrl(objectKey);
  return { signedUrl, width, height };
};

export const commitImageAsset = async ({
  tenant,
  sectionId,
  mimeTypeHint,
  imageUrl,
  objectKeyBuilder,
  requireTransparentBackground,
}: {
  tenant: PipelineTenant;
  sectionId: SectionId;
  mimeTypeHint: string;
  imageUrl: string;
  objectKeyBuilder: (userId: string, fighterId: number, extension: string) => string;
  requireTransparentBackground: boolean;
}): Promise<{ objectKey: string; signedUrl: string; width: number; height: number }> => {
  const { buffer } = await decodeImagePayload(imageUrl, mimeTypeHint);
  const normalized = await normalizeForStoragePng({
    sourceBuffer: buffer,
    sectionLabel: sectionId,
    requireTransparentBackground,
  });
  const extension = "png";
  const objectKey = objectKeyBuilder(tenant.userId, tenant.fighterId, extension);
  await putObject(objectKey, normalized.buffer, normalized.mimeType);
  const signedUrl = await getSignedReadUrl(objectKey);
  const { width, height } = await getImageDimensions(normalized.buffer);
  return { objectKey, signedUrl, width, height };
};
