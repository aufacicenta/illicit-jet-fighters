---
name: character-to-seedance-video
description: Convert a character description into a Seedance 2.0 image-to-video prompt using a fixed cinematic 5-beat action arc. Use when the user asks for an image-to-video prompt, Seedance prompt, animation prompt, or to adapt a character description into a short cinematic video sequence.
disable-model-invocation: true
---

# Character to Seedance Video Prompt

Convert a character description into a single polished prompt for Seedance 2.0 image-to-video generation.

## Intent

Preserve the source character's identity while forcing a high-momentum action sequence:

1. Full-speed movement through hostile weather/terrain
2. Threat silhouettes emerging through low visibility
3. Mid-motion weapon/action release with one fluid strike
4. No pause after impact (momentum continues)
5. Final wide cinematic shot with a dominant closing image and one short line

## Input Assumption

Primary input is a character profile (for example `jet-arena/agents/*/character-description.md`), but this works with any character description.

Extract and map:

- **Character identity**: age vibe, demeanor, role, emotional baseline
- **Movement platform**: wolf, jet, bike, mount, mech, or on-foot analog
- **Signature tool**: blade, rifle, power, command tool, or equivalent
- **Visual anchors**: outfit, silhouette, key prop, color cues
- **Environment fit**: storm, ash, rain, dust, fog, night combat, etc.

## Adaptation Rules

1. Keep the scene physically consistent with the character:
   - If the character is a pilot/commander, movement can be cockpit + craft momentum.
   - If the character is ground-combat, use mount/vehicle/on-foot equivalent.
2. Replace "white wolf" with the source-appropriate companion/vehicle if available.
3. Replace "blade draw" with the character's signature action while keeping one-fluid-motion pacing.
4. Keep language cinematic and concrete; avoid abstract adjectives.
5. Keep dialogue to one short final line only.
6. Keep the entire output to roughly 110-170 words.

## Output Format

Output exactly two sections and nothing else:

```
Concept:
<1 sentence identity + momentum statement>

Prompt used in Seedance 2.0:
"<multi-line cinematic prompt>"
```

## Prompt Structure (inside quoted block)

Use this beat order and line rhythm:

1. Environmental opener (violent weather or battlefield condition).
2. Character + movement platform at full speed.
3. Clothing/body detail reacting to speed/wind.
4. Target lock or intent line.
5. `Cut`
6. Enemy silhouettes emerge in poor visibility.
7. Platform surge/leap/dive + one fluid signature action mid-motion.
8. Impact result described briefly.
9. "No pause. No hesitation." (or equivalent 2 short lines).
10. `Final shot`
11. Elevated wide frame with aftermath tableau.
12. One sensory close (growl/engine whine/static crackle/etc.).
13. One short spoken line in character voice.

## Quality Checks

Before finalizing, verify:

- Character still reads as the same person from the source description.
- Motion never stalls between beats 2-9.
- Final shot escalates scale (mythic, strategic, or emotional payoff).
- No meta instructions ("go to Seedance", "upload image", "click generate") appear in output.
- Output is directly paste-ready for Seedance 2.0.

## Example Skeleton

```
Concept:
A disciplined [ROLE] riding [PLATFORM] through [HOSTILE CONDITION] with relentless forward momentum.

Prompt used in Seedance 2.0:
"[Environment violence].
Through [condition],
[CHARACTER] [rides/pilots/sprints] [PLATFORM] at full speed.
[CLOAK/COAT/GEAR] [reacts to force].
[TARGET-LOCK INTENT].

Cut
Enemy silhouettes emerge in [low visibility].
[PLATFORM] [surges/leaps/dives].
In one fluid motion, [CHARACTER] [signature action] mid-[movement] -
[impact result].

No pause.
No hesitation.

Final shot
[CHARACTER] [dominant pose] overlooking [aftermath vista].

[sensory close].
[short line of dialogue]."
```
