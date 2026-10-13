# Browser regression tests

Requires Node, Playwright and Chromium. The game itself does not require these tools.

Host the built release and run:

```sh
GAME_URL=http://localhost:8000 CHROMIUM=/path/to/chromium node regression.js
```

`TEST_OUTPUT` optionally selects the output folder. Defaults to `tests/results`.
Tests cover desktop 1280×720, phone 390×844 at DPR 3, and phone landscape 844×390; HD-2D and Storybook with all four quality settings; live unsaved title preview; Start/New/Continue; confirmation/cancellation and local backup; onboarding, notebook screens, contextual jumper details, Observe and photo pause. Screenshots and a JSON report are written to the output folder.

Included `release-results` are from headless Chromium with SwiftShader software rendering. They are not measurements of physical phone performance. The old pixel-budget/intro-story tests were replaced because those behaviors were intentionally removed.

Additional final-build save/defaults/offline checks: `GAME_URL=http://localhost:8000 CHROMIUM=/path/to/chromium node final-check.js`.

## Living Tanks regression tests

With the final release hosted locally:

```sh
GAME_URL=http://localhost:8000 CHROMIUM=/path/to/chromium node living-tanks.test.js
GAME_URL=http://localhost:8000 CHROMIUM=/path/to/chromium node ai-edge-cases.js
```

Tests exercise real creation controls on desktop, phone portrait and phone landscape; full inactive-state and clock freeze; camera/selection restoration; previous-tank behavior; favorites/search; capacity checks including a shelf filled while a creation modal is open; care feedback; sensory/ambient/memory fixtures; migration; hidden-target aiming, timing and a five-species simulation soak. Structured reports are in `living-results`. Screenshots supplied with the release are samples, not physical-device performance measurements.

`ai-comparison.js` compares deterministic forced-miss retries with the original release. For reproduction, serve an unchanged copy of the original `jumper.html` as `baseline.html` beside the updated release, then run the script. The baseline is deliberately not shipped as a second playable version. This benchmark does not measure a universal intelligence multiplier.

Wizard action contrast regression (all steps, desktop/phone/landscape, normal/hover/focus): `GAME_URL=http://localhost:8000 CHROMIUM=/path/to/chromium node wizard-contrast.js`.

Shared sheet/drawer spacing audits: `node modal-spacing.js` and `node drawer-spacing.js` with the same `GAME_URL` and `CHROMIUM` settings.

Tank Setup preview/apply/cancel/Undo, saved Undo, inactive freeze, custom presets, occupied molt retreat and both renderer framing checks: `node tank-setup.js`. Evidence is under `living-results/tank-setup/`.

Post-apply simulation and legacy/Menu shortcut checks: `node tank-setup-soak.js` (controlled adult fixtures, 30 simulated seconds per mode).
