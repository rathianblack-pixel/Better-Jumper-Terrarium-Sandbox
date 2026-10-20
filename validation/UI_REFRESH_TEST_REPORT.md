> Superseded sizing: the current layout checks are in `RESPONSIVE_SIZING_TEST_REPORT.md`. This report records the first UI refresh.

# UI refresh validation

## Scope

Chromium with software WebGL, using the rebuilt playable game over local HTTP. Tested sizes: 1280 × 800 desktop, 390 × 844 phone portrait, and 844 × 390 landscape. These are browser checks, not claims about every physical device or a hardware-independent frame rate.

## Results

- **36 interface checks: PASS.** Care, feeding selection and quantity confirmation, explicit release, Recommended Build, Plants, My Jumpers, Collection, expanded discoveries, Journal, Menu and Observe at all three sizes; viewport-bound panels and no horizontal document overflow. No runtime errors.
- **32 First Home edge/regression checks: PASS.** Existing save cancellation/backup, legacy Continue, empty new-game start, wizard persistence, paused tutorial time, invalid and confirmed placement, reload safety, idempotent jumper addition/feeding, skip confirmation and cleanup, additional tank creation/cancellation, keyboard focus, reduced motion, unique IDs and no runtime/console errors.
- **27 final-state checks: PASS.** Refined Care, Build, Plants, meal confirmation, My Jumpers, grouped Settings, collapsed Journal and Observe at all three sizes; usable scrolling bodies and exactly the correct dock item selected.
- **5 short-landscape rechecks: PASS.** After compacting the Build header and filters, Care/Build/Plants/meal retain usable scrolling content; dock selection remains correct. Notifications stay within the viewport rather than extending off its right edge.
- **8 interaction edge checks: PASS.** Cleanup crew separation, unsuitable food blocked, default quantity of two, exact confirmed quantity release, searchable empty state, graphics controls preserved, drinking droplets after Mist and usable Clean action.

## Visual review

Rendered screens were individually inspected. Corrections included readable primary buttons, non-overlapping Care headers, a quieter Jumpers header with tank creation moved below the list, consistent dock highlighting, separate quantity confirmation, landscape catalog space, notification wrapping/bounds and spacing between group labels and cards. Existing procedural portraits and world assets were reused; no placeholder illustrations or external image downloads were added.

## Evidence and reproduction

- `field-journal/report.json`: 36 interface checks.
- `field-journal/final-states-report.json`: 27 refined-state checks, reconstructed from the completed run log because a subsequent focused rerun reused the original report filename.
- `field-journal/landscape-report.json`: focused landscape recheck.
- `field-journal/edge-report.json`: 8 interaction edges.
- `ui-regression/edge-report.json`: 32 First Home regressions.
- Included UI run logs and selected screenshots document these runs.

The editable source includes `tests/field-journal-ui.test.js` and the existing `tests/first-home-edges.test.js`. These use Playwright and Chromium. Set `GAME_URL`, `CHROMIUM` and `TEST_OUTPUT` as needed, following the existing tests' conventions.

The final cleanup-crew label correction and removal of the legacy pulsing Care animation were followed by another interaction-edge run. Historical reports in the project are from earlier releases; the entire simulation, performance and 26-environment matrix was not rerun for this UI-only update.
