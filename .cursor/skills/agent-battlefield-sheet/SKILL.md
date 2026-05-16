---
name: agent-battlefield-sheet
description: Generate an image-generation prompt for a full battlefield reference sheet from a battlefield or arena description. Use when the user asks to create a battlefield sheet, arena sheet, combat zone sheet, map concept sheet, or environment design sheet for a jet-arena battlefield.
disable-model-invocation: true
---

# Agent Battlefield Sheet

Convert a battlefield description into a single image-generation prompt that produces a full battlefield reference sheet — a concept-art layout with hero vista, atmospheric layers, terrain landmarks, hazards, weather states, tactical callouts, time-of-day variations, color palette, and arena emblem.

## Layout Anatomy

The output prompt describes a landscape reference sheet with these fixed sections:

| Section | Position | Content |
|---------|----------|---------|
| Hero Vista | Large, left ~40% | Wide establishing shot of the full battlefield at peak drama |
| Name / Theater Block | Top-left overlay | Stylized arena name, callsign designation, short lore blurb |
| Atmospheric Layers | Top center, stacked row | 4 altitude-band cross-sections labeled with combat zone names |
| Terrain Landmarks | Center, row | 4 point-of-interest vignettes with tactical labels |
| Hazards & Threats | Top right | Primary environmental hazard study with danger indicators |
| Hazard Variations | Below hazard, row | 4 small hazard-state thumbnails with labels |
| Tactical Features | Right middle | 4-5 isolated map-feature callouts with labels |
| Weather States | Bottom left | 3 atmosphere/weather condition panels with labels |
| Time-of-Day Cycle | Bottom center | 3 lighting passes of the same vista (dawn / midday / night) |
| Color Palette | Bottom right | 5 hex-value color swatches in a row |
| Arena Emblem | Bottom right corner | Insignia or brand mark for the battlefield |

## Global Style Prefix

Begin every output prompt with this prefix (read from `prompts/agent-battlefield-sheet-global-style.md` if present, otherwise use the default below):

```
[GLOBAL PREFIX]
```

If `prompts/agent-battlefield-sheet-global-style.md` does not exist, fall back to `prompts/agent-character-sheet-global-style.md` and adapt it for environment art — replace character-specific terms (sprite sheet, portrait, codec portrait) with environment equivalents (environment tile sheet, panoramic vista, mission briefing backdrop).

## Output Template

Produce a single continuous prompt. Use commas and paragraph breaks between sections. Follow this structure exactly, filling in battlefield-specific details from the source description:

```
[GLOBAL PREFIX], battlefield name "<NAME>" with designation "<THEATER_CODE>"
in stencil military font top-left,

HERO VISTA (large left 40% of sheet): Wide establishing shot of <terrain type>,
<dominant geological/architectural feature>, <atmosphere and sky condition>,
<scale indicators — wreckage, structures, contrails>, <lighting and mood>,
<signature environmental detail that makes this arena unique>,

ATMOSPHERIC LAYERS (top center, stacked row of 4 altitude bands labeled):
"<LAYER_1 — e.g. GROUND LEVEL>" — <terrain description, cover type, ground hazards>,
"<LAYER_2 — e.g. LOW ALTITUDE>" — <obstacle density, urban/canyon features>,
"<LAYER_3 — e.g. MID ALTITUDE>" — <open combat zone characteristics>,
"<LAYER_4 — e.g. HIGH ALTITUDE>" — <atmospheric effects, visibility, ceiling hazards>,

TERRAIN LANDMARKS (center, 4 point-of-interest vignettes labeled):
"<LANDMARK_1>" — <visual description and tactical significance>,
"<LANDMARK_2>" — <visual description and tactical significance>,
"<LANDMARK_3>" — <visual description and tactical significance>,
"<LANDMARK_4>" — <visual description and tactical significance>,

HAZARD — "<HAZARD_NAME>" (top right, dramatic study):
<hazard visual description>, <movement pattern or trigger behavior>,
<visual warning indicators pilots would see>,
labeled "PRIMARY HAZARD: <HAZARD_NAME> — <HAZARD_TYPE>",

HAZARD VARIATIONS (small thumbnails below hazard, 4 states labeled):
"<STATE_1 — e.g. DORMANT>" — <description>,
"<STATE_2 — e.g. WARNING>" — <description>,
"<STATE_3 — e.g. ACTIVE>" — <description>,
"<STATE_4 — e.g. AFTERMATH>" — <description>,

TACTICAL FEATURES (right middle, isolated map elements with labels):
"<FEATURE_1>" — <description>,
"<FEATURE_2>" — <description>,
"<FEATURE_3>" — <description>,
"<FEATURE_4>" — <description>,

WEATHER STATES (bottom left, 3 atmosphere panels labeled):
"<WEATHER_1>" — <visibility, wind, precipitation, combat impact>,
"<WEATHER_2>" — <visibility, wind, precipitation, combat impact>,
"<WEATHER_3>" — <visibility, wind, precipitation, combat impact>,

TIME-OF-DAY CYCLE (bottom center, 3 lighting passes of same vista):
(1) <dawn/morning pass — light direction, color temperature, shadow behavior>,
(2) <midday/peak pass — harsh light, heat distortion, visibility>,
(3) <night/dusk pass — artificial light sources, darkness pockets, glow effects>,

COLOR PALETTE (bottom right): Five color swatches in a row —
<color_1 name> <#hex>, <color_2 name> <#hex>, <color_3 name> <#hex>,
<color_4 name> <#hex>, <color_5 name> <#hex>,

ARENA EMBLEM (bottom right corner): <insignia/brand mark description>
```

## Mapping Rules

1. **Extract terrain anchors** from the source:
   - Primary terrain type (urban ruins, oceanic rift, canyon network, orbital debris field, fractured tundra)
   - Dominant vertical feature (tower, spire, cliff face, storm column, mega-structure wreckage)
   - Ground-level texture and cover density
   - Sky condition and atmospheric color cast
   - Scale — what tells the viewer this is massive (ant-sized vehicles, distant contrails, cloud layers below camera)

2. **Derive sections the source doesn't explicitly cover:**
   - **Atmospheric layers**: Define 4 altitude bands from ground to ceiling. Each should have distinct combat character — cover density decreases with altitude, hazard type shifts.
   - **Terrain landmarks**: Pick 4 points of interest that create tactical asymmetry. At least one choke point, one open kill zone, one defensive position, one high-risk/high-reward location.
   - **Primary hazard**: If the source names an environmental threat, describe it. If not, invent one consistent with the terrain — give it a name, escalation states, and visual warning cues.
   - **Hazard variations**: Always use escalation-cycle states: dormant, warning/building, active/lethal, aftermath/cooldown.
   - **Tactical features**: Pull from source; fill to 4-5 items. Include at least one natural feature and one artificial/wreckage feature.
   - **Weather states**: Pick 3 weather conditions that meaningfully change combat — affect visibility, maneuverability, or hazard behavior.
   - **Time-of-day**: Show the same hero vista angle under 3 lighting conditions. Focus on how light reveals or hides tactical information.
   - **Color palette**: Extract 5 dominant environment colors. Use terrain-evocative names and hex values.
   - **Emblem**: Derive from the arena's lore identity — should be simple enough to brand on a mission briefing screen.

3. **Tone and specificity:**
   - Write cinematically but concisely — every phrase should be paintable.
   - Avoid vague terms ("dangerous area"). Use concrete visual language ("collapsed freeway overpass draped in corroded rebar, puddles of iridescent fuel runoff reflecting broken sky").
   - Include weathering, decay, geological scars, and evidence of past combat.
   - Landmark labels should feel like pilot callsigns for the location, not generic map pins (prefer "THE GRINDER" over "Central Area").

4. **If the battlefield is orbital, subterranean, or aquatic**, adapt layer names and hazard types to the domain:
   - Orbital: replace altitude bands with orbital shells, replace weather with radiation/debris density.
   - Subterranean: replace altitude with depth tiers, replace weather with air quality/seismic states.
   - Aquatic: replace altitude with depth zones, replace weather with current/pressure/bioluminescence states.

## Output Expectations

- Produce only the final prompt text — no preamble, no analysis, no markdown formatting around it.
- The prompt is a single block of text meant to be pasted directly into an image generation tool.
- Read `prompts/agent-battlefield-sheet-global-style.md` first; if it exists, substitute `[GLOBAL PREFIX]` with its contents. If not, read `prompts/agent-character-sheet-global-style.md`, adapt environment-relevant terms, and use that as the prefix.
