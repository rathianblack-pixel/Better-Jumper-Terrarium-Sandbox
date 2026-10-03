# Jumper Terrarium

A calm naturalist sim about keeping jumping spiders in open terrarium displays.
Pure HTML/CSS/JavaScript: no frameworks, no build step, no external assets. All art and audio are procedural.

## Play
- **Single file:** open `dist/jumper-terrarium.html` in any modern browser (works offline from `file://`).
- **Project:** open `index.html`, or serve the folder with any static host (`npx serve .`, GitHub Pages, Netlify…).

## Controls
| Action | Desktop | Touch |
|---|---|---|
| Follow a jumper | click it (or Follow / `3`) · click empty space or Follow again to stop | tap it (or Follow in the dock) · tap empty space to stop |
| Orbit while following | drag (auto-framing resumes after a few quiet seconds) | drag |
| Pan / zoom | drag · mouse wheel · `+` `-` `0` | drag · pinch |
| Cameras | `1` Iso · `2` Observer · `3` Follow · `4` Reverse | More, then Camera |
| Observation Mode | `O` or Observe · `Esc` exits | Observe |
| Place decor | pick a piece, then click · `R` rotate · `Esc` cancel | drag the ghost · Rotate / Done |
| Basking lamp | click the lamp to switch it on or off | tap the lamp |
| Mist | toolbar or `M` | More, then Mist |

## What to watch for
- **Follow camera** (`js/camera.js`): frames the upper body from the side the jumper's back faces — from above at an angle on the floor, facing the wall on a wall, round to the visible side under ledges. Damped springs, capped and shortest-way yaw, dead-bands so it can come to rest, a lead toward the landing (and a slightly wider view) during jumps, clamped to the habitat and to a pitch range where floor or wall never fill the screen.
- **When the food runs out** there are no badges or pop-ups: hungry jumpers patrol their perches in turn, climb high to scan with stepwise head turns and lunge at anything moving (springtails, falling leaf bits, other jumpers). Very hungry ones are more restless and wander further. The abdomen slims when hungry and fills out after a meal. The Food control slowly breathes warm, and the jumper panel shows one short state line.
- **Small behaviours**: eye and palp cleaning, palp flicks, looking around in steps, a curious head tilt toward a close and still camera, a stretch after waking, sideways scuttles, a brief dangle on silk from a ledge, drinking droplets (mist and morning dew) on leaves and walls, a silk safety line dabbed before jumps, and a favourite home spot to rest in.
- **Basking Lamp** (Decor): a warm pool of light on the surfaces below, warm highlights and longer shadows thrown away from it, a visible glow at night. Jumpers seek it in the morning, when it is cool and after a meal, and bask pressed flat. At night moths and flies circle it and settle in its light.
- **Clean-up crew**: springtails and isopods seek out prey husks *and* molt skins, gather round and nibble them until they shrink and fade away; more springtails clean faster. A small colony keeps breeding while there is food or moisture. Jumpers ignore springtails unless starving. Remains with no cleaners slowly decay.

## Structure
```
index.html, style.css
js/core.js         namespace, seeded RNG, vector + polygon math
js/data.js         habitats, substrates, backgrounds, 21 species, 18 prey, 77 decor, journal, presets
js/geometry.js     decor archetypes -> drawable primitives + walkable surfaces (one source of truth)
js/nav.js          physical-surface navigation graph, Dijkstra routing, supports, frames
js/world.js        Habitat (placement legality, stacking, reconciliation, ownership), shared locomotion
js/spider.js       jumper AI: needs, priority model, hunting state machine, molting, feeding, social
js/prey.js         prey + cleanup crew locomotion (fly/hop/burrow/climb/hide/land)
js/presets.js      adaptive themed layouts, custom presets, starter terrarium
js/game.js         shelf of habitats, economy, unlocks, time, persistence + migrations, settings
js/render*.js, draw-*.js   camera, backgrounds, depth-sorted scene, post FX, picking, thumbnails
js/audio.js        procedural WebAudio music / ambience / effects
js/camera.js       smart follow camera (pure maths, unit tested)
js/ui.js, main.js  interface, input, mobile dock, main loop
tests/             headless simulation tests (Node) + browser screenshot scripts (Playwright)
build.js           bundles everything into dist/jumper-terrarium.html
```

## Rendering performance

- **Still camera → one picture.** When the camera is at rest, background, substrate, decor, remains, silk and all
  grading are rendered once into a finished image. Each frame blits it and repaints only small rectangles around
  jumpers, prey and falling leaves (with the same grading applied locally, so there are no seams).
- **Moving camera → re-projected caches.** Every decor piece and the substrate are cached as images clipped to the
  viewport. When the camera moves, each cache is drawn with a best-fit 2D affine warp (exact for pan/zoom, very close
  for small rotations); only caches whose error passes a pixel threshold are re-rendered, within a ~3 ms budget per
  frame. Once the camera rests, everything is made pixel-exact again (no lasting blur). Off-screen pieces are skipped.
- **Post-processing in place**: no full-screen scene copy; tilt-shift draws only the blurred bands; warm tint,
  vignette and grain are one pre-baked overlay.
- **Follow camera** settles faster and re-centres lazily (holds still while the jumper potters nearby), so it rests
  more often and can use the one-picture path.
- Auto quality only drops resolution if rendering really is slow, and returns to full sharpness once it is cheap again.
- Follow / observe: parts of the followed jumper hidden behind decor or plants are shown softly see-through (60%), using a mask of only what is in front of it, inside its small box.
- `tests/prof.js` (per-section ms, still vs moving) and `tests/frame-prof.js` (live sim/UI/render split) measure it.

## Tests
```
node tests/run-tests.js   # deterministic simulation tests (navigation, hunting, feeding, molting, cleanup, save/load, long run)
node build.js             # rebuild the single-file version
node tests/interaction.js # browser: tap-to-follow, orbit + pause, lamp toggle, no emoji, 44px targets, no console errors
node tests/feature-shots.js                                              # screenshots: desktop, phone portrait, phone landscape
URL=file://$PWD/dist/jumper-terrarium.html node tests/feature-shots.js   # same against the single-file build
```
Saves are versioned (v3 adds lamp on/off and home spots); older saves migrate on load.
Debug overlay (nav graph, routes, states, targets): Settings ▸ Debug overlay.
