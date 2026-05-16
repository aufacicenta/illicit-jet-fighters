---
name: battlefield-config-generator
description: Generate a jet-arena battlefield-config.json from a battlefield description markdown file. Use when the user asks to convert a battlefield description into playable arena geometry, walls, spawn points, and canvas aspect settings.
disable-model-invocation: true
---

# Battlefield Config Generator

Convert a battlefield description (for example `jet-arena/battlefields/<slug>/battlefield-description.md`) into a valid `battlefield-config.json` for `jet-arena`.

## Target Output

Write exactly one JSON file at:

`jet-arena/battlefields/<slug>/battlefield-config.json`

Use this shape:

```json
{
  "name": "Battlefield Name",
  "shape": {
    "type": "polygon",
    "vertices": [[x, y], ...]
  },
  "walls": [
    { "segments": [[x1, y1], [x2, y2], ...], "altitudeMin": 0, "altitudeMax": 1 }
  ],
  "spawnPoints": [[x, y], [x, y], [x, y], [x, y]],
  "canvasAspect": [4, 3]
}
```

## Hard Constraints

These are mandatory:

1. Arena is navigable end-to-end (at least one path across extremes).
2. Jets may get briefly stuck but must be able to get out.
3. Corridors/gaps must be wider than a jet:
   - minimum width `JET_HIT_RADIUS * 2 + 4` (currently 36 units).
4. Spawn points are inside boundary and not on walls.
5. Keep tunnel-ready support via altitude-gated walls:
   - full wall: `altitudeMin: 0, altitudeMax: 1`
   - tunnel opening behavior: set lower `altitudeMax` for pass-over routes.

## Geometry Mapping Rules

Map description sections into geometry:

- **Environment Stack + History**: choose overall boundary footprint (usually polygon).
- **Terrain Features**:
  - chokepoints/canyons/halls -> interior walls and corridor grids
  - open killing grounds -> sparse/no walls in that zone
  - edge features/ridges -> boundary shape bias and defensive lines
- **Engagement Zones**:
  - ensure at least 3 tactical regions in geometry (tight lanes, open center, edge/sanctuary).
- **Hazards**:
  - hazards are not encoded directly in config yet; reflect them indirectly via space shaping only.

Prefer asymmetry over mirrored layouts.

## Recommended Scale and Defaults

- Boundary extent: roughly x/y in range `[-650, 650]`.
- Typical polygon vertices: 5-9 points.
- Walls:
  - 8-20 wall entries
  - each wall is a polyline with 2+ points
- Spawn points:
  - 4 points for 4-player default
  - place near distinct quadrants, with fair path access.
- `canvasAspect`: default `[4, 3]` unless battlefield strongly implies wide/tall framing.

## Generation Workflow

1. Read `battlefield-description.md`.
2. Extract named features and zone intent.
3. Draft boundary polygon first.
4. Add interior walls to create tactical flow:
   - maintain one guaranteed route between major regions
   - avoid fully sealed pockets.
5. Add optional altitude-gated wall(s) for tunnel-ready paths if description supports vertical play.
6. Place spawn points with adequate clearance.
7. Output `battlefield-config.json`.

## Validation Checklist (Before Finalizing)

- [ ] JSON is valid.
- [ ] `shape.type` is `polygon` or `circle` (prefer polygon for described battlefields).
- [ ] All coordinates are numeric.
- [ ] No wall polyline has fewer than 2 points.
- [ ] Spawn points are inside boundary and not overlapping walls.
- [ ] At least one traversable path exists between opposite sides of map.
- [ ] Narrowest planned corridor is >= 36 units.
- [ ] If a tunnel-like route exists, at least one wall uses altitude gating (`altitudeMax < 1`).

## Output Rules

- Produce the `battlefield-config.json` file content only.
- Do not rewrite the battlefield description.
- Do not add commentary inside JSON.
