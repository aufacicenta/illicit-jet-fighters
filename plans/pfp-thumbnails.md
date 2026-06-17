# PFP Thumbnail Generation

## Problem

Every PFP consumer — grid cells, detail drawers, wizard preview, terminal rows, pool-entry avatars — receives the **full-resolution original** PNG from R2 (~1024×1024 from the image generator). There is no resizing, no `srcset`, no lazy-loading, and the dormant `VITE_IMAGE_CDN_URL` env var is not wired up for transforms. This wastes bandwidth, especially on mobile where grid cells render at ≤160px.

## Current Architecture

### R2 Storage

- **Single bucket** configured via `R2_BUCKET` env var (`api/src/config/env.ts`).
- Object key pattern (PFP): `users/{userId}/fighters/{fighterId}/character-pfp.png`
- Key builder: `characterPfpObjectKey` in `api/src/lib/r2.ts:60-61`.
- All fighter images are normalized to PNG via `normalizeForStoragePng` (sharp) in `api/src/lib/image-processing.ts`.

### Upload Flow

1. Image generator → base64
2. `decodeImagePayload` → Buffer (`api/src/lib/image-payload.ts`)
3. `normalizeForStoragePng` → PNG Buffer (`api/src/lib/image-processing.ts`)
4. `putObject(objectKey, buffer, "image/png")` → R2 (`api/src/lib/r2.ts`)
5. `getSignedReadUrl(objectKey)` → pre-signed URL (15 min TTL)

Orchestrated by `commitImageAsset` in `api/src/lib/pipeline-assets.ts:172-199`.

### Serving Flow

- **Public gallery**: `fighter-assets.ts` → `resolveOwnedFighterPfpUrl` tries extensions `[png, jpeg, jpg, webp]` via `objectExists` (HeadObject) → `getSignedReadUrl` (1 hr TTL).
- **Wizard (pipeline)**: signed URL returned directly from `commitImageAsset` and sent via WebSocket as `assetUrl`.

### PublicFighter Type

```ts
// shared/src/schemas/api/fighters.ts
{
  id: number;
  slug: string;
  name: string | null;
  epithet: string | null;
  pfpUrl: string | null;     // pre-signed R2 URL
  spriteUrl: string | null;
  wins: number;
  balanceNative: string;
  createdAt: string;
}
```

## Consumer Analysis

| Consumer | File | Rendered Size | 2× Retina |
|----------|------|---------------|-----------|
| `FighterGridCell` | `jet-arena/src/pages/home/FighterGridCell.tsx` | up to ~310×310 | ~620×620 |
| `FighterDetailDrawer` | `jet-arena/src/pages/home/FighterDetailDrawer.tsx` | 320×320 | 640×640 |
| `ProfilePictureSection` | `jet-arena/src/pages/wizard/sections/ProfilePictureSection.tsx` | 320×320 | 640×640 |
| `FighterAccordionRow` | `jet-arena/src/pages/terminal/components/FighterAccordionRow.tsx` | 96×96 | 192×192 |
| `EnterPoolSheet` | `jet-arena/src/pages/terminal/components/EnterPoolSheet.tsx` | 56×56 | 112×112 |

## Thumbnail Sizes

Two sizes cover all consumers with comfortable retina support:

| Name | Dimensions | Format | Consumers |
|------|-----------|--------|-----------|
| **grid** | 640×640 | WebP | `FighterGridCell`, `FighterDetailDrawer`, `ProfilePictureSection` |
| **avatar** | 128×128 | WebP | `FighterAccordionRow`, `EnterPoolSheet` |

WebP yields ~60-70% smaller files than PNG at equivalent quality and is supported in all target browsers.

## R2 Object Key Pattern

Extend the existing pattern with a `thumbs/` prefix:

```
users/{userId}/fighters/{fighterId}/thumbs/character-pfp-640.webp
users/{userId}/fighters/{fighterId}/thumbs/character-pfp-128.webp
```

## Implementation Plan

### Phase 1: Backend — Thumbnail Generation on Upload

**Files to modify:**

#### 1. `api/src/lib/r2.ts` — New key builder

```ts
export const characterPfpThumbObjectKey = (
  userId: string,
  fighterId: number,
  size: number,
) =>
  path.posix.join(
    `users/${userId}/fighters/${String(fighterId)}`,
    `thumbs/character-pfp-${size}.webp`,
  );
```

#### 2. `api/src/lib/image-processing.ts` — New resize + WebP helper

```ts
export const generateThumbnailWebp = async (
  sourceBuffer: Buffer,
  size: number,
  quality?: number,
): Promise<Buffer> => {
  return sharp(sourceBuffer, { failOn: "none" })
    .resize(size, size, { fit: "cover", position: "centre" })
    .webp({ quality: quality ?? 82 })
    .toBuffer();
};
```

`sharp` is already a dependency — no new packages needed.

#### 3. `api/src/lib/pipeline-assets.ts` — Generate thumbnails inside `commitImageAsset`

After the existing `putObject` call for the full-size PNG, generate and upload both thumbnail sizes:

```ts
const PFP_THUMBNAIL_SIZES = [640, 128] as const;

// inside commitImageAsset, after putObject for the original:
if (sectionId === "character-pfp-image") {
  await Promise.all(
    PFP_THUMBNAIL_SIZES.map(async (size) => {
      const thumbBuffer = await generateThumbnailWebp(normalized.buffer, size);
      const thumbKey = characterPfpThumbObjectKey(tenant.userId, tenant.fighterId, size);
      await putObject(thumbKey, thumbBuffer, "image/webp");
    }),
  );
}
```

#### 4. `api/src/lib/fighter-assets.ts` — Resolve thumbnail URLs

Add a new resolver that returns thumbnail URLs alongside the original:

```ts
export const resolveOwnedFighterPfpThumbnailUrls = async (
  userId: string,
  fighterId: number,
): Promise<{ grid: string | null; avatar: string | null }> => {
  const [gridKey, avatarKey] = [640, 128].map((size) =>
    characterPfpThumbObjectKey(userId, fighterId, size),
  );
  const [gridExists, avatarExists] = await Promise.all([
    objectExists(gridKey),
    objectExists(avatarKey),
  ]);
  return {
    grid: gridExists
      ? await getSignedReadUrl(gridKey, PUBLIC_ASSET_URL_TTL_SECONDS)
      : null,
    avatar: avatarExists
      ? await getSignedReadUrl(avatarKey, PUBLIC_ASSET_URL_TTL_SECONDS)
      : null,
  };
};
```

### Phase 2: Schema — Expose Thumbnail URLs

**Files to modify:**

#### 5. `shared/src/schemas/api/fighters.ts` — Extend PublicFighter

Add optional thumbnail fields (optional so old fighters without thumbnails still pass validation):

```ts
export const publicFighterSchema = z.object({
  // ... existing fields ...
  pfpGridUrl: z.string().url().nullable().optional(),   // 640px
  pfpAvatarUrl: z.string().url().nullable().optional(), // 128px
});
```

#### 6. `api/src/lib/public-fighters.ts` — Populate thumbnail URLs

In `buildPublicFighterBase`, resolve and attach thumbnail URLs alongside the existing `pfpUrl`.

### Phase 3: Frontend — Consume Thumbnails

**Files to modify:**

#### 7. `jet-arena/src/pages/home/FighterGridCell.tsx`

Use `fighter.pfpGridUrl ?? fighter.pfpUrl` as the image `src`. This gracefully falls back if thumbnails haven't been generated yet (pre-existing fighters).

#### 8. `jet-arena/src/pages/wizard/sections/ProfilePictureSection.tsx`

The wizard uses `imageOutput.assetUrl` directly from the pipeline WebSocket. Two options:

- **Option A**: Have `commitImageAsset` return thumbnail signed URLs alongside the original, include them in the WebSocket `output` payload, and use the grid URL here.
- **Option B**: Continue using the original URL in the wizard (it's a one-time generation view, not a gallery). The full PNG is fine here.

**Recommended: Option B** — minimal change, and the wizard is not a bandwidth-sensitive context.

#### 9. `jet-arena/src/pages/terminal/components/FighterAccordionRow.tsx`

Use `fighter.pfpAvatarUrl ?? fighter.pfpUrl` for the 96×96 thumbnail.

#### 10. `jet-arena/src/pages/terminal/components/EnterPoolSheet.tsx`

Use `fighter.pfpAvatarUrl ?? fighter.pfpUrl` for the 56×56 avatar.

### Phase 4: Backfill Existing Fighters

Create a one-shot script (e.g. `api/src/scripts/backfill-pfp-thumbnails.ts`) that:

1. Lists all fighters from the database.
2. For each fighter, checks if `character-pfp.png` exists in R2.
3. Downloads the original, generates both thumbnails, uploads them.
4. Logs progress and any failures.

This can be run via `bun run api/src/scripts/backfill-pfp-thumbnails.ts` after deployment.

## Migration / Rollout Notes

- **No database migration required** — thumbnails are R2 objects, not DB columns. The new schema fields are optional.
- **Backward-compatible** — all frontend code uses `pfpGridUrl ?? pfpUrl` fallback, so old fighters without thumbnails render normally.
- **Deploy order**: Backend first (starts generating thumbnails for new fighters) → backfill script → frontend update (starts consuming thumbnails).
- **R2 cost**: +2 small objects per fighter. At 128px WebP (~3-5 KB) and 640px WebP (~25-40 KB), this is negligible.

## Open Questions

1. **Should we also thumbnail specsheet/strikecraft images?** They appear in similar size contexts but are less frequently loaded.
2. **Should we add `loading="lazy"` to grid cell images?** Orthogonal to thumbnails but would further improve perceived performance.
3. **Should the backfill script run as a migration or a manual script?** A manual script is safer and gives more control over retries.
