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

## Mantis Terrarium v1.2 (Jumper Terrarium unchanged — `jumper.html` is byte-identical to v1.1)
New files in `packs/mantis/`: `mantis-ai2.js` (species signatures + behaviour polish), `mantis-life.js` (sex,
courtship, egg cases, hatching), `mantis-save.js` (old-save migration), `atmos.js` (breeze, leaf drift,
pollinators), `atmos-draw.js` (egg cases, hatchlings, drifting leaves), `mantis-ui2.js` (Female/Male on the profile).
- **8 new species** (unlock order after orchid): boxer → budwing → bark → stick → dead leaf → violin →
  giant Asian → devil's flower. Each has data, drawing (`mlook`), behaviour flags (`mflags`), home biome, egg-case
  shape and journal entry + hint.
  - boxer: pumps raised forelegs at a nearby mantis or finger; quick, twitchy walk
  - budwing: cannot fly; stubby-wing buzz display with a dry clicking rattle (WebAudio noise clicks)
  - bark: dashes on bark/trunk faces, then freezes pressed flat
  - stick: lies flat along twigs, forelegs stretched forward; very slow
  - dead leaf: plays dead when startled (drops off its perch, lies tucked and still, then rights itself); rocks like a leaf
  - violin: slow rocking walk, takes only flying prey (unless starving), hangs patiently from high twigs
  - giant Asian: bold, takes the biggest prey, barely bothered by your finger while eating, comes to the glass to stare
  - devil's flower: hangs upside-down from tips and sways like a bloom; huge display with blue/purple foreleg lobes
- **Polish (all mantises)**: peering head-rock before a strike; missed strikes (more likely for flying/fast prey,
  young nymphs, long reach; prey flees; short pause; "Missed!"); swaying in the breeze in phase with the decor
  (dead leaf/devil's flower more); eye wiping; drinking (head lowers, drop shrinks away; nymphs pick tiny beads);
  finger tracking head-first, body turning later; night shift (ghost, violin, dead leaf, devil's flower stay up
  hunting after dark); darker when cold, brightening as they warm/bask; colour shift at a molt toward the biome
  (green in wet/tropical, brown in dry/litter/bark) for Chinese, European, Carolina, ghost, dead leaf, stick,
  giant Asian — stored per mantis (`sp.morph`), saved, written to the diary.
- **Life cycle**: `sp.sex` for every mantis (old saves get one at random); adult male creeps up from behind,
  freezes when she looks, mounts; paired ~40–85 s; she may eat him (more likely when hungry); later she climbs to
  a high twig and lays an egg case (`hab.data.ooth`, pale → hardens/darkens after ½ day, per-species shape);
  hatches after 2½ days: up to 36 visible nymphs stream out on threads, dangle, drop and scatter; the tank keeps
  what fits (tank cap + 2 per species), up to 3 go to the holding cup, the rest are released — one toast only.
  Old adults (>16 days grown) slow down and fade a little (no death).
- **Decor**: Bamboo Stalks, Spanish Moss Hangings, Dead-Leaf Cluster, Upright Bark Slab (explicit biome tags via
  `def.mtags`; added to Orchid Garden / Dry Leaf / jungle / bark themes). Orchid Garden: flying prey visit the
  flowers, hover, land and stay (more often near a flower mantis). Dry Leaf Forest: autumn leaves tumble down
  (≤ 6 at once), settle and fade; mantises snap their heads round, prey may startle.
- Tests: `tests/mantis_core.js` (65 checks: 14 species, unlock chain, homes, journal ids, sex in saves incl. old
  saves + holding cup, courtship → egg case → hatch with cap respected, eaten by mate), `tests/behave.js`
  (+ peering, missed strike, tiny bead, play dead, wing buzz, boxing, life cycle, wind sway + leaves, basking
  colour, molt colour, pollinators), `SIG=1 tests/lineup.js` (signature poses), `ONLY=… CELL=… tests/lineup.js`.

## v1.3 — performance pass (both games)

Same look and same simulation, cheaper frames.

- **Still-camera cache** (renderer, WebGL2): while the camera rests, the static layer — backdrop, slab, ground,
  terrain, shadows, lamp pools, decor and its ink — is painted once into an offscreen buffer (colour + depth,
  4× MSAA resolved) and every frame starts from a copy of it. Swaying plants, soil mounds, critters, silk and
  the paper grain are still drawn live, depth-tested against the cached depth. The cache rebuilds when the
  view, light/grade (rounded to 1/256), lamps, ground marks, wetness, decor or the set of swaying plants
  changes; it is skipped while the camera moves, in build mode (placement ghost) and on WebGL1, and its memory is
  released after 15 s of continuous camera motion. Test switch: `ptNoCache`.
- **Sprite sheet without read-back**: each repainted critter is painted into a small CPU canvas of its own size
  and copied straight into its slot of the GPU sheet (`texSubImage2D` from the canvas, premultiplied). No more
  `getImageData` + per-pixel un-premultiply + garbage per sprite. Old path: test switch `ptOldAtlas`.
- **Frame pacing**: *Auto* now also draws idle scenes at 60 fps while the device keeps up. If idle frames can't
  hold ~50 fps for 3 s it goes back to 30 fps for a minute (two after a repeat). Idle-60 never lowers the
  resolution by itself. *Battery saver* (always 30) and *Smooth* (always 60) are unchanged.
- Measured with headless Chromium + software GPU at a 390×844 @2× phone viewport (only ratios are meaningful):
  see the v1.3 hand-off notes. Jumper legacy suite: outputs identical to v1.2 (apart from wall-clock `ms`).
