/**
 * One-shot script to generate PFP thumbnails for all existing fighters.
 *
 * Usage:
 *   bun run api/src/scripts/backfill-pfp-thumbnails.ts
 *
 * For each fighter that has a `character-pfp.png` in R2, this will:
 *   1. Download the original PNG.
 *   2. Generate 640×640 and 128×128 WebP thumbnails.
 *   3. Upload them to `thumbs/character-pfp-{size}.webp`.
 *   4. Skip any fighter that already has both thumbnails.
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
} from "../lib/r2";

const PFP_THUMBNAIL_SIZES = [640, 128] as const;

const main = async () => {
  console.log("Starting PFP thumbnail backfill…");

  const allFighters = await db
    .select({
      id: fighters.id,
      userId: fighters.userId,
    })
    .from(fighters)
    .orderBy(desc(fighters.id));

  console.log(`Found ${allFighters.length} fighters to process.`);

  let processed = 0;
  let skipped = 0;
  let generated = 0;
  let failed = 0;

  for (const fighter of allFighters) {
    const label = `fighter #${fighter.id} (user ${fighter.userId})`;

    try {
      // Check if thumbnails already exist
      const existChecks = await Promise.all(
        PFP_THUMBNAIL_SIZES.map((size) =>
          objectExists(characterPfpThumbObjectKey(fighter.userId, fighter.id, size)),
        ),
      );

      if (existChecks.every(Boolean)) {
        skipped += 1;
        processed += 1;
        continue;
      }

      // Download original PNG
      const originalKey = characterPfpObjectKey(fighter.userId, fighter.id, "png");
      const originalBuffer = await getObjectBuffer(originalKey);

      if (!originalBuffer) {
        skipped += 1;
        processed += 1;
        continue;
      }

      // Generate and upload missing thumbnails
      await Promise.all(
        PFP_THUMBNAIL_SIZES.map(async (size, index) => {
          if (existChecks[index]) {
            return; // Already exists
          }

          const thumbBuffer = await generateThumbnailWebp(originalBuffer, size);
          const thumbKey = characterPfpThumbObjectKey(fighter.userId, fighter.id, size);
          await putObject(thumbKey, thumbBuffer, "image/webp");
        }),
      );

      generated += 1;
      processed += 1;

      if (processed % 50 === 0) {
        console.log(
          `Progress: ${processed}/${allFighters.length} (generated: ${generated}, skipped: ${skipped}, failed: ${failed})`,
        );
      }
    } catch (error) {
      failed += 1;
      processed += 1;
      console.error(`Failed for ${label}:`, error instanceof Error ? error.message : error);
    }
  }

  console.log("\nBackfill complete:");
  console.log(`  Total:     ${allFighters.length}`);
  console.log(`  Generated: ${generated}`);
  console.log(`  Skipped:   ${skipped}`);
  console.log(`  Failed:    ${failed}`);

  process.exit(0);
};

void main();
