---
name: character-spritesheet-generator
description: Convert character descriptions into a fixed 7-frame pixel-art spritesheet generation prompt with strict canvas, frame coordinates, and pose-acting mapping. Use when the user asks to map a character description to a spritesheet prompt.
disable-model-invocation: true
---

# Agent Spritesheet Mapper

When the user asks to convert a character description into a spritesheet generation prompt:

- Produce only the final prompt text (no analysis).
- Focus only on character identity mapping + pose acting direction.

Global Style Prompt (should be included at the top of each output):
Create a single 2D pixel-art sprite sheet PNG with exact canvas size 448x64 (7:1 aspect ratio, not square).
Use exactly 7 frames in one horizontal row, each frame exactly 64x64, with no gutters, no padding, and no margins.
Frame coordinates are fixed: idle(0,0,64,64), planning(64,0,64,64), attacking(128,0,64,64), hit-target(192,0,64,64), got-hit(256,0,64,64), low-fuel(320,0,64,64), down(384,0,64,64).
Background: every frame shares the SAME single solid flat background color, painted as one uniform fill behind the figure. The model MUST propose exactly one background color (name + HEX) and use it consistently across all 7 frames. Choose a muted, desaturated tone (low-to-mid saturation) that contrasts cleanly with the figure's silhouette so the character reads instantly. Cool muted tones (slate-blue, dusk-teal, ash-violet) and warm muted tones (clay, sand, dusty rose) are both valid; pick whichever fits the character's mood. The background MUST be the same color in all 7 frames, and MUST be visibly different from any large color region on the figure (e.g. don't put a brown jacket on a brown background). Do NOT use transparency (alpha must be fully opaque), gradients, vignettes, drop shadows, ground planes, dithered skies, parallax, lighting effects, or any environment elements. The background must be exactly one flat opaque color and nothing else.
No anti-aliasing. Pixel-perfect hard edges. No sub-pixel rendering.
Modern detailed pixel-art style in the 16/32-bit JRPG / boutique-indie illustration tradition (Eastward, Owlboy, SNK portrait art, Konami MSX2 character screens). Stylized pixel realism, NOT chibi, NOT 8-bit blocky, NOT vector-flat, NOT photorealistic.
Limited indexed palette (~16-24 colors total) skewed to warm earthy tones on the figure (worn leather browns, tan, ochre, muted skin and beard tones, gunmetal grey) so the character pops against the cool slate-blue background.
Shading: 3-4 tones per region (shadow, mid, light, optional accent highlight) with selective dithering only at gradient transitions (jacket folds, cheek-to-jaw, trouser bend). No pillow shading, no soft airbrush, no smooth gradients.
Lighting: consistent directional key light from the upper-left across all 7 frames; cast shadows live inside the silhouette only (no ground shadow).
Outlines: "selective outline" (selout) — use a darker shade of each region's local color along inner edges; the outer silhouette may sit on a 1px line darker than the background so the figure reads cleanly. No uniform pure-black outline.
Framing: full-body character, vertical-standing proportions of roughly 1:5-1:6 head-to-body, centered horizontally inside each 64x64 frame; the top of the head sits near the top of the frame and the feet sit near the bottom edge (~85-95% vertical fill). Same camera distance, same eye-line, same scale across all 7 frames so the figure does not grow or shrink between poses.
Identity continuity: same clothing, same color palette, same facial features (beard, glasses, scars, headgear) in every frame — only the pose, limbs and facial expression change.

Use this exact output structure:

Character: <NAME>
Core visual anchors: <3-6 short semicolon-separated anchors>
Mood: <3-6 adjectives>
Background color: <muted color name> (<#HEX>)

Frame acting direction:

1. idle at x=0 y=0 w=64 h=64 — <direction>
2. planning at x=64 y=0 w=64 h=64 — <direction>
3. attacking at x=128 y=0 w=64 h=64 — <direction>
4. hit-target at x=192 y=0 w=64 h=64 — <direction>
5. got-hit at x=256 y=0 w=64 h=64 — <direction>
6. low-fuel at x=320 y=0 w=64 h=64 — <direction>
7. down at x=384 y=0 w=64 h=64 — <direction>

Do not add labels, borders, UI chrome, frame separators, captions, or extra frames.
Keep silhouette readable at 64x64.

Mapping rules:

- Extract highest-signal visual anchors (silhouette, face/mask, signature gear, notable markings, dominant prop).
- Keep wording concise and implementation-ready for small pixel sprites.
- Map behavior cues into these intents, and prefer expressive whole-body acting (gesture + facial beat) over subtle micro-poses:
  - idle: neutral default stance, arms relaxed at sides, weight evenly distributed.
  - planning: tactical/readiness/intel-gathering — e.g. index finger raised, a beat of "aha", hand to chin, eyes alert.
  - attacking: strike initiation or commitment — e.g. both hands gripping a control stick / weapon, leaning forward into the action.
  - hit-target: successful impact/confirmation beat — e.g. walking forward with a satisfied half-smile, arms loose with momentum.
  - got-hit: recoil/stagger/defensive reaction — e.g. arms thrown forward, torso pulling back, brow furrowed.
  - low-fuel: strained conserving posture — e.g. hands clasped to the head or temples, shoulders raised, eyes wide.
  - down: incapacitated/defeated final state — e.g. bent fully forward, face buried in hands, knees soft.
- If source text has named expressions/actions, map each to the closest required pose.
- Preserve lore cues only if silhouette-readable at 64x64.
- Keep each pose direction to one short sentence.
