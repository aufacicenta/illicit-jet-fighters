---
name: battlefield-description
description: Generate a structured battlefield description using the 3-Layer Environment Stack framework. Use when the user asks to create a battlefield, combat zone, arena map, stage, level concept, or mission environment. Also use when the user provides terrain features, hazards, weather conditions, or tactical hooks and wants a full battlefield writeup.
disable-model-invocation: true
---

# Setting

Setting: 2187 — After the "Shattered Sky" event fractured Earth's atmosphere into layered combat zones, traditional law enforcement collapsed. The Bounty Exchange emerged — a semi-legal network where licensed hunters take contracts across aerial and ground theaters. Each hunter flies a personalized Strikecraft — part fighter jet, part expression of identity.

Visual DNA: The battlefield art should blend Metal Gear's tactical grit and portrait-style realism with Star Fox's colorful, personality-driven cockpit energy and F-Zero's exaggerated silhouette design and speed-culture aesthetics. Think: sharp angular linework, muted military tones punctuated by neon accent colors, and environments that look like they belong on declassified mission dossiers.

# Battlefield Description Generator

Generate rich, tactically interesting battlefield descriptions using a layered environment framework. The output is a structured battlefield document — not a tilemap or game config.

## Core Philosophy

Memorable battlefields come from **environmental storytelling**, not geometric complexity. Arenas feel alive when they have:

- A dominant visual/tactical feature that names itself (pilots refer to "The Throat," "Glass Floor," "The Scar")
- Built-in asymmetry — no battlefield should feel the same from every approach vector
- History embedded in the terrain — the land remembers what happened here
- Dynamic tension between cover and exposure, altitude and vulnerability

## The 3-Layer Environment Stack

Every battlefield is built on exactly three layers with weighted prominence:

| Layer             | Weight | Purpose                                           | Example                                                                                                                                                 |
| ----------------- | ------ | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Terrain Identity  | 40%    | Primary geographic/structural character           | Flooded megacity canyon, shattered orbital elevator base, volcanic rift with glass-floor lava shelves                                                   |
| Tactical Modifier | 35%    | The environmental mechanic that forces adaptation | Shifting fog banks that kill radar, magnetic anomalies from wreckage that pull missiles off-course, tidal surges that redraw the floor every 90 seconds |
| Atmosphere Quirk  | 25%    | The memorable sensory detail that makes it stick  | Sky is permanently orange from chemical burn-off, everything echoes twice, rain falls upward near the gravity fracture                                  |

The stack should make the battlefield summarizable in one sentence: "the [terrain identity] where [tactical modifier] and [atmosphere quirk]."

## History: The Scar Story

Write 200–400 words of battlefield history containing exactly:

1. **What it was before** — one sentence establishing the pre-Shattered Sky function. Mundane origins make the current state more striking.

2. **What broke it** — the specific event (during or after the Shattered Sky) that made this place a combat zone. Keep to 1–3 sentences. The destruction should explain at least one major terrain feature.

3. **What moved in** — who or what uses this place now, and why. The current occupants/purpose should create tactical context (contested resource, territorial chokepoint, dead-drop zone, no-fly enforcement gap).

4. **The pilot name** — the callsign hunters use for this place, and why. Pilots never use official designations.

### History Template

```
<OFFICIAL NAME> [pre-Shattered Sky function, 1 sentence].
[What broke it — the event that transformed the terrain, 1-3 sentences].
[What moved in — current use and why it draws combat, 1-3 sentences].
Hunters call it "<PILOT NAME>" [because — origin of the nickname, 1 sentence].
```

## Terrain Features

Define 4–6 named terrain features. Each one should have tactical weight — if a feature doesn't change how a pilot flies, cut it.

Format for each feature:

```
### <Feature Name> (pilot callsign: "<what they actually call it>")
- **What it is:** Physical description, 1-2 sentences
- **Tactical role:** How it affects combat (cover, sightline, chokepoint, escape route, hazard)
- **Risk/reward:** What you gain and what you risk by using it
```

At least one feature should be high-risk/high-reward. At least one should favor a specific playstyle (ambush, speed, altitude control). At least one should be destructible or changeable mid-fight.

## Hazard Dynamics

Define 2–3 environmental hazards that are **not static**. Each hazard should have a rhythm or trigger that pilots learn to predict but can't fully control.

| Hazard | Behavior                        | Timing/Trigger        | Counterplay                            |
| ------ | ------------------------------- | --------------------- | -------------------------------------- |
| [Name] | What it does to aircraft/pilots | When/why it activates | How skilled pilots exploit or avoid it |

At least one hazard should be exploitable — something a smart pilot turns into a weapon rather than just avoiding.

## Sensory Profile

Build the battlefield's atmosphere through five senses. Every entry should be specific to _this_ place, not generic combat ambiance.

| Sense                 | Detail                                                                                                   |
| --------------------- | -------------------------------------------------------------------------------------------------------- |
| **Sight**             | The dominant visual — color palette, light quality, what the skyline looks like from the cockpit         |
| **Sound**             | What the battlefield sounds like through the canopy and over comms — ambient noise, echoes, interference |
| **Feel**              | What the airframe does here — turbulence patterns, vibration, temperature shifts through the hull        |
| **Smell**             | What leaks into the cockpit through vents or seals — chemical, organic, metallic                         |
| **Radar/Instruments** | How the battlefield reads on sensors — clean, cluttered, deceptive, dead zones                           |

## Engagement Zones

Divide the battlefield into 3–4 tactical zones that create natural phase shifts during combat. Each zone should reward a different approach.

```
### <Zone Name>
- **Altitude band / area:** Where it is spatially
- **Character:** What fighting here feels like (claustrophobic dogfight, long-range jousting, vertical chicken)
- **Who thrives here:** The playstyle or build that has advantage
- **Transition threat:** What's dangerous about moving into or out of this zone
```

## Output Format

Produce the battlefield description as a single structured document:

```
# <OFFICIAL NAME>
> "<pilot nickname>" — <one-line description in a pilot's voice>

## Environment Stack
- **Terrain (40%):** <identity> — <defining geographic feature>
- **Modifier (35%):** <mechanic> — <how it changes combat>
- **Quirk (25%):** <sensory detail> — <what makes it unforgettable>

## History
<200-400 words following the Scar Story formula>

## Terrain Features
### <Feature 1> ("<callsign>")
...
### <Feature 2> ("<callsign>")
...
(4-6 total)

## Hazards
| Hazard | Behavior | Timing/Trigger | Counterplay |
|--------|----------|----------------|-------------|
| ... | ... | ... | ... |
(2-3 total)

## Sensory Profile
| Sense | Detail |
|-------|--------|
| Sight | ... |
| Sound | ... |
| Feel | ... |
| Smell | ... |
| Radar | ... |

## Engagement Zones
### <Zone 1>
...
### <Zone 2>
...
(3-4 total)

## Pilot Briefing
<2-3 short lines of in-character radio chatter or briefing dialogue referencing the battlefield's features, hazards, and reputation>

## Mood Words
<5-7 adjectives that capture the battlefield's tonal range, semicolon-separated>
```

## Process

1. **Gather inputs** — The user may provide any combination of: location, terrain type, hazards, weather, tactical concept, mood, history fragments, visual references. Work with whatever is given.

2. **Infer the stack** — If the user gives raw features, organize them into Terrain/Modifier/Quirk. If they only give a vibe or concept, derive all three layers.

3. **Fill gaps** — For any section the user didn't specify, invent details that are internally consistent with what was provided. Prefer dangerous-but-logical choices over safe-generic ones.

4. **Design for asymmetry** — Every feature and zone should create a decision. If a pilot can ignore a terrain feature without consequence, it doesn't belong.

5. **Write like a mission briefing, not a novel** — Terse, specific, sensory. Every sentence should change how a pilot flies. If a phrase doesn't add tactical or atmospheric information, cut it.

6. **Test the one-sentence rule** — The finished battlefield should be describable in one memorable sentence by a pilot who's flown it once.

## What NOT to Do

- Do not write symmetric, balanced arenas with no personality
- Do not create hazards that are purely punitive with no counterplay
- Do not use generic terrain ("some mountains," "a city") without specific character
- Do not make every feature deadly — some should be sanctuary, some should be traps, some should be gambles
- Do not forget the vertical axis — Strikecraft fly in 3D; altitude bands matter
- Do not describe terrain that has no tactical consequence
