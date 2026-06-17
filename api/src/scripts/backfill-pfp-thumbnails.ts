/**
 * One-shot script to generate thumbnails for all existing fighters.
 *
 * Covers both PFP (`character-pfp.png`) and strikecraft sprite (`strikecraft-sprite-top.png`).
 *
 * Usage:
 *   bun run api/src/scripts/backfill-pfp-thumbnails.ts
 *
 * For each fighter this will:
 *   1. Check if thumbnails already exist (skip if both sizes present).
 *   2. Download the original PNG from R2.
 *   3. Generate 640×640 and 128×128 WebP thumbnails.
 *   4. Upload them to `thumbs/character-pfp-{size}.webp` / `thumbs/strikecraft-sprite-top-{size}.webp`.
 */

import { db, fighters } from "@ijf/database";
import { desc } from "@ijf/database";

import { generateThumbnailWebp } from "../lib/image-processing";
import {
  characterPfpObjectKey,
  characterPfpThumbObjectKey,
  getObjectBuffer,
  objectExists,
  putObject,
  strikecraftSpriteObjectKey,
  strikecraftSpriteThumbObjectKey,
} from "../lib/r2";

const THUMBNAIL_SIZES = [640, 128] as const;

type AssetSpec = {
  label: string;
  originalKeyBuilder: (userId: string, fighterId: number, ext: string) => string;
  thumbKeyBuilder: (userId: string, fighterId: number, size: number) => string;
};

const ASSET_SPECS: AssetSpec[] = [
  {
    label: "PFP",
    originalKeyBuilder: characterPfpObjectKey,
    thumbKeyBuilder: characterPfpThumbObjectKey,
  },
  {
    label: "Sprite",
    originalKeyBuilder: strikecraftSpriteObjectKey,
    thumbKeyBuilder: strikecraftSpriteThumbObjectKey,
  },
];

const backfillAsset = async (
  spec: AssetSpec,
  fighter: { id: number; userId: string },
): Promise<"generated" | "skipped" | "no-original"> => {
  const existChecks = await Promise.all(
    THUMBNAIL_SIZES.map((size) =>
      objectExists(spec.thumbKeyBuilder(fighter.userId, fighter.id, size)),
    ),
  );

  if (existChecks.every(Boolean)) {
    return "skipped";
  }

  const originalKey = spec.originalKeyBuilder(fighter.userId, fighter.id, "png");
  const originalBuffer = await getObjectBuffer(originalKey);

  if (!originalBuffer) {
    return "no-original";
  }

  await Promise.all(
    THUMBNAIL_SIZES.map(async (size, index) => {
      if (existChecks[index]) {
        return;
      }
      const thumbBuffer = await generateThumbnailWebp(originalBuffer, size);
      const thumbKey = spec.thumbKeyBuilder(fighter.userId, fighter.id, size);
      await putObject(thumbKey, thumbBuffer, "image/webp");
    }),
  );

  return "generated";
};

const main = async () => {
  console.log("Starting thumbnail backfill (PFP + Strikecraft Sprite)…");

  const allFighters = await db
    .select({
      id: fighters.id,
      userId: fighters.userId,
    })
    .from(fighters)
    .orderBy(desc(fighters.id));

  console.log(`Found ${allFighters.length} fighters to process.`);

  const stats: Record<string, { generated: number; skipped: number; failed: number }> = {};
  for (const spec of ASSET_SPECS) {
    stats[spec.label] = { generated: 0, skipped: 0, failed: 0 };
  }

  for (let i = 0; i < allFighters.length; i += 1) {
    const fighter = allFighters[i]!;
    const label = `fighter #${fighter.id} (user ${fighter.userId})`;

    for (const spec of ASSET_SPECS) {
      try {
        const result = await backfillAsset(spec, fighter);
        if (result === "generated") {
          stats[spec.label]!.generated += 1;
        } else {
          stats[spec.label]!.skipped += 1;
        }
      } catch (error) {
        stats[spec.label]!.failed += 1;
        console.error(
          `[${spec.label}] Failed for ${label}:`,
          error instanceof Error ? error.message : error,
        );
      }
    }

    if ((i + 1) % 50 === 0) {
      console.log(`Progress: ${i + 1}/${allFighters.length}`);
    }
  }

  console.log("\nBackfill complete:");
  console.log(`  Total fighters: ${allFighters.length}`);
  for (const spec of ASSET_SPECS) {
    const s = stats[spec.label]!;
    console.log(
      `  [${spec.label}] Generated: ${s.generated}, Skipped: ${s.skipped}, Failed: ${s.failed}`,
    );
  }

  process.exit(0);
};

void main();
