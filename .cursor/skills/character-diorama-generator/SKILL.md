You are generating an image prompt for a character 3D diorama figurine.

Take a character description markdown document and output one continuous prompt for an image model.
Output plain text only (no markdown fences, no analysis).

## Template

A hyper-detailed full-body 3D diorama figurine of {CHARACTER_NAME}, "{TITLE}", isolated on a minimal circular {BASE_MATERIAL} pedestal. Full body visible head to boots: {CHARACTER_DESCRIPTION}: {BODY_TYPE}, {SKIN_DETAIL}, {FACIAL_FEATURES}, wearing {OUTFIT_DESCRIPTION} with {FOOTWEAR} clearly visible. Posed in a {SIGNATURE_POSE} conveying {POSE_EMOTION}. Key accessories: {ACCESSORY_1}, {ACCESSORY_2}, {ACCESSORY_3}. The figurine has pixel-art surface treatment with voxel geometry, hard edges, chunky indexed-color textures with dithered shading. Subtle {ATMOSPHERIC_ACCENT} emanates from the base as a thin atmospheric effect. Color palette: {COLOR_PALETTE}. Personal symbol {PERSONAL_SYMBOL} subtly engraved into the pedestal rim. Full-body framing from head to feet with no cropping. Shot with a macro lens, shallow depth of field, soft volumetric studio lighting, 8k resolution, tilt-shift photography style, 2:3 aspect ratio. Isolated on transparent background with no backdrop — the figurine floats on a pure alpha-channel void (PNG RGBA output).

## Prompt style requirements

- 3D figurine diorama with pixel-art surface treatment: voxel geometry, hard edges, no anti-aliasing on textures.
- Tilt-shift macro photography feel: the figurine is a physical miniature floating in empty space.
- Full-body composition: the entire figure from head to feet is visible and dominates the frame, no terrain or environment beyond a thin pedestal. Never crop at the waist or knees.
- Pose communicates personality and combat role — not a generic T-pose or idle stance.
- Pixel textures mapped onto 3D forms — chunky, indexed-color surfaces with dithered shading.
- Minimal atmospheric accent (a wisp, glow, or particle trail) hinting at the character's element or energy, but never a full scene.
- **No background**: rendered against a completely transparent (alpha) backdrop — no desk, no horizon, no gradient, no environment. Output as PNG with alpha channel.

## Derivation rules

- Fill every `{PLACEHOLDER}` from the source character description. Infer if missing, but stay consistent with the character's established aesthetic.
- {CHARACTER_NAME} — the pilot/agent name.
- {TITLE} — their subtitle or epithet.
- {BASE_MATERIAL} — derive from dominant color palette or character theme (obsidian, brushed gold, crystal, mahogany, etc.).
- {CHARACTER_DESCRIPTION} — age, ethnicity, build in brief factual terms.
- {BODY_TYPE} — physique and stature.
- {SKIN_DETAIL} — skin tone description.
- {FACIAL_FEATURES} — the most distinctive facial traits (beard, scars, eyes, etc.).
- {OUTFIT_DESCRIPTION} — full outfit from the character sheet, condensed, head to toe.
- {FOOTWEAR} — boots, shoes, or leg armor from the TURNAROUND or OUTFIT DETAILS section.
- {SIGNATURE_POSE} — pick the single most iconic standing or action pose from the HERO POSE or ACTION POSES section. Must show the full body.
- {POSE_EMOTION} — the emotional read of that pose.
- {ACCESSORY_1/2/3} — the three most visually striking gear items or weapons.
- {ATMOSPHERIC_ACCENT} — a subtle energy, particle, or glow derived from the character's combat style or personality.
- {COLOR_PALETTE} — hex values from the COLOR PALETTE section.
- {PERSONAL_SYMBOL} — from the PERSONAL SYMBOL section.
- Preserve named strikecraft and callsigns when referencing accessories.
- Emphasize silhouette readability — the figurine should be instantly recognizable at thumbnail scale.

## Output format

- PNG with alpha transparency (RGBA). No solid background color.
- The generated prompt must explicitly request "isolated on transparent background" or equivalent phrasing so the image model omits any backdrop.

Output is a single prompt block that can be pasted directly into an image generation tool.
