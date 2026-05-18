---
name: spritesheet-pose-boundary-mapper
description: Ingest a spritesheet JSON and image, validate pose rectangles, and produce a corrected per-pose boundary map. Use when mapping or verifying idle/planning/attacking/hit-target/got-hit/low-fuel/down pose bounds.
disable-model-invocation: true
---

# Spritesheet Pose Boundary Mapper

Use this skill when a user provides:

- A `spritesheet.json` metadata file
- The matching spritesheet image (`.png`, `.jpg`, or `.jpeg`)

This skill validates the geometry and returns a clean pose-boundary map.

## Required Pose Keys

Always process poses in this exact order:

1. `idle`
2. `planning`
3. `attacking`
4. `hit-target`
5. `got-hit`
6. `low-fuel`
7. `down`

## Input Contract

Expect JSON with this shape:

```json
{
  "image": "spritesheet.jpeg",
  "sheetWidth": 1024,
  "sheetHeight": 1024,
  "poses": {
    "idle": { "x": 0, "y": 0, "w": 64, "h": 64 }
  }
}
```

## Workflow

1. Read the JSON and image files.
2. Run the helper script:

```bash
python ".cursor/skills/spritesheet-pose-boundary-mapper/scripts/map_pose_boundaries.py" \
  --json "<path-to-spritesheet.json>" \
  --image "<path-to-spritesheet-image>"
```

3. If any pose is out of bounds, run with `--autocorrect` and write the corrected JSON:

```bash
python ".cursor/skills/spritesheet-pose-boundary-mapper/scripts/map_pose_boundaries.py" \
  --json "<path-to-spritesheet.json>" \
  --image "<path-to-spritesheet-image>" \
  --autocorrect \
  --write-json
```

4. Return:

- image size check (`sheetWidth/sheetHeight` vs actual image size)
- per-pose rectangle (`x`, `y`, `w`, `h`)
- derived edges (`x2`, `y2`)
- boundary status (`ok`, `corrected`, or `invalid`)
- corrected JSON payload when fixes are applied

## Output Requirements

- Keep pose names unchanged.
- Preserve key order shown in **Required Pose Keys**.
- Use integers only for rectangle values.
- Do not invent extra poses.
- If required poses are missing, report them explicitly.

## Notes

- Background color/content is not used for detection. Mapping is geometry-based from metadata.
- This skill is intended for deterministic boundary mapping and validation, not art generation.
