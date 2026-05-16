Create a single 2D pixel-art sprite sheet PNG with exact canvas size 448x64 (7:1 aspect ratio, not square).
Use exactly 7 frames in one horizontal row, each frame exactly 64x64, with no gutters, no padding, and no margins.
Frame coordinates are fixed: idle(0,0,64,64), planning(64,0,64,64), attacking(128,0,64,64), hit-target(192,0,64,64), got-hit(256,0,64,64), low-fuel(320,0,64,64), down(384,0,64,64).
No transparency outside frame bounds. No anti-aliasing. Pixel-perfect hard edges.
Palette-limited retro style, 16-bit/32-bit era, 3-tone shading per region.

Character: SOLOMON
Core visual anchors: bald head and close white beard; long royal-purple command coat with gold epaulettes; reading glasses on gold neck chain; brass trumpet in hand; warm dark-brown skin and authoritative posture
Mood: composed, commanding, strategic, warm, dangerous

Frame acting direction:
1) idle at x=0 y=0 w=64 h=64 — Stand or sit upright in calm command stance, trumpet lowered, eyes steady forward.
2) planning at x=64 y=0 w=64 h=64 — Lean slightly toward a tactical readout with one hand signaling orders and focused calculating gaze.
3) attacking at x=128 y=0 w=64 h=64 — Snap into decisive command action, arm thrust forward while lifting trumpet like a battle cue.
4) hit-target at x=192 y=0 w=64 h=64 — Hold a brief confirmed-victory beat with subtle satisfied smile and squared shoulders.
5) got-hit at x=256 y=0 w=64 h=64 — Recoil with coat flaring and defensive twist, expression tightened but controlled.
6) low-fuel at x=320 y=0 w=64 h=64 — Sink into a strained conserving posture, trumpet lowered and shoulders heavy yet alert.
7) down at x=384 y=0 w=64 h=64 — Collapse into an incapacitated final pose with coat spread and trumpet slipped aside.

Do not add labels, borders, UI chrome, or extra frames.
Keep silhouette readable at 64x64.
