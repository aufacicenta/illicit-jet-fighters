---
name: agent-character-sheet
description: Generate an image-generation prompt for a full character reference sheet from a character description. Use when the user asks to create a character sheet, reference sheet, concept sheet, or character design sheet for a jet-arena agent or any character.
disable-model-invocation: true
---

# Agent Character Sheet

Convert a character description into a single image-generation prompt that produces a full character reference sheet — a concept-art layout with hero pose, expressions, turnaround, strikecraft/companion, weapons, action poses, outfit details, color palette, and personal symbol.

## Layout Anatomy

The output prompt describes a landscape reference sheet with these fixed sections:

| Section | Position | Content |
|---------|----------|---------|
| Hero Pose | Large, left ~40% | Full-body signature illustration establishing mood and identity |
| Name / Title Block | Top-left overlay | Stylized name, epithet, short lore blurb |
| Expressions | Top center, row | 4 head-and-shoulder busts with emotion labels |
| Turnaround | Center, row | 4 full-body orthographic views (front / ¾ / side / back) |
| Strikecraft or Companion | Top right | Side-profile study of jet, vehicle, or companion creature |
| Strikecraft / Companion Actions | Below craft, row | 4 small action thumbnails with labels |
| Weapons & Gear | Right middle | 4-5 isolated item callouts with labels |
| Outfit Details | Bottom left | 3 zoomed close-ups of key design elements with labels |
| Action Poses | Bottom center | 2 dynamic scenes showing character in motion |
| Color Palette | Bottom right | 5 hex-value color swatches in a row |
| Personal Symbol | Bottom right corner | Emblem or logo for the character |

## Global Style Prefix

Begin every output prompt with this prefix (read from `prompts/agent-character-sheet-global-style.md` if present, otherwise use the default below):

```
[GLOBAL PREFIX]
```

The global prefix establishes the art style. Substitute `[GLOBAL PREFIX]` with the actual contents of `prompts/agent-character-sheet-global-style.md`.

## Output Template

Produce a single continuous prompt. Use commas and paragraph breaks between sections. Follow this structure exactly, filling in character-specific details from the source description:

```
[GLOBAL PREFIX], character name "<NAME>" with subtitle "<EPITHET>"
in stencil military font top-left,

HERO POSE (large left 40% of sheet): Full-body <pose description>,
<physical appearance>, <clothing/armor details>, <key prop or context>,
<expression>, <background setting>,

EXPRESSIONS (top center, row of 4 head-and-shoulder busts labeled):
"<EMOTION_1>" — <acting direction>,
"<EMOTION_2>" — <acting direction>,
"<EMOTION_3>" — <acting direction>,
"<EMOTION_4>" — <acting direction>,

TURNAROUND (center, 4 full-body orthographic views labeled):
Front view / three-quarter view / side view / back view — showing
<key outfit details visible from multiple angles>,

STRIKECRAFT — "<CRAFT_NAME>" (top right, side profile):
<craft visual description>, <weathering/personality details>,
labeled "STRIKECRAFT: <CRAFT_NAME> — <CRAFT_TYPE>",

STRIKECRAFT ACTIONS (small thumbnails below craft, 4 poses labeled):
"<ACTION_1>" — <description>,
"<ACTION_2>" — <description>,
"<ACTION_3>" — <description>,
"<ACTION_4>" — <description>,

WEAPONS AND GEAR (right middle, isolated items with labels):
"<ITEM_1>" — <description>,
"<ITEM_2>" — <description>,
"<ITEM_3>" — <description>,
"<ITEM_4>" — <description>,

OUTFIT DETAILS (bottom left, 3 zoomed close-ups labeled):
"<DETAIL_1>" — <description>,
"<DETAIL_2>" — <description>,
"<DETAIL_3>" — <description>,

ACTION POSES (bottom center, 2 dynamic scenes):
(1) <action scene description>,
(2) <action scene description>,

COLOR PALETTE (bottom right): Five color swatches in a row —
<color_1 name> <#hex>, <color_2 name> <#hex>, <color_3 name> <#hex>,
<color_4 name> <#hex>, <color_5 name> <#hex>,

PERSONAL SYMBOL (bottom right corner): <emblem/logo description>
```

## Mapping Rules

1. **Extract identity anchors** from the source:
   - Physical build, face, hair, skin tone, scars/markings
   - Signature outfit pieces and silhouette-defining gear
   - Emotional baseline and range
   - Associated vehicle/craft/companion name and personality

2. **Derive sections the source doesn't explicitly cover:**
   - **Expressions**: Pick 4 emotions that define the character's range. At least one positive, one negative, one neutral, one intense.
   - **Strikecraft**: If the source names a jet/vehicle, describe it. If not, invent one consistent with lore — name it, give it personality through weathering and details.
   - **Strikecraft actions**: Always use flight-context actions: cruise, dive/attack run, evasive maneuver, grounded/hangar state.
   - **Weapons & gear**: Pull from source; fill to 4-5 items. Include at least one personal/sentimental item.
   - **Outfit details**: Pick 3 close-up-worthy design elements (texture, insignia, hidden feature).
   - **Action poses**: One ground/tarmac scene, one cockpit/flight scene.
   - **Color palette**: Extract 5 dominant colors. Use descriptive names and hex values.
   - **Symbol**: Derive from lore motifs. Should be simple enough to read as a small emblem.

3. **Tone and specificity:**
   - Write cinematically but concisely — every phrase should be paintable.
   - Avoid vague terms ("cool outfit"). Use concrete visual language ("worn leather collar turned up, burnt orange piping along shoulder seams").
   - Include weathering, damage, age, and lived-in details.
   - Emotion labels should feel character-specific, not generic (prefer "RARE SMILE" over "HAPPY").

4. **If the character has a companion creature instead of a vehicle**, replace "STRIKECRAFT" with "COMPANION" and adjust actions to creature-appropriate movements (tracking, leap, attack, guard).

## Output Expectations

- Produce only the final prompt text — no preamble, no analysis, no markdown formatting around it.
- The prompt is a single block of text meant to be pasted directly into an image generation tool.
- Read `prompts/agent-character-sheet-global-style.md` and substitute `[GLOBAL PREFIX]` with its contents before outputting.
