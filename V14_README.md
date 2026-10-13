# Better Jumper Terrarium Sandbox — v14 Biomes

## Start here
Extract the whole ZIP. Keep index.html, sw.js, manifest.webmanifest and icons together. Open index.html for local play, or deploy the folder to your existing static host for service-worker/offline support.

**v14 starts a new game.** It uses the new localStorage slot `jumperTerrarium.v14.save`; it does not import the previous save automatically or delete the old slot. After this first fresh start, v14 saves and resumes normally. Clearing browser/site data still removes local saves.

Choose an enclosure → choose an unlocked jumper → choose a biome and either its recommended layout or an empty layout. For another tank, open Tanks → New tank. All biomes are available from the start; jumper species still follow the existing unlock progression.

## What changed
- Ten climates plus Classic: Rainforest, Desert, Paludarium, Night Moss, Ant Kingdom, Southern Heath, Old Bark Forest, Urban Garden, Prairie Meadow and Cloud Forest.
- Jumper-first guided setup; recommended habitats and an empty-layout option that still applies climate, substrate and background.
- Searchable build drawer with Ideal / Suitable / Show all. The primary resident and chosen biome guide availability. Essential water and lighting stay available. Show all permits experimentation with a warning; Classic remains free build. Removing residents does not destroy their habitat.
- Fifteen new native pieces: heliconia, drip vine, wet leaf litter, saguaro, barrel cactus, sandstone arch, pond, lily pond, cattails, mudflat, glow moss, blue fungus, ghost fern, ant acacia and woven leaves.
- Ponds have floor-reachable drinking points, solid water boundaries, no water-top platforms and no nesting. Arches have separate pillars and a continuous top. Cacti have their own build category. Both graphics paths use the pond water colours.
- Climate chip and detail sheet, home labels, native decor badges, native-first collection sorting, biome-aware tank list/edit/duplication, and biome-preserving undo.
- Temperature and humidity, weather events, capped event prey, gentle comfort/speed/trust effects, seven journal entries, habitat-match feedback and reachable microclimate destinations.
- Rain/mist, dust/heat, pond ripples, fireflies, ambient ant patrols and an urban sunlight patch. Particle quality scales; biome animation freezes in photo mode and when hidden.
- Existing v13 collision and narrow-perch leg-grip work retained, along with undo/redo, photo mode, hybrids, smart tanks and minimized placement/removal drawer behaviour.

## Important behaviour
- Switching biome: OK rebuilds a recommended layout; Cancel keeps current decor while changing the climate. The viewed tank gets an undo step.
- Weather advances only in the tank being viewed. Offscreen catch-up adjusts climate; it does not invent a history of offscreen storms or hatches.
- Habitat suitability and species homes are game-design assignments, not real animal-care instructions. Secondary biomes are comfortable alternatives. Comfort effects are deliberately gentle.
- The main game modules are inlined into index.html. No external biome JavaScript downloads are required.
- The service-worker cache is named from the first ten SHA-1 characters of the final index.html.

## Verification
- All script blocks passed Node syntax checks.
- Existing regression suites: coinfree 28/28, tanks 28/28, personality 9/9, species 17/17, hunting 26/26 and hybrids 20/20.
- Simulation and scenario suites completed successfully.
- Biome tests passed for all 90 enclosure/biome combinations (nine tank types × ten non-Classic biomes), including metadata, home coverage, layout compatibility, pond presence/drinking/nest restrictions, climate and event factors, journals, paused offscreen weather, and short finite-position simulations.
- Headless Chromium checks at 412×860, 360×740 and 1100×780 exercised setup, recommended layouts, biome sheets, drawers, collection ordering/badges, search and compatibility filters, photo freeze, keep-decor editing, undo, and reload persistence. No captured JavaScript console errors in the passing run.

### Still unverified / limitations
- The camera test timed out in this environment and is not recorded as passing.
- No real-phone FPS, battery/thermal or physical touchscreen testing.
- Long-session balance, unusual manually stacked pond placements and every possible decor/species collision were not exhaustively tested. Layout tests used fixed seeds and short simulations; they do not prove every random layout is perfect.
- Browser tests used local file loading with software WebGL. Hosted installation and service-worker update lifecycle were checked structurally, not on a live deployed site.
- The visual ant patrol is ambient; specialised ant/plant-food interactions are lightweight game behaviours, not a full ant-colony simulation.

## Included developer tests
Run Node tests from the extracted folder: the existing tests remain under tests/, alongside biomes.js and biomes_browser.js. The latter uses Chromium's DevTools pipe and Node's built-in modules. Set CHROMIUM to your local Chromium executable and GAME_URL to the game URL (including file:// if desired). It creates screenshots and a JSON result under output/. BIOME_TANK may select one enclosure type when running biomes.js.
