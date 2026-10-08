# Terrarium engine — Jumper Terrarium + Mantis Terrarium

One shared engine, one pack per game.

```
engine/            shared engine, split by module (order in engine/order.json)
packs/jumper/      Jumper Terrarium: page shell (head/tail HTML) + static files (icons, manifest, offline worker)
packs/mantis/      Mantis Terrarium: identity, species, mantis body drawing, behaviour layer, wording, static files
build.js           node build.js [pack...]  ->  dist/<game>/index.html (+ static files)
tests/             browser checks (Playwright + system Chromium)
```

A pack's `pack.json` lists scripts to inject before named engine files, so a pack can replace content
(species, stages, names) or engine parts (e.g. `Draw.spider`) without editing the engine.

Engine hooks added for packs (the jumper game behaves exactly as before):
- `window.JT_PACK` — save/settings keys (each game keeps its own saves)
- `JT.Draw.critter` exports the shared drawing primitives (blob, limb, wing, curve, shading, shadows, decals)
- `JT.SpiderAI.NO_SILK` — turns off silk lines, draglines and dangling for critters that make no silk

## Mantis Terrarium status
- Stage 1 — shared engine + build: done (jumper build verified identical before hooks; still passes browser smoke test)
- Stage 2 — mantis body: done. 6 species, 6 growth stages (curled-up nymph abdomen, wing buds at sub-adult,
  wings at adult), poses: idle, walking (4-leg diagonal gait), sway, alert, stalk, strike, threat display,
  grooming, sleeping droop, holding a meal. Head turns to look; pseudopupils face the viewer.
- Stage 3 — mantis behaviour: done (`packs/mantis/mantis-ai.js`, drawing in `mantis-draw.js`)
  - no silk anywhere: no draglines, retreats, hammocks or dangling; sleeps still on a perch
  - head snaps between fixes; sway-stalk; two-phase strike (short lunge to arm's reach, forelegs shoot out,
    then sweep in); strikes from a stem without leaving it
  - eats where it caught the prey; carries it off only when disturbed (another mantis close, your finger,
    decor added/moved/removed nearby) — prey wandering past no longer moves it
  - molts hanging head-down from a stem/branch with room below; the new body slides out below the old skin;
    the shed skin (nymph-sized) stays hanging on the twig until it drops off on its own
  - adults only: short fluttering flights (wings beat) now and then, max ~1/3 tank; nymphs hop
  - threat display (forelegs spread, wings fanned) when startled by your finger or approached by another mantis
  - cannibalism: hungry mantises treat a smaller tank-mate as prey
  - tests: `tests/behave.js` (fast-forward scenarios: hunt/feed, poke while feeding, startle, flight, molt),
    `tests/setup_molt.js`, `tests/setup_threat.js`, `S3=1 tests/lineup.js` (strike/fly/hang poses)
- Stage 4 — feeding, decor, biomes, icons, journal: done
  - `mantis-meal.js`: prey is eaten alive, held below the jaws; it thrashes, then the struggle fades;
    bite tugs and crumbs; parts drop one by one per prey family (fly: legs, wings, head last; moth: legs,
    dusty wings, antennae, head; cricket: antennae, small legs, big hind legs, head; mealworm/caterpillar
    shrinks segment by segment; mantis prey: legs, wings, raptorial arms). Parts fall to the floor and fade.
    Long foreleg/face grooming afterwards.
  - `decor.js`: (no lid — mantises hang and molt from the high tips of twigs, stems, flower spikes and bark) Molting Cross-Perch,
    Tall Twig, Twig Tangle, Flower Spike, Orchid Spray, Dead Leaf Branch; presets Orchid Garden, Dry Leaf Forest
  - `biomes.js` + `homes.js`: new biomes Orchid Garden 🌸 and Dry Leaf Forest 🍂; homes: orchid & spiny →
    Orchid Garden, ghost → Dry Leaf, carolina → Old Bark, chinese/european → Prairie
  - `journal.js`: spider-only entries removed (silk, dragline, retreats, spider specialities), texts reworded;
    new: Eaten Alive, Leftovers, Clean Forelegs, Hanging Molt, Short Flight, Threat Display, Waiting in the
    Flowers, Hidden in Plain Sight
  - mantis app icons (`packs/mantis/art/icon.svg` → `static/icons/*.png`)
  - tests: `tests/meal.js` (meal stage sheet), `tests/setup_biome.js`, `tests/wizard.js`, `tests/ui_check.js`
- Stage 5 — full test pass + packaging: done
  - mesh lid removed (old saves have it stripped on load); molting prefers high tips of twigs, stems,
    flower spikes and bark with open air below
  - `tests/mantis_core.js` (headless, 35 checks: species, unlock chain, 2-per-tank cap, nano cap, decor,
    biomes, homes, journal, all 6 species hunt & eat, save/load, mantis-only save key)
  - `tests/legacy/` = original Jumper suite; `sh tests/run_legacy.sh <index.html> [outdir]`.
    Jumper build: identical to original v22 (all pass; groundcover/growth_away were already stale in v22).
    Mantis build: failures only in spider-specific checks (peacock/portia/hybrids/spider homes).
  - Playable zip: `index.html` at the top = Mantis Terrarium; `jumper/index.html` = Jumper Terrarium;
    `source/` = this project

## Terrarium (combined app)
- `node build.js` builds `dist/jumper-terrarium/`, `dist/mantis-terrarium/` and `dist/terrarium/`:
  `index.html` = title screen ("Terrarium" → Start → Jumping Spiders or Mantises), `jumper.html`, `mantis.html`,
  one manifest, one service worker, neutral glass-dome icons (`packs/terrarium/art/icon.svg`).
- Separate worlds: each game keeps its own save, tanks, unlocks and journal. In-game ⋯ menu → Terrarium →
  "Switch to …" / "Title screen" (`packs/terrarium/switch.js`). The title screen shows "Continue · tanks · day" per game.
- Droplets (shared engine `engine/18a-sized-droplets.js`): mist/dew drops sized to the critters in the tank
  (r ≈ 0.22 tiny sling … 0.75 big adult mantis; before 0.6–1.5), plus a few smaller random beads beside some drops.
- Tests: `tests/combined.js` (title → pick → mantis → switch → jumper → title), `tests/setup_mist.js`.
