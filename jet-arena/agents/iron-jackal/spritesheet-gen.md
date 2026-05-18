Create a single 2D pixel-art sprite sheet PNG with exact canvas size 448x64 (7:1 aspect ratio, not square).
Use exactly 7 frames in one horizontal row, each frame exactly 64x64, with no gutters, no padding, and no margins.
Frame coordinates are fixed: idle(0,0,64,64), planning(64,0,64,64), attacking(128,0,64,64), hit-target(192,0,64,64), got-hit(256,0,64,64), low-fuel(320,0,64,64), down(384,0,64,64).
No transparency outside frame bounds. No anti-aliasing. Pixel-perfect hard edges.
Palette-limited retro style, 16-bit/32-bit era, 3-tone shading per region.

Character: Iron Jackal
Core visual anchors: tall jackal-eared flight helmet with one torn ear tip; sand-charcoal strike coat with neon amber tally marks; forward-canted chest rig of ammo cells and fuel canisters; narrow lupine muzzle with scarred black nose bridge and tungsten bite-guard; left gauntlet-mounted analog resource clicker
Mood: predatory; methodical; severe; kinetic; disciplined; sardonic

Frame acting direction:

1. idle at x=0 y=0 w=64 h=64 — Hold a neutral prowling stance with head slightly tilted and thumb resting on the gauntlet clicker.
2. planning at x=64 y=0 w=64 h=64 — Raise two fingers to the clicker and angle the muzzle down in a tactical dry-recount check.
3. attacking at x=128 y=0 w=64 h=64 — Lunge forward into a committed kill dive with shoulders pitched and jaw bared in ledger fury.
4. hit-target at x=192 y=0 w=64 h=64 — Keep follow-through with a sharp confirming grin and posture beginning to settle into contract-closed calm.
5. got-hit at x=256 y=0 w=64 h=64 — Snap back in a stagger with torso twisted and trigger arm recoiling in a defensive flinch.
6. low-fuel at x=320 y=0 w=64 h=64 — Hunch into a strained conserving posture, weapon lowered, as the last-burst hesitation shows in his muzzle.
7. down at x=384 y=0 w=64 h=64 — Collapse into an incapacitated defeated sprawl with jackal ears drooped and chest rig splayed.

Do not add labels, borders, UI chrome, or extra frames.
Keep silhouette readable at 64x64.
