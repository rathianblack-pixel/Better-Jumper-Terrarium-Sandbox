# Jumper sex & Tank Setup validation

Result: **PASS**. Tested with headless Chromium / Linux / SwiftShader. This is automated browser and visual QA, not a physical-phone, Safari, battery or thermal benchmark.

## Current evidence

- `sex-and-tank-setup/report.json` — desktop 1280×900, phone 390×844, landscape 844×390. Required First Home choice, collection confirmation/cancel/live previews, one-time legacy choices including holding cup, profile labels, save/reload/growth/moving, direct Tank Setup and Build shortcut, background Apply/Cancel/Undo, untouched biology and decor, background changes during molt, layout replacement acknowledgement, layout Undo, biome-only furnishing preservation, and layout molt protection.
- The matrix generates 384 nonempty sex/stage portraits per viewport: **32 species × 2 sexes × 6 growth stages**. Adult sexes differ; male proportions progress monotonically; shared species definitions remain unchanged. It also exercises Storybook and HD-2D with Classic and GPU critter painting enabled in turn. No page errors were recorded.
- `sex-and-tank-setup/legacy-wizard-report.json` — actual old-save startup prompt, persistent one-time choice, additional-tank wizard choice, imported legacy save prompt, and access to enclosure/management controls. No page errors.
- `sex-and-tank-setup/ai-edge-cases.json` — unchanged hidden-prey aiming, strike timing, molt recovery, and five-species simulation soak.
- `sex-and-tank-setup/final-check-report.json` — unsaved preview, previous-save compatibility, retained graphics/foliage preferences, render-resolution floor, offline cached title and Continue.
- `sex-and-tank-setup/appearance-atlas.png` — manually inspected representative female/male sling/adult silhouettes, including Phidippus, peacock, ant mimic, Magnolia, giant and Portia.
- Desktop and phone background/sex-choice captures are included in the same folder.

The final background-only tray omits its irrelevant Reroll action to keep phone Apply/Cancel/Undo compact. Engine scripts were also parsed for syntax errors, and root/built release parity is recorded in RELEASE_VALIDATION.json.

## Run the current checks

Serve the rebuilt release and, with Playwright and Chromium available, run:

```sh
GAME_URL=http://localhost:8000 CHROMIUM=/path/to/chromium node source/terrarium/tests/sex-and-tank-setup.test.js
GAME_URL=http://localhost:8000 CHROMIUM=/path/to/chromium node source/terrarium/tests/sex-legacy-wizard.test.js
GAME_URL=http://localhost:8000 CHROMIUM=/path/to/chromium node source/terrarium/tests/ai-edge-cases.js
GAME_URL=http://localhost:8000 CHROMIUM=/path/to/chromium node source/terrarium/tests/final-check.js
```

Older test fixtures that assume immediate spawning, skip sex selection, or expect the previous tank-name menu must be adapted to the new explicit-choice/direct-setup workflow. Earlier validation folders and their screenshots describe previous releases; they are not claims about this release.
