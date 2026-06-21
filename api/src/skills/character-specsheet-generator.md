---
name: character-specsheet-generator
description: Generate an image-generation prompt for a full character reference sheet from a character description.
disable-model-invocation: true
---

# Agent Character Sheet

Convert a character description into a single image-generation prompt that produces a full character reference sheet.

## Layout Anatomy

The prompt should include:

- Hero Pose (left ~40%)
- Name/Title block
- Expressions (4)
- Turnaround (4 orthographic views)
- Strikecraft/Companion + actions (4)
- Weapons & Gear (4-5)
- Outfit Details (3)
- Action Poses (2)
- Color Palette (5 swatches + hex values)
- Personal Symbol

## Global Style Prefix

Begin every output prompt with `[GLOBAL PREFIX]`.
`[GLOBAL PREFIX]` must be substituted with the contents from `agent-character-sheet-global-style.md`.

## Output Template

Produce a single continuous prompt block using this structure:

```
[GLOBAL PREFIX], character name "<NAME>" with subtitle "<EPITHET>" ...

HERO POSE ...
EXPRESSIONS ...
TURNAROUND ...
STRIKECRAFT ...
STRIKECRAFT ACTIONS ...
WEAPONS AND GEAR ...
OUTFIT DETAILS ...
ACTION POSES ...
COLOR PALETTE ...
PERSONAL SYMBOL ...
```

## Mapping Rules

1. **Copy the `## Identity` block (`Name`, `Sex/Gender`, `Pronouns`, `Species/Form`) verbatim from the source.** These are hard constraints — never infer or override them.
   - **Never** guess gender from the name. If the name reads as a different gender than the stated `Sex/Gender`, the `Sex/Gender` field wins.
   - If `Species/Form` is a non-human animal, render the literal creature with its real anatomy and silhouette across the hero pose, turnaround, and expressions. Do **not** humanize unless `Species/Form` says "anthropomorphic".
   - Begin the prompt with an explicit `SUBJECT: <species/form>, <sex/gender>` line so every panel stays consistent.
2. Derive missing sections while staying lore-consistent.
3. Use concrete visual language (no vague descriptions).
4. Include weathering/lived-in details.
5. If character has companion (not craft), swap STRIKECRAFT to COMPANION and adjust action semantics.

## Output Expectations

- Output only final prompt text.
- No markdown wrappers around final prompt.
- Keep it directly pasteable into image generation tools.
