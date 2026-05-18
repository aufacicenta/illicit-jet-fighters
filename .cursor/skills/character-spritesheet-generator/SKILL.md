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
No transparency outside frame bounds. No anti-aliasing. Pixel-perfect hard edges.
Palette-limited retro style, 16-bit/32-bit era, 3-tone shading per region.

Use this exact output structure:

Character: <NAME>
Core visual anchors: <3-6 short semicolon-separated anchors>
Mood: <3-6 adjectives>

Frame acting direction:
1) idle at x=0 y=0 w=64 h=64 — <direction>
2) planning at x=64 y=0 w=64 h=64 — <direction>
3) attacking at x=128 y=0 w=64 h=64 — <direction>
4) hit-target at x=192 y=0 w=64 h=64 — <direction>
5) got-hit at x=256 y=0 w=64 h=64 — <direction>
6) low-fuel at x=320 y=0 w=64 h=64 — <direction>
7) down at x=384 y=0 w=64 h=64 — <direction>

Do not add labels, borders, UI chrome, or extra frames.
Keep silhouette readable at 64x64.

Mapping rules:

- Extract highest-signal visual anchors (silhouette, face/mask, signature gear, notable markings, dominant prop).
- Keep wording concise and implementation-ready for small pixel sprites.
- Map behavior cues into these intents:
  - idle: neutral default stance
  - planning: tactical/readiness/intel-gathering
  - attacking: strike initiation or commitment
  - hit-target: successful impact/confirmation beat
  - got-hit: recoil/stagger/defensive reaction
  - low-fuel: strained conserving posture
  - down: incapacitated/defeated final state
- If source text has named expressions/actions, map each to the closest required pose.
- Preserve lore cues only if silhouette-readable at 64x64.
- Keep each pose direction to one short sentence.
