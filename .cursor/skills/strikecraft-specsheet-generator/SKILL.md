---
name: strikecraft-specsheet-generator
description: Generate an image-generation prompt for a full strikecraft reference sheet from a character description. Use when the user asks to create a strikecraft sheet, vehicle sheet, craft specsheet, jet sheet, or ship design sheet for a jet-arena agent's strikecraft.
disable-model-invocation: true
---

# Strikecraft Specsheet

Convert a character description into a single image-generation prompt that produces a full strikecraft reference sheet — a concept-art layout with hero profile, orthographic views, cockpit interior, weapons hardpoints, flight configurations, detail close-ups, pilot connection, color palette, and nose art.

## Layout Anatomy

The output prompt describes a landscape reference sheet with these fixed sections:

| Section                  | Position            | Content                                                                       |
| ------------------------ | ------------------- | ----------------------------------------------------------------------------- |
| Hero Profile             | Large, left ~40%    | Side-profile hero illustration of the strikecraft in flight or dramatic hover |
| Name / Designation Block | Top-left overlay    | Stylized craft name, class designation, pilot callsign                        |
| Orthographic Views       | Top center, row     | 4 technical views (top / front / side / rear)                                 |
| Cockpit Interior         | Top right           | Cutaway or frontal view of cockpit instrument layout                          |
| Weapons & Hardpoints     | Right middle        | 4-5 isolated weapon/system callouts with labels                               |
| Flight Configurations    | Center, row         | 4 flight-mode thumbnails with labels                                          |
| Detail Close-Ups         | Bottom left         | 3 zoomed sections of hull texture, weathering, or unique features             |
| Pilot Connection         | Bottom center-left  | Small pilot silhouette in cockpit + personal touches on the craft             |
| Damage & History         | Bottom center       | 2 vignettes showing battle scars, field repairs, or mission wear              |
| Color Palette            | Bottom right        | 5 hex-value color swatches in a row                                           |
| Nose Art / Craft Emblem  | Bottom right corner | Painted emblem or brand mark on the hull                                      |

## Global Style Prefix

Begin every output prompt with this prefix (read from `prompts/agent-character-sheet-global-style.md` if present, otherwise use the default below):

```
[GLOBAL PREFIX]
```

Read `prompts/agent-character-sheet-global-style.md` and adapt it for vehicle/craft art — replace character-specific terms (sprite sheet, portrait, codec portrait, character screens) with vehicle equivalents (vehicle cutaway sheet, profile schematic, mission briefing vehicle card, craft technical readout). Keep the pixel-art style, color palette, and retro energy intact.

## Output Template

Produce a single continuous prompt. Use commas and paragraph breaks between sections. Follow this structure exactly, filling in strikecraft-specific details extracted and derived from the source character description:

```
[ADAPTED GLOBAL PREFIX], craft name "<CRAFT_NAME>" with designation
"<CRAFT_CLASS> — <PILOT_CALLSIGN>'S MACHINE" in stencil military font top-left,

HERO PROFILE (large left 40% of sheet): Side-profile <craft posture — banking,
diving, cruising, hovering>, <hull shape and dominant silhouette feature>,
<engine/thrust signature>, <weathering and paint condition>,
<environmental context — sky, terrain, weather>, <scale indicators —
contrails, debris, wingman in distance>, <mood and personality of the craft>,

ORTHOGRAPHIC VIEWS (top center, row of 4 technical views labeled):
"TOP" — <planform silhouette, wing geometry, dorsal features, antenna/sensor layout>,
"FRONT" — <intake geometry, canopy shape, landing gear wells, weapon pylons>,
"SIDE" — <fuselage proportions, panel line density, access hatches, stencil markings>,
"REAR" — <engine cluster, exhaust geometry, tail surfaces, rear armor plating>,

COCKPIT INTERIOR (top right, cutaway or frontal view):
<instrument layout philosophy — military spec, salvaged, custom-wired>,
<primary flight displays and HUD elements>,
<personal objects mounted by the pilot>,
<wear patterns — grip polish, scratched labels, tape repairs>,
labeled "COCKPIT: <CRAFT_NAME> — <interior personality phrase>",

WEAPONS & HARDPOINTS (right middle, isolated systems with labels):
"<WEAPON_1>" — <description and mount location>,
"<WEAPON_2>" — <description and mount location>,
"<SYSTEM_1>" — <defensive/utility system description>,
"<SYSTEM_2>" — <sensor/countermeasure description>,
"<SIGNATURE_MOD>" — <pilot-specific modification or jury-rig>,

FLIGHT CONFIGURATIONS (center, 4 mode thumbnails labeled):
"<MODE_1 — e.g. CRUISE>" — <thrust level, wing position, sensor state, contrail character>,
"<MODE_2 — e.g. ATTACK RUN>" — <aggressive posture, weapon deployment, engine flare>,
"<MODE_3 — e.g. EVASIVE>" — <defensive geometry, countermeasure deployment, maneuver trails>,
"<MODE_4 — e.g. GROUNDED/HANGAR>" — <powered down, canopy open, maintenance access>,

DETAIL CLOSE-UPS (bottom left, 3 zoomed sections labeled):
"<DETAIL_1>" — <hull texture, panel seam character, paint chips>,
"<DETAIL_2>" — <specific unique feature — asymmetric repair, custom part, trophy mark>,
"<DETAIL_3>" — <engine or intake close-up showing wear, heat discoloration, maintenance tape>,

PILOT CONNECTION (bottom center-left): Small silhouette of <pilot species/build>
seated in cockpit with <signature posture>, visible through canopy with
<personal items — charm on ejection handle, photo taped to console, tally marks
on canopy frame>, craft exterior showing <pilot-applied customizations —
hand-painted marks, non-standard antenna, lucky dent left unrepaired>,

DAMAGE & HISTORY (bottom center, 2 vignettes):
(1) <specific battle scar or field repair with story — mismatched panel, weld seam,
replaced component from a different craft model>,
(2) <evidence of the craft's operational history — salt corrosion, sand pitting,
fuel stains, scorch marks from a memorable engagement>,

COLOR PALETTE (bottom right): Five color swatches in a row —
<color_1 name> <#hex>, <color_2 name> <#hex>, <color_3 name> <#hex>,
<color_4 name> <#hex>, <color_5 name> <#hex>,

NOSE ART / CRAFT EMBLEM (bottom right corner): <painted hull emblem description
derived from pilot identity and craft personality>
```

## Mapping Rules

1. **Extract strikecraft anchors** from the character description:
   - Craft name and class/role (interceptor, gunboat, sniper platform, brawler)
   - Hull shape and defining silhouette features (needle nose, swept wings, heavy armor, asymmetric)
   - Build origin (factory, salvaged, kitbashed, inherited, stolen)
   - Weathering story (what environments has it survived, how old, how many repairs)
   - Pilot-craft relationship (obsessive maintenance, grudging respect, living extension, heirloom)

2. **Derive sections the source doesn't explicitly cover:**
   - **Orthographic views**: Extrapolate hull geometry from any visual cues in the description. Emphasize the silhouette-defining features. Include practical details — access hatches, maintenance panels, stencil markings, serial numbers.
   - **Cockpit interior**: Pull from Living Context / Environment if present. If sparse, derive from pilot personality — a meticulous pilot has labeled switches and clean gauges; a scrapper has jury-wired consoles and hand-scratched calibrations.
   - **Weapons & hardpoints**: Extract any named weapons. Fill to 4-5 items including at least one defensive system, one sensor/countermeasure, and one pilot-specific modification that no manual covers.
   - **Flight configurations**: Always use these four modes: cruise/patrol, attack run/dive, evasive/defensive, grounded/hangar. Each mode should show distinct visual geometry — wing sweep changes, weapon deployment states, engine flare intensity, contrail character.
   - **Detail close-ups**: Pick 3 sections that reward zooming in. At least one showing material texture, one showing a unique modification, one showing engine/intake wear.
   - **Pilot connection**: Small-scale pilot silhouette in cockpit. Pull personal objects from Living Context. Show how the pilot has marked the craft as theirs.
   - **Damage & history**: Two vignettes showing the craft's past. At least one field repair with a story (mismatched replacement part, visible weld). At least one environmental wear pattern (salt, sand, heat, ice).
   - **Color palette**: Extract 5 craft-dominant colors. Prioritize hull tones, accent markings, engine glow, and cockpit light. Use descriptive names and hex values.
   - **Nose art**: Derive from pilot identity motifs and craft personality. Should be simple, paintable, and feel hand-applied by the pilot or a crew chief.

3. **Tone and specificity:**
   - Write as if describing a real machine with a service record. Every detail should feel earned, not designed.
   - Avoid clean/new aesthetics. These are working machines — include oil stains, heat discoloration, replaced rivets, tape repairs, hand-painted markings over factory stencils.
   - Craft personality should come through in the weathering and modifications, not just the shape. A patient pilot's craft is methodically maintained with precise repair welds; a reckless pilot's craft has creative field expedients and dents left as-is.
   - Hardpoint and system labels should feel like maintenance crew shorthand, not catalog entries (prefer "THE LONG ARM" over "Primary Weapon System").

4. **If the craft converts between modes** (atmospheric/aquatic, fighter/bomber, flight/ground), show the transformation in the flight configurations section — dedicate at least two thumbnails to the alternate mode.

5. **If the character description names no strikecraft**, derive one entirely from the pilot's personality, combat doctrine, background, and visual anchors. Name it. Give it a build origin story consistent with the pilot's lore.

## Output Expectations

- Produce only the final prompt text — no preamble, no analysis, no markdown formatting around it.
- The prompt is a single block of text meant to be pasted directly into an image generation tool.
- Read `prompts/agent-character-sheet-global-style.md` first; adapt vehicle-relevant terms and substitute `[ADAPTED GLOBAL PREFIX]` with the result.
