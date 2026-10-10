# Terrarium — v23: HD-2D art style (after Octopath Traveler)

Both games (Jumping Spiders and Mantises) now render in an "HD-2D" look: a pixel-art diorama lit and filmed like a modern 3D game.
Switch back any time: **Menu → Settings → Graphics → Art style → Storybook** (the original ink-and-watercolour look, unchanged).

## What changed
**Pixel art diorama**
- The 3D scene (backdrop, slab, ground, decor, critters) is rendered at a low "pixel" resolution (about 2 CSS px per pixel on a laptop,
  1.6 on phones) and scaled up with crisp nearest-neighbour pixels. No MSAA, so edges stay hard.
- Light on decor is banded into 4 steps with a 4×4 Bayer dither (classic pixel-art shading).
- Ink outlines snap to at least one pixel, so every object keeps a dark 1-px outline.
- Critter sprites are painted at the pixel resolution, sampled nearest, with hard alpha and a 1-texel outline (real pixel sprites; the sprite sheet is smaller too).
- Colours are richer: the cream "paper" wash on textures is cut to 30% and the paper grain overlay is gone.

**Lens & light (full resolution, on top of the pixels)**
- Depth of field + tilt-shift: sharp around the tank centre (or the watched critter in Observe), blurring with depth and towards the top and bottom of the screen. Observe uses a shallower, macro-style focus.
- Warm bloom from bright areas (cooler at night).
- Light shafts falling from the sun side, plus warm haze.
- Floating dust motes on the pixel grid (they turn into green fireflies at night).
- Colour grade: a bit more saturation, cool shadows, warm highlights, gentle filmic contrast, moonlit blue at night; heavy stage vignette.
- New dusky backdrop with soft out-of-focus light orbs per background.

**UI**
- Octopath-style menu windows: deep navy gradient, thin gold frame with an inner line, cream text, gold highlight for the current item (◆ marker), square corners. Applies to the top bar, dock/toolbar, panels, menu, settings, tips, toasts and the title screen.

**Settings** (Graphics)
- Art style: HD-2D (default) / Storybook.
- Pixel size: Fine / Classic / Chunky.

## Files
- New: `engine/21a-hd2d-post.js` (low-res target, blur/bloom passes, composite shader, backdrop) — added to `engine/order.json`.
- `engine/21-storybook-renderer-part-2.js`: renders into the HD-2D target when it is on (viewport/target hooks, depth pass for floor/slab/terrain, pixel sprites, banded light, paper-tint switch).
- `engine/09-…`: new setting defaults `art: 'hd2d'`, `pixel: 'classic'`. `engine/25-…`: the two new Graphics settings.
- `packs/jumper/shell/head.html`: `body.hd2d` UI theme. `packs/terrarium/launcher.html`: title screen theme.

## Notes
- Needs WebGL2. On WebGL1 the game draws the Storybook look as before.
- Checked in headless Chromium (software GL): desktop and phone viewports, Iso, Observe, night, settings, Storybook toggle, `tests/combined.js` with no errors.
  Software GL is about 20% slower than before (13 vs 17 fps on the phone test). On real GPUs the low-res scene should cost about the same or less. Not tested on real phones yet.

## v23.1 — readability pass
- Critters are drawn last, at full screen resolution (still crisp pixel sprites with a 1-px outline), so they no longer vanish into the low-res scene. They still hide behind decor, using the scene's depth.
- Finer pixels: Classic is now about 1.25–1.75 CSS px per pixel (was 1.6–2.6), Fine is 1 CSS px, and Chunky is 1.5× Classic.
- Lens blur is now a setting (Settings → Graphics → Lens blur): Off / **Light** (default, 20% of the old strength, one blur pass) / Strong (the original v23 blur).

## v23.2 — calmer particles
- Removed the screen-wide shader dust/firefly motes (they floated outside the tank).
- Backdrop bokeh orbs cut from 34 to 9 and made much dimmer/softer.
- In-tank daytime dust motes reduced to 1/3 and dimmed in HD-2D mode. Biome fireflies inside the tank are unchanged.

## v24 — "Cuphead" art style (Settings → Graphics → Art style: HD-2D / Cuphead / Storybook)
After Studio MDHR's Cuphead: 1930s rubber-hose cartoons (Fleischer, Disney, Iwerks), hand-inked cels over watercolour backgrounds, on old film.
- Rendered at screen resolution through the same post pipeline (engine/21a), with its own composite shader (CUP_FS):
  bold ink outline wherever depth jumps, thick near-black inverted-hull outlines on decor (1.55x) with 12 fps "line boil",
  3-step cel shading (uHD=2), thicker black ink on critter sprites, warm Technicolor-ish grade mapped between ink-black and cream,
  soft halation, backdrop slightly softened.
- Old film (Settings → Old film: Off / Light (default) / Full): grain refreshed at 24 fps, gate weave and scratches held on twos (12 fps),
  dust and hairs, exposure flicker, heavy burnt-edge vignette.
- Watercolour backdrop (HD2D.cupCanvas): cream paper, washes with pooled darker edges, layered rolling hills, puffy outlined cartoon clouds, paper tooth.
- UI theme body.cuphead: cream card-stock panels, 2.5px ink outlines, rounded corners, hard offset drop shadows, cartoon-red active state, bold uppercase sans labels.
