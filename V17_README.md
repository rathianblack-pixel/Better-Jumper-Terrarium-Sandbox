# v17 — Observe camera rework, smoother shop drawer, Ambient TV

## 1. Observe camera
- **Line of sight against the real shapes** (`JT.Sight`): rock/cork prisms, trunks, stems, logs, pots and grass blades
  (capsules), leaves, flower heads and caps. Thin stems and grass let some of the view through.
- The planner tries views nearest-first (24 yaw steps × 3 heights, plus high views when nothing near is clear) and
  scores clear views, the face side and staying close to the current angle. It only switches for a clearly better view.
- **Fade fallback**: anything still in front of the jumper on screen (mid-swing, or no clear view exists) fades to
  see-through in a soft circle round the jumper. It eases in over 0.3 s and out over 0.5 s. Ground cover and back walls never fade.
- Cost: views are culled per body point (cone test) and scoring stops early once a view can't win.
  Per-frame camera cost averages 0.33 ms in Node (v16: 0.09 ms), with rare 8–16 ms planning frames.
- Results (deterministic headless run, 113k frames, all themes): jumper mostly hidden 12.9% → 9.3% of frames,
  and 1.35% once the fade is counted. Belly views +1.5%, yaw jerk +10% (more deliberate re-angling).

## 2. Shop drawer (Decor / Plants / Ground)
- Cards are built once and reused when a tab opens again. Re-opening a tab takes about 9 ms instead of 38 ms on desktop.
- Thumbnails are painted on-screen cards first and never for cards hidden by a filter. They wait while a finger scrolls the strip.
- Painted thumbnails are kept on the device (IndexedDB, keyed per build), so after the first visit every picture shows straight away.
- The card drop shadow is painted into the thumbnail once. Before, a CSS drop-shadow filter sat on ~70 canvases.
- Touching or scrolling the drawer no longer pushes the tank to 60 fps, which leaves the GPU free for the strip.

## 3. Ambient TV
- Start it from the TV button in the Observe bar, Menu → View → Ambient TV, or the `T` key. Every control fades away.
- A director picks the subject: hunts, molts, meetings and feeding come first, and it varies who it watches.
  Shots last 30–45 s, and it never cuts away mid-hunt or mid-molt (up to +25 s). It cuts early when something starts elsewhere.
- Shot styles: follow, close-up (slow push), wide, slow orbit. Sway and zoom go through the observe camera, so views stay clear.
- Nearby subjects: the camera glides over. Far subjects: a soft dip to dark, then the new shot.
- Any tap, click, scroll or key brings the controls back (still observing). Esc again leaves Observe.
- No captions, multi-tank, sleep timer or keep-awake (as agreed).
