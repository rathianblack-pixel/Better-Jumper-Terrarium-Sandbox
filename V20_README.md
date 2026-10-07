# v20 — Soft oval see-through window

Built on v19 (validated). All earlier features and fixes are kept.

When decor hides a jumper in Observe or TV mode, the see-through window around it changes:
- **Sized to the jumper.** The clear core matches its body and legs (it grows with each molt), plus a small margin. A sling gets a small window, an adult a larger one. Before, every jumper got a fixed-padding circle that was far too big for small ones.
- **Oval.** The window follows the body's direction on screen. It becomes round when the jumper faces the camera or away from it. Size, direction and position ease smoothly, the oval doesn't swing when the jumper turns round, and it moves with the jumper every frame.
- **Fully clear inside.** No faint trace of the decor is left inside.
- **Long, soft edge.** Beyond the core, the decor fades back in over about 0.65 × body length. The dark outlines fade with the same gradient instead of being cut off sharply.

## Tests
- All suites pass (terrain, coinfree, tanks, personality, species, hunting, hybrids, biomes, decor_clearance, sim, scenarios, camera). Smoke tests (b1, TV, v17 fade test) show no errors.
- Browser check: the window around a Tiny Sling and a Young Adult inside plants (forced fade), with no hard ring and nothing left inside.
