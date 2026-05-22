You map a generated spritesheet image to an exact JSON manifest.

Return JSON ONLY. No markdown. No commentary.

Strict output contract:
{
"schemaVersion": 1,
"image": "spritesheet-image.png",
"sheetWidth": <integer > 0>,
"sheetHeight": <integer > 0>,
"poses": {
"idle": { "x": <int>, "y": <int>, "w": <int>, "h": <int> },
"planning": { "x": <int>, "y": <int>, "w": <int>, "h": <int> },
"attacking": { "x": <int>, "y": <int>, "w": <int>, "h": <int> },
"hit-target": { "x": <int>, "y": <int>, "w": <int>, "h": <int> },
"got-hit": { "x": <int>, "y": <int>, "w": <int>, "h": <int> },
"low-fuel": { "x": <int>, "y": <int>, "w": <int>, "h": <int> },
"down": { "x": <int>, "y": <int>, "w": <int>, "h": <int> }
}
}

Rules:

- Use ONLY these top-level keys: schemaVersion, image, sheetWidth, sheetHeight, poses.
- Use ONLY these pose keys: idle, planning, attacking, hit-target, got-hit, low-fuel, down.
- Every coordinate value must be an integer pixel.
- Every pose rectangle must contain the character pose for that state.
- Ensure rectangles are within image bounds.
- If exact pose is ambiguous, choose the nearest visible equivalent and still provide the required key.

Layout & background assumptions:

- The spritesheet is one horizontal row of exactly 7 equally-wide columns, in this fixed order: idle, planning, attacking, hit-target, got-hit, low-fuel, down.
- The background is NOT transparent. Every frame shares the same single solid flat fill color (some muted desaturated tone chosen per-character — slate-blue, dusk-teal, clay, sand, etc.). Detect each pose by isolating the character silhouette against that flat background fill rather than relying on alpha. Do not assume any specific color; sample the corner pixels of the image to identify the background fill.
- Treat the column width as `floor(sheetWidth / 7)`. Place each pose's `x` on its column boundary: idle → 0, planning → 1×col, attacking → 2×col, hit-target → 3×col, got-hit → 4×col, low-fuel → 5×col, down → 6×col.
- Use the same `w` for every pose (the column width), and use the same `h` for every pose (the full image height, or the shared character-band height if there is consistent empty background above/below all figures).
- Anchor `y` at the top of the shared character band — the same value for all 7 poses — so the figure stays vertically aligned across poses when rendered.
- Do NOT crop tightly per-pose. Keeping uniform column-aligned rectangles preserves the figure's scale and alignment across poses; a small amount of solid background inside each rectangle is expected and correct.
- If the actual image width is not perfectly divisible by 7, distribute the remainder so the rectangles still tile the full row without gaps or overlaps.
