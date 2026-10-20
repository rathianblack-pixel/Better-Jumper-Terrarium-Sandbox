# First Home / New Game tests

The New Game start is intentionally empty and action-driven now. Run these dedicated tests against the hosted updated build:

```sh
GAME_URL=http://localhost:8000 CHROMIUM=/path/to/chromium node first-home.test.js
GAME_URL=http://localhost:8000 CHROMIUM=/path/to/chromium node first-home-edges.test.js
GAME_URL=http://localhost:8000 CHROMIUM=/path/to/chromium node first-home-matrix.test.js
```

The first suite uses the real controls on desktop, phone portrait, and phone landscape. The edge suite checks legacy saves, backup/cancellation, save-backed stage/name/tank choices, pause/away behavior, rejected placement, repeated activation, skipping, ordinary additional tanks, keyboard focus and reduced motion. Reports and screenshots default to the release's `validation/first-home/` folder; `TEST_OUTPUT` overrides it.

`regression.js` and `living-tanks.test.js` now create their initial gameplay fixture through the new wizard and explicit Skip/Finish controls. Selected other gameplay suites explicitly finish First Home in their setup before testing unrelated systems. The old additional-tank wizard remains covered separately.

The sections below describe the existing test suites. Earlier packaged output folders are historical; consult the top-level `validation/NEW_GAME_TEST_REPORT.md` for checks actually rerun for this release.

# Browser regression tests

Requires Node, Playwright and Chromium. The game itself does not require these tools.

Host the built release and run:

```sh
GAME_URL=http://localhost:8000 CHROMIUM=/path/to/chromium node regression.js
```

`TEST_OUTPUT` optionally selects the output folder. Defaults to `tests/results`.
Tests cover desktop 1280×720, phone 390×844 at DPR 3, and phone landscape 844×390; HD-2D and Storybook with all four quality settings; live unsaved title preview; Start/New/Continue; confirmation/cancellation and local backup; onboarding, notebook screens, contextual jumper details, Observe and photo pause. Screenshots and a JSON report are written to the output folder.

Included `living-results/regression` reports are from headless Chromium with SwiftShader software rendering. They are not measurements of physical phone performance. The old pixel-budget/intro-story tests were replaced because those behaviors were intentionally removed.

Additional final-build save/defaults/offline checks: `GAME_URL=http://localhost:8000 CHROMIUM=/path/to/chromium node final-check.js`.

## Living Tanks regression tests

With the final release hosted locally:

```sh
GAME_URL=http://localhost:8000 CHROMIUM=/path/to/chromium node living-tanks.test.js
GAME_URL=http://localhost:8000 CHROMIUM=/path/to/chromium node ai-edge-cases.js
```

Tests exercise real creation controls on desktop, phone portrait and phone landscape; lazy inactive state and biological catch-up; camera/selection restoration; previous-tank behavior; favorites/search; capacity checks including a shelf filled while a creation modal is open; care feedback; sensory/ambient/memory fixtures; migration; hidden-target aiming, timing and a five-species simulation soak. Structured reports are in `living-results`. Screenshots supplied with the release are samples, not physical-device performance measurements.

`ai-comparison.js` compares deterministic forced-miss retries with the original release. For reproduction, serve an unchanged copy of the original `jumper.html` as `baseline.html` beside the updated release, then run the script. The baseline is deliberately not shipped as a second playable version. This benchmark does not measure a universal intelligence multiplier.

Wizard action contrast regression (all steps, desktop/phone/landscape, normal/hover/focus): `GAME_URL=http://localhost:8000 CHROMIUM=/path/to/chromium node wizard-contrast.js`.

Shared sheet/drawer spacing audits: `node modal-spacing.js` and `node drawer-spacing.js` with the same `GAME_URL` and `CHROMIUM` settings.

Tank Setup preview/apply/cancel/Undo, saved Undo, inactive freeze, custom presets, occupied molt retreat and both renderer framing checks: `node tank-setup.js`. Evidence is under `living-results/tank-setup/`.

Post-apply simulation and legacy/Menu shortcut checks: `node tank-setup-soak.js` (controlled adult fixtures, 30 simulated seconds per mode).

## Decor safety and foliage
Run against the hosted final build, with the same `GAME_URL` and `CHROMIUM` options:

```sh
node decor-audit.js
node decor-variants.js
node decor-safety.test.js
node foliage-performance.js
```

`decor-audit.js` builds all 216 definitions and records full-mesh samples; decorative foliage/moss/ornamental cap overlaps are reported separately from missing surfaces. `decor-variants.js` checks hard-cap support heights across 1,728 seed/rotation/elevation cases. `decor-safety.test.js` checks retreat clearance, unsafe-site refusal, legacy occupied-retreat reconciliation, wind/cache/quality controls and both real renderer paths. It also renders all 216 catalog thumbnails into six contact sheets. `SKIP_ATLAS=1` skips regenerating those sheets.

Evidence is in `living-results/decor-safety/`. `foliage-performance.js` is a small software-GPU diagnostic, not a phone-performance or zero-cost guarantee. Automated checks do not prove every possible stacked layout or animation pose is clipping-free. The release includes compact reports and selected screenshots; larger screenshot sets are generated when you rerun the tests.

## Rendering and background-care follow-up
`node rendering-background.test.js` verifies cleanup sensory filtering, attention holds, bounded hunger/hydration, partial/completed feeding, premolt/molt/hardening, save-load timestamps, safe legacy migration, no imaginary hunts/deaths, and a 30-tank active-only tick budget. It also exercises both art styles, quality presets, GPU/CPU critter paths and pixel textures, and reads actual output pixels from a controlled synthetic sprite. Screenshots and a JSON report are under `fix-results`.

The catch-up model is an intentional approximation, not full offscreen navigation or hunting. Software-GPU headless tests do not establish physical-phone FPS or battery use.

## Miniature Worlds tests

Run one browser test at a time against the built release:

```sh
GAME_URL=http://localhost:8000 CHROMIUM=/path/to/chromium node world-surround.test.js
GAME_URL=http://localhost:8000 CHROMIUM=/path/to/chromium node world-surround-views.js
GAME_URL=http://localhost:8000 CHROMIUM=/path/to/chromium node world-input.test.js
GAME_URL=http://localhost:8000 CHROMIUM=/path/to/chromium node world-webgl1.test.js
GAME_URL=http://localhost:8000 CHROMIUM=/path/to/chromium node world-hd-mobile.test.js
```

These are development checks requiring Playwright and Chromium; neither is required to play or rebuild the game. `TEST_OUTPUT` sets the output folder. Coverage includes every existing background through the original Settings picker; camera presets, horizon/overhead and zoom limits; follow mode; finite meshes and WebGL errors; temporary obstruction fading and restoration; both art modes at a phone-sized viewport; real wheel, drag and keyboard input; synthetic two-touch handler events; and the WebGL 1 fallback with uint indices disabled. Synthetic touch events and desktop phone-sized viewports are not physical touch-device testing.

## Performance optimization validation

Run `performance-worlds.test.js` and `performance-pacing.test.js` with the same GAME_URL / TEST_OUTPUT / CHROMIUM environment variables. Worlds coverage: all 26 backgrounds × 3 detail levels, baseline geometry comparison using the small historical source fixture, 26 Low previews, six phone camera/art/quality states, conservative culling and settled idle-cache reuse. Pacing checks use stubbed drawing to verify live 60/30 targets and the Auto selection control, not hardware FPS. These tests need Playwright; playing/rebuilding does not. Historical result-image folders referenced above were omitted from this lightweight ZIP; rerun the scripts to generate new evidence.
