import {
  characterPfpObjectKey,
  characterPfpThumbObjectKey,
  getSignedReadUrl,
  objectExists,
  strikecraftSpriteObjectKey,
  strikecraftSpriteThumbObjectKey,
} from "./r2";

const PUBLIC_ASSET_URL_TTL_SECONDS = 3600;
const IMAGE_EXTENSIONS = ["png", "jpeg", "jpg", "webp"] as const;

const extensionKeys = (
  keyBuilder: (userId: string, fighterId: number, extension: string) => string,
  userId: string,
  fighterId: number,
) => IMAGE_EXTENSIONS.map((extension) => keyBuilder(userId, fighterId, extension));

const resolveFirstExistingObjectKey = async (keys: string[]): Promise<string | null> => {
  for (const key of keys) {
    if (await objectExists(key)) {
      return key;
    }
  }

  return null;
};

const resolveSignedAssetUrl = async (keys: string[]): Promise<string | null> => {
  const objectKey = await resolveFirstExistingObjectKey(keys);
  if (!objectKey) {
    return null;
  }

  return getSignedReadUrl(objectKey, PUBLIC_ASSET_URL_TTL_SECONDS);
};

export const resolveOwnedFighterPfpUrl = async (
  userId: string,
  fighterId: number,
): Promise<string | null> =>
  resolveSignedAssetUrl(extensionKeys(characterPfpObjectKey, userId, fighterId));

export const resolveOwnedFighterSpriteUrl = async (
  userId: string,
  fighterId: number,
): Promise<string | null> =>
  resolveSignedAssetUrl(extensionKeys(strikecraftSpriteObjectKey, userId, fighterId));

export const resolveOwnedFighterSpriteThumbnailUrls = async (
  userId: string,
  fighterId: number,
): Promise<{ grid: string | null; avatar: string | null }> => {
  const gridKey = strikecraftSpriteThumbObjectKey(userId, fighterId, 640);
  const avatarKey = strikecraftSpriteThumbObjectKey(userId, fighterId, 128);
  const [gridExists, avatarExists] = await Promise.all([
    objectExists(gridKey),
    objectExists(avatarKey),
  ]);
  return {
    grid: gridExists ? await getSignedReadUrl(gridKey, PUBLIC_ASSET_URL_TTL_SECONDS) : null,
    avatar: avatarExists ? await getSignedReadUrl(avatarKey, PUBLIC_ASSET_URL_TTL_SECONDS) : null,
  };
};

export const resolveOwnedFighterPfpThumbnailUrls = async (
  userId: string,
  fighterId: number,
): Promise<{ grid: string | null; avatar: string | null }> => {
  const gridKey = characterPfpThumbObjectKey(userId, fighterId, 640);
  const avatarKey = characterPfpThumbObjectKey(userId, fighterId, 128);
  const [gridExists, avatarExists] = await Promise.all([
    objectExists(gridKey),
    objectExists(avatarKey),
  ]);
  return {
    grid: gridExists ? await getSignedReadUrl(gridKey, PUBLIC_ASSET_URL_TTL_SECONDS) : null,
    avatar: avatarExists ? await getSignedReadUrl(avatarKey, PUBLIC_ASSET_URL_TTL_SECONDS) : null,
  };
};
