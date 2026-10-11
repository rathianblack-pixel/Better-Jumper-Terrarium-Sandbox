# Terrarium v31 — smoother on mid/low phones, one intro film

## Intro
- **2 videos instead of 12**: `intro/intro-landscape.mp4` and `intro/intro-portrait.mp4` (15 s, with music).
  The shots alternate between the art styles as the film plays: drop (HD-2D) → jungle (Storybook) → eyes (Cuphead)
  → flight (HD-2D) → mantis (Cuphead) → title (Storybook). Style changes sit on the existing shot cuts, hidden by
  white flashes / dips. The score switches with the picture.
- The separate menu loop videos were removed. After the film ends the menu shows its still art with light and motes.
- Download size of the intro media: ~120 MB → ~18 MB.
- Built from the existing per-style renders with `/data/intro/combo.py`, so no scenes were re-rendered.

## Performance (same High look)
- **Split resolution** (WebGL2, Storybook + Cuphead): while the camera moves, the ground layer (backdrop, slab, floor,
  uneven ground, wetness, shadows, lamp pools) is painted at a lower scale and stretched over the screen.
  Decor, outlines, ink strokes, critters, paper grain and UI stay at full resolution. It reuses the still-camera cache
  buffers, so it needs no extra memory. HD-2D already renders low-res, so it is unchanged.
- **Dynamic soft-layer scale** (`R.softS`, 1 → 0.55): it reacts within ~0.3 s when frames slip and creeps back up
  when there's headroom (up-steps back off if they fail). Changes cost nothing because no buffers are rebuilt. The old
  whole-canvas resolution drop and the steady-30 lock only kick in once this is at its floor.
- Mid Android phones now start at full line resolution (2×, was 1.75×) with soft scale 0.8. Low phones start at
  1.75× (was 1.5×) with 0.7.
- Shaders that used to compile on first use (still-camera blit, upscale, shadow map) now compile at load in the
  parallel batch, which removes first-use hitches.
- The per-frame lamp uniform buffer is reused, so frames create less garbage.
- Perf overlay (Settings → performance readout) shows `soft 0.xx` while split resolution is active.
  Test switches: `ptNoSplit` (off) and `ptSoft` (force a scale).

## Verified
- Screenshots: full vs 0.8 / 0.6 soft scale look the same in Storybook and Cuphead (ink and outlines unchanged).
- Smoke test (both games × 3 styles × Android/iOS) has no errors. mantis_core passes 65/65. Launcher plays the right
  film per orientation and hands back to the menu.
- I couldn't measure real-device frame rates here (the software GPU is too slow). Check on a phone with the perf overlay.
