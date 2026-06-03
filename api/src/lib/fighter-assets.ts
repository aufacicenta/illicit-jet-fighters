import { characterPfpObjectKey, getSignedReadUrl, objectExists } from "./r2";

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
