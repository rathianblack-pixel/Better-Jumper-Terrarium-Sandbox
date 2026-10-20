# First Home — guided New Game

This release replaces the automatic populated New Game with a player-built first home. Existing Continue saves, species unlocks, and the normal additional-tank wizard are retained.

## Play

1. Extract the entire ZIP.
2. In the extracted directory, run `python -m http.server 8000`.
3. Open `http://localhost:8000/`, then **Start Game → New Game**.

No install, internet connection, or external assets are needed. Use HTTP/HTTPS rather than opening the HTML file directly. The service worker cache version has been refreshed; a different localhost port is an easy way to inspect this release without an old installation's cache.

## The new experience

- **Tank:** Nano Cube is selected and recommended. All nine existing enclosures remain available, with proportion-based UI previews and capacity information.
- **Jumper:** Choose from unlocked species, see their procedural portrait and description, and optionally name them. A new save still begins with Peacock Spider; progression has not been bypassed.
- **Habitat:** Home/suitable biomes appear first. All other climates remain available as clearly labelled experimental options.
- **Build:** Begin with no animals or furnishings. The real Build control is spotlighted; place a suitable small furnishing in the actual scene.
- **Make it cosy:** Explicitly apply a matching layout around the placed piece. Valid placements are checked against existing decor; the player's piece is never replaced.
- **Welcome:** Use Jumpers and the explicit Add button to introduce the named sling.
- **Feed:** Use Care and explicitly release two prey selected for the sling's actual size. The first food is not necessarily fruit flies—tiny Peacock slings may need smaller aphids or gnats.
- **Observe:** Follow the resident in the real Observe mode. The simulation resumes; the introductory card fades away automatically after about 11 visible seconds, or immediately on Enjoy my terrarium. A successful hunt is never required.

## Tutorial behavior

- Semi-darkened surroundings, a clear interaction cutout, and a soft warm glow around the actual control.
- A single short instruction per action, with small progress labels and personalised wording.
- Skip tutorial opens a confirmation describing exactly what Finish setup will add. Existing jumper/food additions are not duplicated.
- Care and aging pause during the explanatory steps, including browser absence during an unfinished tutorial. Observe resumes normal simulation.
- Refresh resumes the saved stage. Transient drawers/placement ghosts return to their safe entry step, not a duplicated mutation.
- Old beginner-tip cards are suppressed during guidance. Other contextual tips remain available afterward.
- No mandatory misting: hydration advice is contextual rather than applying the same care action to every climate.

## Controls and accessibility

- Mouse/touch: use the highlighted real control. On touch, choose a clear tank position and tap **Place piece**.
- Keyboard: Tab/Shift+Tab cycle through the current action and tutorial controls; Enter/Space activate controls. During placement, arrow keys move the ghost, and Shift+arrow moves further. Green indicates a valid spot.
- Escape returns from a drawer/placement/arrival to the preceding safe step; from a main guidance step it opens the skip confirmation.
- Browser Back integrates with the tutorial's safe step navigation.
- Reduced-motion preferences disable the portrait/glow animations and completion fade.
- Off-path shortcuts are blocked only while guidance is active, not in normal play.

## Saves

- The save format remains version 4, with an additive `firstHome` object, version 1.
- The previous save is backed up locally under `jumperTerrarium.v14.save.before-new` when starting over.
- Cancelling New Game on the title screen does not replace the save.
- The unsaved title showcase remains independent from the player's real world.
- Old saves without `firstHome` do not launch this tutorial. An old unfinished biome wizard keeps its original flow.
- Local backups are not cloud backups. Use the existing export/import controls to keep an independent copy of important progress.

## Editable source

- `source/terrarium/engine/27f-first-home.js`: complete First Home UI, saved stages, spotlight, pause gate, layout completion and safeguards.
- `source/terrarium/engine/28-boot-main-loop-fixed.js`: choose the empty guided start for a fresh real game, gate simulation accumulation, and integrate browser Back.
- `source/terrarium/engine/09-game-state-shelf-of.js`: suppress wall-clock catch-up during an unfinished First Home session.
- `source/terrarium/engine/order.json`: load First Home before boot.

Rebuild:

```sh
cd source/terrarium
node build.js
```

Serve `source/terrarium/dist/terrarium/` to test the rebuilt output. The ZIP's top-level game files are the ready-to-run output from that same source. Do not edit only the generated HTML.

## Validation

See `validation/NEW_GAME_TEST_REPORT.md` for tests run on this release and their scope. Dedicated reproducible tests live in `source/terrarium/tests/first-home.test.js` and `first-home-edges.test.js`. Existing gameplay test fixtures were updated where they previously assumed the old instant populated start.

Tests use headless Chromium with software WebGL and desktop, phone-sized, and landscape viewports. This is not physical iPhone/Android, Safari, screen-reader hardware, battery, or FPS certification. Earlier reports elsewhere in the archive describe earlier releases.
