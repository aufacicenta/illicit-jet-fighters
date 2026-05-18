Create a single 2D pixel-art sprite sheet PNG with exact canvas size 448x64 (7:1 aspect ratio, not square).
Use exactly 7 frames in one horizontal row, each frame exactly 64x64, with no gutters, no padding, and no margins.
Frame coordinates are fixed: idle(0,0,64,64), planning(64,0,64,64), attacking(128,0,64,64), hit-target(192,0,64,64), got-hit(256,0,64,64), low-fuel(320,0,64,64), down(384,0,64,64).
No transparency outside frame bounds. No anti-aliasing. Pixel-perfect hard edges.
Palette-limited retro style, 16-bit/32-bit era, 3-tone shading per region.

Character: Fat Flamingo
Core visual anchors: broad pink-and-charcoal armored strikecoat with heavy avian wedge silhouette; fractured monocular scope over right eye; neon coral telemetry tattoos on neck/forearms; heavy jaw with broken nose bridge and half-lidded stare; offset holster with long-barrel sidearm and clipped range cards
Mood: disciplined; sardonic; watchful; deliberate; volatile; protective

Frame acting direction:

1. idle at x=0 y=0 w=64 h=64 — Stand low and steady with half-lidded aim, shoulders relaxed, one hand near the holster.
2. planning at x=64 y=0 w=64 h=64 — Dip chin into a quiet lock and check a clipped range card while the scope eye narrows.
3. attacking at x=128 y=0 w=64 h=64 — Lean forward into committed fire with elbows open and sidearm thrust out in close-quarters delight.
4. hit-target at x=192 y=0 w=64 h=64 — Hold follow-through with a crooked grin and slight head tilt as if confirming a clean tag.
5. got-hit at x=256 y=0 w=64 h=64 — Recoil with jaw clenched and torso twisted, left hand grabbing harness strap in a comms-flinch beat.
6. low-fuel at x=320 y=0 w=64 h=64 — Hunch into a conserving posture with weapon lowered, breathing tight and stance guarded.
7. down at x=384 y=0 w=64 h=64 — Collapse into an incapacitated side slump with gear splayed and scope dim, clearly defeated.

Do not add labels, borders, UI chrome, or extra frames.
Keep silhouette readable at 64x64.
