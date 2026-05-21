---
name: character-description
description: Generate a structured character description using the 3-Layer Personality Stack framework. Use when the user asks to create a character, persona, agent personality, character bio, character concept, or NPC description. Also use when the user provides physical traits, expressions, living context, or personality seeds and wants a full character writeup.
disable-model-invocation: true
---

# Setting

2187 — Wazcania fractured Earth's atmosphere into layered combat zones, law enforcement collapsed.

The Bounty Exchange emerged — an illicit network where licensed hunters take contracts across aerial and ground theaters. Each hunter flies a personalized air-machine — part fighter jet, part expression of identity.

Visual DNA: The character art should blend Metal Gear's tactical grit and portrait-style realism with Star Fox's colorful, personality-driven cockpit energy and F-Zero's exaggerated silhouette design and speed-culture aesthetics. Think: sharp angular linework, muted military tones punctuated by neon accent colors, and portraits that look like they belong on wanted posters.

# Character Description Generator

Generate rich, authentic-feeling character descriptions using a layered personality framework. The output is a structured character document — not an image prompt.

## Core Philosophy

Authenticity comes from **specific imperfection**, not encyclopedic detail. Characters feel real when they have:

- A small number of vivid traits instead of exhaustive backstory
- Built-in contradictions and self-doubt
- Concrete specifics instead of generic adjectives
- Relatable flaws tied to their strengths

## The 3-Layer Personality Stack

Every character is built on exactly three layers with weighted prominence:

| Layer      | Weight | Purpose                                      | Example                                                                               |
| ---------- | ------ | -------------------------------------------- | ------------------------------------------------------------------------------------- |
| Core Trait | 40%    | Primary cognitive/behavioral pattern         | Analytical thinker, impulsive protector, quiet observer                               |
| Modifier   | 35%    | Lens through which the core expresses itself | Expresses through food metaphors (former chef), channels everything into music theory |
| Quirk      | 25%    | Memorable surface-level habit or pattern     | Quotes 90s R&B mid-explanation, taps morse code on surfaces when nervous              |

The stack should make the character summarizable in one sentence: "the [modifier context] who [core trait verb]s and [quirk]."

## Background: The Context Sweet Spot

Write 300–500 words of background containing exactly:

1. **Two formative experiences** — one positive, one challenging. Keep each to 1–2 sentences. The positive one seeds their passion; the challenging one seeds their vulnerability.

2. **One current passion** — hyper-specific, not generic. "Collects vintage synthesizers and knows the serial number history of every Moog Model D" not "likes music."

3. **One vulnerability** — directly related to their expertise or role. Creates a paradox that feels human. "Still gets nervous explaining quantum physics despite PhD" or "World-class pilot who white-knuckles during turbulence as a passenger."

### Background Template

```
<NAME> [origin hook — where/how they grew up, 1 sentence].
[Positive formative experience — what sparked their path, 1-2 sentences].
[Challenging formative experience — what almost broke them, 1-2 sentences].
Now [current situation/role]. [Current passion expressed with obsessive specificity].
[Vulnerability that contradicts their competence, delivered with self-aware humor].
```

## Imperfection Patterns

Embed 2–3 of these behavioral signatures into the character's voice/manner:

- **Self-correction**: catches own mistakes mid-thought ("wait, no, that's not right—")
- **Tangent awareness**: loses thread and acknowledges it ("where was I going with this?")
- **Analogy failure**: tries a metaphor, realizes it doesn't land, tries again
- **Confidence wobble**: momentary uncertainty on things they should know cold
- **Contradiction comfort**: holds two opposing views and is okay with that
- **Memory fuzz**: approximate recall of facts they've known forever ("signed in... 1918? No, 1919")

Pick patterns that reinforce the character's personality stack, not random ones.

## Physical & Visual Description

When the user provides physical aspects, structure them as:

### Visual Anchors (3–5 items)

Identify the details that make the character's silhouette and presence instantly recognizable at any scale. These are the non-negotiable visual identity markers.

Format: `<anchor> — <why it matters or what it communicates>`

### Expression Range (4 emotions)

Pick emotions specific to this character's personality. Avoid generic labels.

| Label                        | Description                                      |
| ---------------------------- | ------------------------------------------------ |
| [CHARACTER-SPECIFIC EMOTION] | Physical acting direction (face, hands, posture) |
| [CHARACTER-SPECIFIC EMOTION] | Physical acting direction                        |
| [CHARACTER-SPECIFIC EMOTION] | Physical acting direction                        |
| [CHARACTER-SPECIFIC EMOTION] | Physical acting direction                        |

At least one positive, one negative, one that shows their vulnerability.

### Living Context

Where and how the character exists in space. Include:

- **Environment**: The space they inhabit or return to (specific, sensory)
- **Object relationships**: 2–3 objects they interact with habitually
- **Movement signature**: How they carry themselves (gait, gesture patterns, spatial habits)

## Output Format

Produce the character description as a single structured document:

```
# <NAME>
> "<one-line epithet or self-description in their voice>"

## Personality Stack
- **Core (40%):** <trait> — <how it manifests>
- **Modifier (35%):** <lens> — <origin>
- **Quirk (25%):** <habit> — <when it surfaces>

## Background
<300-500 words following the Context Sweet Spot formula>

## Imperfection Patterns
- <pattern 1 with character-specific example line>
- <pattern 2 with character-specific example line>
- <pattern 3 with character-specific example line> (optional)

## Visual Anchors
- <anchor 1> — <significance>
- <anchor 2> — <significance>
- <anchor 3> — <significance>
- <anchor 4> — <significance> (optional)
- <anchor 5> — <significance> (optional)

## Expressions
| Label | Direction |
|-------|-----------|
| <emotion> | <physical description> |
| <emotion> | <physical description> |
| <emotion> | <physical description> |
| <emotion> | <physical description> |

## Living Context
**Environment:** <sensory description of their space>
**Objects:** <2-3 habitual objects>
**Movement:** <how they carry themselves>

## Voice Sample
<2-3 short lines of dialogue demonstrating the personality stack and imperfection patterns in action>

## Mood Words
<5-7 adjectives that capture the character's tonal range, semicolon-separated>
```

## Process

1. **Gather inputs** — The user may provide any combination of: name, physical traits, role, personality seeds, living context, backstory fragments, mood, visual references. Work with whatever is given.

2. **Infer the stack** — If the user gives raw traits, organize them into Core/Modifier/Quirk. If they only give a vibe or concept, derive all three layers.

3. **Fill gaps** — For any section the user didn't specify, invent details that are internally consistent with what was provided. Prefer surprising-but-logical choices over safe-generic ones.

4. **Write cinematically but concisely** — Every phrase should evoke a specific image or sound. No filler adjectives. If a word doesn't add new information, cut it.

5. **Test the one-sentence rule** — The finished character should be describable in one memorable sentence by someone who just met them.

## What NOT to Do

- Do not write exhaustive multi-page biographies
- Do not make the character perfectly consistent or omniscient
- Do not use extreme/one-note personalities (always angry, always sad)
- Do not use generic traits ("kind", "brave", "smart") without a specific expression lens
- Do not include the character's childhood pet's name unless it's plot-critical
