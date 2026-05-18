---
name: character-to-cinematic-shotlist
description: Convert a character description into a multi-shot cinematic video prompt with SUBJECTS, ENVIRONMENT, STYLE, and 7 numbered SHOT beats including lens, camera movement, and action direction. Use when the user asks for a cinematic shotlist, shot breakdown, multi-shot video prompt, storyboard prompt, or wants to turn a character description into a directed video sequence.
disable-model-invocation: true
---

# Character to Cinematic Shotlist

Convert a character description into a paste-ready multi-shot cinematic video prompt. The output is a directed shot sequence — not a single-clip prompt.

## Setting Context (Jet Arena Canon)

Setting: 2187 — After the "Shattered Sky" event fractured Earth's atmosphere into layered combat zones, traditional law enforcement collapsed. The Bounty Exchange emerged — a semi-legal network where licensed hunters take contracts across aerial and ground theaters. Each hunter flies a personalized Strikecraft — part fighter jet, part expression of identity.

Visual DNA: Blend Metal Gear tactical grit with Star Fox colorful cockpit personality and F-Zero exaggerated silhouettes. Sharp angular linework, muted military tones with neon accents.

When source character details are missing or ambiguous, default to this world context.

## Input

A character profile (e.g. `jet-arena/agents/*/character-description.md`). Any character description works.

Extract and map:

| Field             | Source Section                              | What to Pull                                              |
| ----------------- | ------------------------------------------- | --------------------------------------------------------- |
| Physical identity | Visual Anchors, Background                  | Age, build, ethnicity, defining facial features, demeanor |
| Outfit & props    | Visual Anchors, Living Context              | Clothing, gear, weapons, signature objects                |
| Environment       | Living Context → Environment                | Primary setting, lighting, atmosphere, key props in scene |
| Signature action  | Personality Stack → Core Trait, Expressions | Combat style, signature motion, emotional rhythm          |
| Emotional arc     | Expressions, Mood Words                     | Dominant emotion, vulnerability moment, resolution        |

## Output Format

Output exactly this structure, nothing else:

```
SUBJECTS:
<Physical description. 1-2 sentences. Age/ethnicity/build/face/demeanor.>

ENVIRONMENT:
<Setting description. 2-3 sentences. Location, lighting, atmosphere, key props visible in frame.>

STYLE:
<Art direction. 2-3 sentences. Painterly/cinematic feel, color approach, texture constraints.>
<1 line of explicit exclusions: what the video should NOT look like.>

SHOT 1:
<Transition type>. <Shot size>, <lens mm>, <camera movement>.
<Action description — what the character is already doing, continuous motion, 1-2 sentences.>

SHOT 2:
<Transition type>. <Shot size>, <lens mm>, <camera movement>.
<Action continuation — motion escalates or shifts angle, 1-2 sentences.>

SHOT 3:
<Transition type>. <Shot size>, <lens mm>, <camera movement>.
<Emotional beat — eyes, face, internal rhythm made visible, 1-2 sentences.>

SHOT 4:
<Transition type>. <Shot size>, <lens mm>, <camera movement>.
<Peak action — full-body commitment, highest intensity, 1-2 sentences.>

SHOT 5:
<Transition type>. <Shot size>, <lens mm>, <camera movement>.
<Texture detail — extreme close on hands/gear/impact, tactile feel, 1-2 sentences.>

SHOT 6:
<Transition type>. <Shot size>, <lens mm>, <camera movement>.
<Perspective shift — new angle or reflection, continued motion, 1-2 sentences.>

SHOT 7:
<Transition type>. <Shot size>, <lens mm>, <camera movement>.
<Resolution — final stance or held moment, environmental settling, 1-2 sentences.>
```

## Shot Construction Rules

### Transition Types (pick one per shot)

- Hard cut opening (SHOT 1 only)
- Action match cut
- Fast transition
- Action transition cut
- Silent cut-in
- Action transition
- Ending shot (SHOT 7 only)

### Shot Sizes

Close shot, Medium close shot, Close-up, Full-body medium shot, Extreme close-up, Medium shot, Wide shot

### Lenses

Use 28mm, 35mm, or 50mm. Match to shot:

| Lens | When                                                               |
| ---- | ------------------------------------------------------------------ |
| 28mm | Full-body or environmental context shots                           |
| 35mm | Close shots, orbits, handheld — workhorse focal length             |
| 50mm | Medium close, extreme close-up, compression for intimacy/intensity |

### Camera Movements

Steady close follow, Lateral tracking shot, Slow orbit, Steady push-in, Slight handheld feel, Mirror reflection cut, Slow push-in then stable hold, Low-angle dolly, Overhead crane descent

## Mapping Character to Action Arc

The 7-shot arc follows this emotional shape:

```
SHOT 1  — Already in motion (no wind-up, no establishing shot)
SHOT 2  — Technique variation (show range of skill)
SHOT 3  — Internal moment (calm eye, focus, vulnerability flicker)
SHOT 4  — Peak commitment (biggest motion, highest stakes)
SHOT 5  — Tactile payoff (feel the impact, the texture, the gear)
SHOT 6  — Angle break (viewer reorientation, new perspective)
SHOT 7  — Resolution hold (settling, stillness returns, environment breathes)
```

### Deriving the Action Sequence

Infer the specific action from the character's identity:

- **Marksman/sniper** → scope alignment, breath control, trigger squeeze, recoil absorption
- **Brawler/close-combat** → striking sequences, footwork, impact moments
- **Pilot/commander** → cockpit gestures, tactical displays, drone deployment, instrument reads
- **Salvager/mechanic** → tool work, panel inspection, wiring, diagnostic sequences
- **Musician/artist** → instrument play, brush strokes, craft ritual

Combine the character's **Core Trait** action style with their **Living Context** environment. The character should be doing what they do best, in the place they feel most themselves.

### Writing Shot Descriptions

- Start each shot mid-action. No "begins to" or "starts." The character is already doing the thing.
- Describe what the camera sees, not what the character feels. Emotion reads through physical detail.
- Include at least one sensory texture per shot (fabric movement, dust, light quality, sound implication).
- Keep each shot description to 1-2 sentences. Dense and specific.
- No dialogue in any shot. Motion only.

## Quality Checks

Before finalizing:

- [ ] Character is recognizable from the source description (physical details, outfit, props match)
- [ ] Environment matches their Living Context, not a generic backdrop
- [ ] All 7 shots use different transition types
- [ ] All 7 shots use different camera movements (no repeats)
- [ ] Lens choices vary across the sequence (not all 35mm)
- [ ] SHOT 1 drops in mid-action with no preamble
- [ ] SHOT 3 contains the emotional/internal beat
- [ ] SHOT 7 resolves with environmental settling, not frozen pose
- [ ] STYLE section includes at least one explicit exclusion
- [ ] No meta-instructions or tool references in output
- [ ] Output is directly paste-ready

## Example

Given a character who is a long-range marksman with a heavy pink-and-charcoal strikecoat, neon coral tattoos, fractured monocular scope, and a narrow sodium-lit hangar:

```
SUBJECTS:
Latino male, late 20s, heavyweight build, heavy jaw, broken nose bridge, calm half-lidded stare, predatory stillness.

ENVIRONMENT:
Narrow hangar berth under sodium lights, oil-stained tarmac, puddles reflecting amber glow. Walls patched with ballistic cloth and faded bounty placards. A cracked analog wind meter and grease-stained range cards visible on a workbench.

STYLE:
Digital painting feel. Large simplified color blocks, hard-edge brushwork, heavy shadows with sodium amber highlights, preserving hand-drawn texture and grit.
No realistic 3D feel, no commercial CG advertisement feel, no clean polished surfaces.

SHOT 1:
Hard cut opening. Close shot, 35mm, steady close follow.
Fat Flamingo already hunched over the workbench, hands sorting tungsten fin rounds by altitude band, monocular scope catching sodium light as he mutters range corrections under his breath…

SHOT 2:
Action match cut. Medium close shot, 50mm, lateral tracking shot.
Hands shift to the cracked wind meter, tapping the glass twice, then cross-referencing a grease-stained index card held between two fingers…

SHOT 3:
Fast transition. Close-up, 35mm, slow orbit.
Half-lidded eyes scanning the range card, jaw set, neon coral tattoos on his neck flickering under the sodium wash, breathing slow and metered…

SHOT 4:
Action transition cut. Full-body medium shot, 28mm, steady push-in.
He racks a round into the sidearm with one clean motion, steps back from the bench, and raises the weapon toward a distant target silhouette at the far end of the hangar…

SHOT 5:
Silent cut-in. Extreme close-up, 50mm, slight handheld feel.
Trigger finger hovering, the pad of his index pressing the guard, fractured monocular lens refracting a pinpoint of amber light…

SHOT 6:
Action transition. Medium shot, 35mm, low-angle dolly.
The shot fires — muzzle flash washing the ballistic cloth walls orange, spent casing tumbling, his coat's armored feather panels absorbing the recoil shudder…

SHOT 7:
Ending shot. Medium close shot, 50mm, slow push-in then stable hold.
Sidearm lowering, smoke curling from the barrel, the melted dog tag on his harness swaying once, sodium light settling back to its steady amber hum…
```
