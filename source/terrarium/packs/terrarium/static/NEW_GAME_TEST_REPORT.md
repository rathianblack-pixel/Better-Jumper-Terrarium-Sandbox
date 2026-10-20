# New Game / First Home — release validation

## Scope

Validation of the new empty, guided First Home start, with regression checks for the existing game. These results refer to the game files shipped at the top level of this archive and the matching editable source.

## Passed checks

| Suite | Result | Coverage |
| --- | --- | --- |
| First Home full flow | PASS | Real controls on desktop 1280×800, phone 390×844 and landscape 844×390; Nano recommendation, naming, biome selection, empty start, real placement, preserved furnishing, explicit jumper addition, two explicit prey, Observe, completion and Continue. |
| First Home edge cases | PASS | 32 assertions covering unsaved preview, legacy Continue, New Game cancellation and exact backup, saved name/tank/step, experimental climates, foreground/away pause, invalid placement, refresh recovery, duplicate activation, skip/resume, post-skip ordinary building, additional-tank creation/cancellation, keyboard focus, reduced motion, live-ID uniqueness and no runtime errors. |
| Observe handoff | PASS | Settled, fully readable introduction in all three layouts; refresh during Observe resumes guidance without duplicating the resident; introduction completes automatically without requiring a catch. |
| Configuration matrix | PASS | All 99 combinations of nine existing tank types and eleven biomes, with furnishings, a water source, exactly one starter resident and two suitable prey, finite coordinates and unique live IDs. |
| Failure recovery / keyboard / Back | PASS | Injected layout interruption rolls furnishings back and restores global game/RNG ownership. Keyboard-only Build → furnishing → confirmed placement. Safe tutorial Back-handler transitions. |
| Existing release / offline checks | PASS | Six checks covering independent unsaved preview, prior-save identity, existing preferences/default migrations, render-resolution floor, offline cached title and Continue. |
| Rendering and background care | PASS | 30 behavior checks, 28 renderer combinations, sprite-pixel checks in both existing art styles; no reported errors. |
| Living Tanks | PASS | Five existing test groups, including real creation/cancellation, active/inactive simulation, catch-up, saved views, capacity and existing behavior fixtures. |
| Tank Setup | PASS | Desktop, phone and landscape preview/apply/cancel/Undo, saved Undo, unchanged biology/clock/IDs, molt protection, climate-only changes, inactive preservation and both art-style framing checks. |
| Additional-tank wizard contrast | PASS | 27 cases: all three steps × normal/hover/focus × desktop/portrait/landscape. |
| Full existing UI regression | PASS | Desktop 1280×720, portrait 390×844 (DPR 3), landscape 844×390; 24 art-style/quality rendering cases; title/New/Continue/backup, Build, Care, menu/settings, species/journal, selection, Observe and photo pause; zero reported runtime/console errors. |
| Source/build audit | PASS | All 41 engine JavaScript files parse. Top-level `index.html`, `jumper.html` and `sw.js` match the generated build. Only the new First Home module, script order, boot integration and unfinished-tutorial away-time handling changed in the engine. |

## Visual review

The new picker and guidance states were captured and reviewed at desktop, portrait and landscape sizes. Review caught and corrected landscape target clipping, excess hidden-control spacing and guide/target collisions. The final spotlight positions keep the real action visible, and small landscape screens retain scrolling content with separate action chrome.

Tutorial color pairs were checked separately: primary white-on-olive buttons 6.01:1, body copy 6.54:1, eyebrow labels 4.60:1, selected-card secondary copy 4.91:1, recommendation badge 5.69:1 and prey-release button 9.52:1.

## Regression-fixture changes

The intentionally different New Game flow required existing tests to set up their gameplay fixture through First Home's explicit finish option instead of assuming a populated tank. The additional-tank wizard itself was not replaced.

A pre-existing Tank Setup assertion compared complete `serialize()` strings across elapsed wall time. That includes a freshly generated `savedAt` timestamp on every call. The test now removes only this mutable export timestamp before comparing state; all actual game state, biology, decor, IDs, clocks and preview-isolation assertions remain checked. The corrected suite passed.

## Reproduce

Serve the extracted release, then run the scripts in `source/terrarium/tests/` with Node, Playwright and Chromium installed:

```sh
GAME_URL=http://localhost:8000 CHROMIUM=/path/to/chromium node first-home.test.js
GAME_URL=http://localhost:8000 CHROMIUM=/path/to/chromium node first-home-edges.test.js
GAME_URL=http://localhost:8000 CHROMIUM=/path/to/chromium node first-home-matrix.test.js
GAME_URL=http://localhost:8000 CHROMIUM=/path/to/chromium node first-home-observe.test.js
GAME_URL=http://localhost:8000 CHROMIUM=/path/to/chromium node final-check.js
GAME_URL=http://localhost:8000 CHROMIUM=/path/to/chromium node rendering-background.test.js
GAME_URL=http://localhost:8000 CHROMIUM=/path/to/chromium node tank-setup.js
GAME_URL=http://localhost:8000 CHROMIUM=/path/to/chromium node living-tanks.test.js
GAME_URL=http://localhost:8000 CHROMIUM=/path/to/chromium node wizard-contrast.js
GAME_URL=http://localhost:8000 CHROMIUM=/path/to/chromium node regression.js
```

`TEST_OUTPUT` can select a report directory for suites that support it. Machine-readable reports for this release are in `validation/first-home/` and `validation/new-game-regression/`. Selected tutorial captures are included; rerunning the tests regenerates broader gameplay screenshots.

## Limitations

Tests used headless Chromium with SwiftShader software WebGL, including phone-sized viewports and touch-input emulation. This is not a physical iPhone/Android, Safari, assistive-hardware, battery or frame-rate certification. The 99-configuration matrix tests layout/initial-state safety for the fresh save's unlocked starter species; it does not claim exhaustive testing of every possible later player-created arrangement or animal behavior. Earlier reports elsewhere in the archive describe earlier releases.
