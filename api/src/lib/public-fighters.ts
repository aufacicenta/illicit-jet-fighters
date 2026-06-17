import type { PublicFighter, PublicFighterDetail } from "@ijf/shared";
import { parseFighterNameAndEpithet, resolveFighterName } from "@ijf/shared";

import type { PublicGalleryFighterRecord } from "./fighter-access";
import { getFighterForPublicGallery, listFightersForPublicGallery } from "./fighter-access";
import {
  characterPfpObjectKey,
  characterPfpThumbObjectKey,
  getObjectBuffer,
  getSignedReadUrl,
  objectExists,
  pipelineStateObjectKey,
  specsheetObjectKey,
  strikecraftSpecsheetObjectKey,
  strikecraftSpriteObjectKey,
} from "./r2";
import type { SectionOutput } from "./types";

const PUBLIC_ASSET_URL_TTL_SECONDS = 3600;
const GALLERY_SCAN_BATCH_SIZE = 120;
const IMAGE_EXTENSIONS = ["png", "jpeg", "jpg", "webp"] as const;

type PipelineOutputs = Partial<Record<string, SectionOutput>>;

const resolveFirstExistingObjectKey = async (keys: string[]): Promise<string | null> => {
  for (const key of keys) {
    if (await objectExists(key)) {
      return key;
    }
  }

  return null;
};

const extensionKeys = (
  keyBuilder: (userId: string, fighterId: number, extension: string) => string,
  userId: string,
  fighterId: number,
) => IMAGE_EXTENSIONS.map((extension) => keyBuilder(userId, fighterId, extension));

const resolveSignedAssetUrl = async (keys: string[]): Promise<string | null> => {
  const objectKey = await resolveFirstExistingObjectKey(keys);
  if (!objectKey) {
    return null;
  }

  return getSignedReadUrl(objectKey, PUBLIC_ASSET_URL_TTL_SECONDS);
};

const resolveSignedAssetUrlFromOutput = async (
  output: SectionOutput | undefined,
  fallbackKeys: string[],
): Promise<string | null> => {
  if (output?.content) {
    if (output.content.startsWith("http://") || output.content.startsWith("https://")) {
      return output.content;
    }

    if (await objectExists(output.content)) {
      return getSignedReadUrl(output.content, PUBLIC_ASSET_URL_TTL_SECONDS);
    }
  }

  return resolveSignedAssetUrl(fallbackKeys);
};

const loadPipelineOutputs = async (
  userId: string,
  fighterId: number,
): Promise<PipelineOutputs | null> => {
  const raw = await getObjectBuffer(pipelineStateObjectKey(userId, fighterId));
  if (!raw) {
    return null;
  }

  try {
    const snapshot = JSON.parse(raw.toString()) as { outputs?: PipelineOutputs };
    return snapshot.outputs ?? null;
  } catch {
    return null;
  }
};

const buildPublicFighterBase = async (
  fighter: PublicGalleryFighterRecord,
  outputs: PipelineOutputs | null,
): Promise<PublicFighter | null> => {
  const pfpUrl = await resolveSignedAssetUrl(
    extensionKeys(characterPfpObjectKey, fighter.userId, fighter.id),
  );

  if (!pfpUrl) {
    return null;
  }

  const [pfpGridUrl, pfpAvatarUrl] = await Promise.all(
    ([640, 128] as const).map(async (size) => {
      const thumbKey = characterPfpThumbObjectKey(fighter.userId, fighter.id, size);
      if (await objectExists(thumbKey)) {
        return getSignedReadUrl(thumbKey, PUBLIC_ASSET_URL_TTL_SECONDS);
      }
      return null;
    }),
  );

  const characterDescription = outputs?.["character-description"]?.content ?? null;
  const parsedIdentity = parseFighterNameAndEpithet(characterDescription);
  const spriteUrl = await resolveSignedAssetUrl(
    extensionKeys(strikecraftSpriteObjectKey, fighter.userId, fighter.id),
  );

  return {
    id: fighter.id,
    slug: fighter.slug,
    name: resolveFighterName({
      storedName: fighter.name,
      characterDescription,
      slug: fighter.slug,
    }),
    epithet: parsedIdentity.epithet,
    pfpUrl,
    pfpGridUrl,
    pfpAvatarUrl,
    spriteUrl,
    wins: 0,
    balanceNative: "0",
    createdAt: fighter.createdAt.toISOString(),
  };
};

export const buildPublicFighterDetail = async (
  fighterId: number,
): Promise<PublicFighterDetail | null> => {
  const fighter = await getFighterForPublicGallery(fighterId);
  if (!fighter) {
    return null;
  }

  const outputs = await loadPipelineOutputs(fighter.userId, fighter.id);
  const base = await buildPublicFighterBase(fighter, outputs);
  if (!base) {
    return null;
  }

  const specsheetImageUrl = await resolveSignedAssetUrlFromOutput(
    outputs?.["specsheet-image"],
    extensionKeys(specsheetObjectKey, fighter.userId, fighter.id),
  );
  const strikecraftSpecsheetImageUrl = await resolveSignedAssetUrlFromOutput(
    outputs?.["strikecraft-specsheet-image"],
    extensionKeys(strikecraftSpecsheetObjectKey, fighter.userId, fighter.id),
  );

  return {
    ...base,
    briefing: fighter.briefing,
    specsheetImageUrl,
    strikecraftSpecsheetImageUrl,
  };
};

export const listPublicFighters = async ({
  sort,
  limit,
  offset,
}: {
  sort: "latest" | "wins";
  limit: number;
  offset: number;
}): Promise<PublicFighter[]> => {
  const scanLimit = Math.max(limit + offset, GALLERY_SCAN_BATCH_SIZE);
  const candidates = await listFightersForPublicGallery({ limit: scanLimit });

  const hydrated = (
    await Promise.all(
      candidates.map(async (fighter) => {
        const outputs = await loadPipelineOutputs(fighter.userId, fighter.id);
        return buildPublicFighterBase(fighter, outputs);
      }),
    )
  ).filter((fighter): fighter is PublicFighter => fighter !== null);

  const sorted =
    sort === "wins"
      ? [...hydrated].sort((left, right) => {
          if (right.wins !== left.wins) {
            return right.wins - left.wins;
          }

          return right.createdAt.localeCompare(left.createdAt);
        })
      : hydrated;

  return sorted.slice(offset, offset + limit);
};
