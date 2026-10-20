# Responsive sizing v2 — validation

## Layout matrix

**24 viewport sizes; 264 layout/bounds cases.** Sizes:

320×568, 360×640, 375×667, 390×844, 430×932, 600×800, 768×1024, 820×1180, 900×700, 999×700, 1000×600, 1024×768, 1280×720, 1366×768, 1440×900, 1920×1080, 2560×1440, 3840×2160, 844×390, 667×375, 568×320, 1024×500, 900×599 and 1000×599.

Ten states per size: Build, Plants, Care overview, food selection, meal confirmation, My Jumpers, Collection, Journal, Menu and Settings. An additional expanded/bounds case runs per size; where the Expand control is intentionally absent on a short screen, that case checks the already expanded-width short-screen layout.

Checks include viewport containment, minimum usable content height, bounded headers/footers, control bounds, horizontal document/content overflow, and expanded-panel containment. All 264 cases passed, with no runtime errors.

## Interaction and viewport edge cases

**13 additional checks passed:** desktop expanded Build, desktop Menu, mobile expanded/compact Care, simulated top/bottom safe areas for Settings and Care, reduced-height/keyboard-sized viewport, two-times visual-viewport scale, 320 px-wide filters, 568×320 landscape, rotation with an already-open expanded panel, landscape pinned meal confirmation and exact confirmed food quantity release. No runtime errors.

Safe-area values and reduced-height viewports are simulated; they are not claims of testing on every native keyboard, notch or browser chrome implementation.

## Existing-game protections

**32 First Home regression checks passed**, including old-save preservation, new-game backup, empty start, tutorial persistence, invalid and confirmed placement, idempotent addition/feeding, skip cleanup, ordinary additional tank creation/cancellation, keyboard focus, reduced motion, unique IDs and no runtime/console errors.

## Visual review

Representative desktop, phone, tablet and landscape screenshots were opened and checked individually. Visual fixes included:

- Replacing the fixed 364 px desktop panels with 480–840 px fluid widths.
- More useful item grids and taller mobile sheets.
- Keeping Care actions and the final food confirmation outside the scrolling body.
- Larger, bounded Menu/Jumpers/Settings dialogs.
- Correct safe-area spacing.
- Compact filter controls on 320 px portrait screens.
- Horizontal item cards and a compact meal confirmation on the shortest landscape screens.

The layout matrix pauses background simulation after initial startup and manually renders representative frames to isolate geometry from animation. It does not measure game performance. The First Home regression run uses normal game execution.

## Reproduction and evidence

- `fluid-panels/matrix-report.json`: complete layout measurements.
- `fluid-panels/extras-report.json`: viewport/interaction checks.
- `fluid-panels/onboarding-regression/edge-report.json`: First Home regression results.
- Completed run logs and selected screenshots are included.

With Playwright and Chromium installed, serve the game over HTTP, then run:

```sh
GAME_URL=http://localhost:8000 node source/terrarium/tests/responsive-panels.test.js
GAME_URL=http://localhost:8000 node source/terrarium/tests/responsive-panels-extras.test.js
GAME_URL=http://localhost:8000 node source/terrarium/tests/first-home-edges.test.js
```

`CHROMIUM` and `TEST_OUTPUT` can override the executable and output directory. No build step, Playwright or Node package installation is required to play the included prebuilt game.

The source and save format are retained. Earlier QA reports elsewhere in the archive describe prior releases, not a fresh full simulation or performance matrix for this sizing revision.
