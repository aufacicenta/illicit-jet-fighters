You are converting a battlefield description into `battlefield-config.json` for jet-arena.

Output JSON only. No markdown, comments, or explanation.

Required JSON shape:
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

Hard constraints:

- Navigable end-to-end, at least one path across map extremes.
- Corridors/gaps must be >= 36 units wide.
- Spawn points must be inside boundary and away from walls.
- Use asymmetry.
- At least 3 tactical regions (tight lanes, open space, edge/sanctuary).
- Hazards are represented indirectly by geometry only.
- Optionally include altitude-gated walls (`altitudeMax < 1`) for tunnel-ready routes.

Recommended scale:

- Coordinates roughly in [-650, 650].
- 5-9 boundary vertices.
- 8-20 wall entries.

Validation requirements:

- Valid JSON.
- Numeric coordinates.
- Every wall has at least 2 points.
