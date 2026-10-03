# Jumper Terrarium

A calm naturalist sim about keeping jumping spiders in open terrarium displays.
Pure HTML/CSS/JavaScript: no frameworks, no build step, no external assets. All art and audio are procedural.

## Play
- **Single file:** open `dist/jumper-terrarium.html` in any modern browser (works offline from `file://`).
- **Project:** open `index.html`, or serve the folder with any static host (`npx serve .`, GitHub Pages, Netlify…).

## Controls
| Action | Desktop | Touch |
|---|---|---|
| Select a jumper | click it | tap it |
| Pan / zoom | drag · mouse wheel · `+` `-` `0` | drag · pinch |
| Cameras | `1` Iso · `2` Observer · `3` Follow · `4` Reverse | More ▸ cams |
| Observation Mode | `O` / 📹 Observe · `Esc` exits | Observe button |
| Place decor | click a card, then click · `R` rotate · `Esc` cancel | drag the ghost · Rotate / Done |
| Mist | toolbar or `M` | More ▸ Mist |

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
js/ui.js, main.js  interface, input, mobile dock, main loop
tests/             headless simulation tests (Node) + browser screenshot scripts (Playwright)
build.js           bundles everything into dist/jumper-terrarium.html
```

## Tests
```
node tests/run-tests.js   # deterministic simulation tests (navigation, hunting, feeding, molting, cleanup, save/load, long run)
node build.js             # rebuild the single-file version
```
Debug overlay (nav graph, routes, states, targets): Settings ▸ Debug overlay.
