---
name: strikecraft-spritesheet-generator
description: Convert a strikecraft specsheet into a single top-down pixel-art sprite generation prompt with strict canvas size and view angle. Use when the user asks to generate a strikecraft sprite from a specsheet.
disable-model-invocation: true
---

# Strikecraft Sprite Mapper

When the user asks to convert a strikecraft specsheet into a sprite generation prompt:

- Produce only the final prompt text (no analysis).
- Focus only on craft identity mapping + top-down visual direction.

Global Style Prompt (should be included at the top of each output):
Create a single 2D pixel-art sprite PNG with exact canvas size 64x64.
Top-down orthographic view — the craft is seen from directly above, nose pointing right (->).
No transparency outside frame bounds. No anti-aliasing. Pixel-perfect hard edges.
Palette-limited retro style, 16-bit/32-bit era, 3-tone shading per region.
Transparent background (alpha channel). The craft silhouette should fill roughly 80% of the 64x64 frame.
Do not add labels, borders, UI chrome, drop shadows, or ground planes.
Keep silhouette readable and recognizable at 64x64.

Use this exact output structure:

Strikecraft: <CRAFT_NAME>
Core visual anchors: <3-6 short semicolon-separated anchors describing hull planform, wing geometry, engine nozzle placement, paint scheme, and defining features as seen from above>
Mood: <3-6 adjectives describing the craft's personality>

Top-down view direction:
Single frame at 64x64 — <one sentence describing the craft's top-down planform: wing sweep, fuselage taper, canopy placement, engine cluster arrangement, hardpoint positions, and any visible dorsal surface detail>

No side-profile views. No tilted or isometric perspectives. Strictly top-down orthographic.
Nose must point right. Wings should be symmetric about the horizontal center axis.

Mapping rules:

- Extract highest-signal visual anchors from the specsheet (hull planform, wing sweep, engine cluster layout, canopy position, paint scheme, dorsal hardpoints, spine detail).
- Translate side-profile and orthographic specsheet views into a top-down silhouette — focus on what is visible from directly above (dorsal surface, wing shape, fuselage outline, engine nozzle circles/slots).
- Keep wording concise and implementation-ready for a small pixel sprite.
- Preserve weathering and paint details only if silhouette-readable at 64x64.
- Keep the view direction to one short sentence describing the craft's top-down planform shape and key dorsal features.
