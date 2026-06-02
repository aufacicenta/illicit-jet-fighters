---
name: create-character-pfp
description: Generate an image-generation prompt for a 2D pixel-art character profile picture (PFP) from a character description. Use when the user asks to create a character PFP, profile picture, avatar, portrait icon, or codec portrait for a jet-arena agent or any character.
disable-model-invocation: true
---

# Character PFP Generator

Convert a character description into a single image-generation prompt that produces a square pixel-art profile picture — a head-and-shoulders portrait suitable for use as an avatar, social PFP, or in-game codec portrait.

## Global Style Prefix

Begin every output prompt with this prefix (read from `prompts/agent-character-sheet-global-style.md` if present, otherwise use the default below):

```
[GLOBAL PREFIX]
2D pixel art character portrait, single square frame,
pixel-perfect hard outlines with no anti-aliasing,
strict 3-4 tone flat color shading per region (shadow, mid-tone, highlight, optional accent),
limited indexed color palette (~16-24 colors), stylized pixel realism blending Metal Gear
Solid codec portrait aesthetic with F-Zero X pilot select screen and Star Fox 64
briefing screen energy, each pixel deliberately placed with clean readable
silhouette, muted military olive-drab and gunmetal tones with vibrant neon
accent colors, 16-bit to 32-bit era sprite fidelity,
square 1:1 aspect ratio, dithering used sparingly for gradient transitions, chunky bold
pixel linework with 1-2 pixel stroke weight, selective outline (selout) technique —
darker shade of each region's local color along inner edges,
no sub-pixel rendering, no smooth gradients, inspired by
SNK Neo Geo character select portraits and Konami MSX2 character screens,
Metal Gear codec call framing
```

Substitute `[GLOBAL PREFIX]` with the actual contents of `prompts/agent-character-sheet-global-style.md` adapted for a single portrait frame (not a sheet layout).

## Canvas & Framing Specification

- **Output**: Single square image, 1:1 aspect ratio.
- **Resolution target**: 256x256 pixels (scales cleanly to 64x64, 128x128, 512x512).
- **Composition**: Head and shoulders, cropped at mid-chest. Face fills ~60-70% of the frame vertically.
- **Camera**: Straight-on or slight ¾ angle (no more than 15° off-center). Eye-line at vertical center.
- **Background**: Single solid flat color chosen to complement and contrast the character's dominant palette. No gradients, no environment, no transparency. The background color must be visibly different from any large color region on the figure.

## Output Template

Produce a single continuous prompt. Follow this structure exactly, filling in character-specific details from the source description:

```
[GLOBAL PREFIX], single square 256x256 pixel-art portrait of "<CHARACTER_NAME>",
head-and-shoulders composition cropped at mid-chest,

FACE AND HEAD: <facial structure>, <skin tone>, <distinctive facial features — scars, markings, beard, etc.>,
<eye description with color and expression>, <eyebrow style and position>,
<hair style, color, and how it frames the face>,

HEADGEAR / ACCESSORIES: <helmet, visor, headset, goggles, earpiece, or other head-adjacent gear>,

EXPRESSION: "<EMOTION_LABEL>" — <specific acting direction for the expression>,

CLOTHING VISIBLE: <collar, shoulder area, chest — only what's visible in a bust crop>,
<insignia, patches, or distinctive details on visible clothing>,

LIGHTING: directional key light from upper-left, 3-4 tone shading per region,
<any character-specific lighting accent — visor glow, scar luminescence, etc.>,

BACKGROUND: solid flat <background_color_name> (<#hex>) fill, no environment, no effects,

COLOR PALETTE: <color_1 name> <#hex>, <color_2 name> <#hex>, <color_3 name> <#hex>,
<color_4 name> <#hex>, <color_5 name> <#hex>
```

## Mapping Rules

1. **Extract portrait-relevant anchors** from the source:
   - Face shape, skin tone, distinguishing facial features (scars, tattoos, piercings, facial hair)
   - Eye color, shape, and emotional baseline
   - Hair (style, color, length, how it interacts with headgear)
   - Head-adjacent gear (helmet, visor, headset, goggles, mask)
   - Visible collar/shoulder clothing and insignia
   - Dominant emotional register

2. **Derive what the source doesn't explicitly cover:**
   - **Expression**: Pick the single most iconic/default expression for this character. Label it with a character-specific emotion name (prefer "COLD FOCUS" over "SERIOUS", "RARE SMIRK" over "HAPPY").
   - **Background color**: Choose a muted, desaturated tone that contrasts cleanly with the character's face and hair. Cool muted tones (slate-blue, dusk-teal, ash-violet) or warm muted tones (clay, sand, dusty olive) — whichever best opposes the character's dominant warmth/coolness.
   - **Color palette**: Extract 5 dominant colors from the character description. Include skin, hair, primary clothing, accent, and background.

3. **Tone and specificity:**
   - Write concisely — every phrase should be paintable at pixel scale.
   - Avoid vague terms ("nice hair"). Use concrete pixel-art language ("swept-back ash-grey hair with 3-tone shading, lighter strands catching the key light").
   - Include weathering, age, and lived-in details visible at portrait scale.
   - Prioritize silhouette readability — the portrait must be recognizable when scaled down to 64x64.

4. **Pixel art constraints:**
   - No anti-aliasing, no sub-pixel rendering, no smooth gradients.
   - Dithering only at major tone transitions (jaw shadow, hair-to-skin boundary).
   - Selective outline (selout) — darker shade of local color for inner edges, 1px darker-than-background outline on the outer silhouette.
   - Consistent upper-left key light direction.

## Output Expectations

- Produce only the final prompt text — no preamble, no analysis, no markdown formatting around it.
- The prompt is a single block of text meant to be pasted directly into an image generation tool.
- Read `prompts/agent-character-sheet-global-style.md` and adapt its contents for a single portrait (not a sheet layout) before substituting `[GLOBAL PREFIX]`.
