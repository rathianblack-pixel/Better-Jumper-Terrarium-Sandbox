# Release QA report — Jumper Terrarium

## Result
Final browser regression, sustained-session and additional gameplay suites: **PASS**. No JavaScript page errors or error-level console messages were captured by these suites.

## Test environment and limits
Linux, headless Chromium, WebGL2 via SwiftShader software graphics. Phone profiles emulate viewport, pixel ratio, touch, user agent and reported memory/CPU values; they are not physical Android/iOS devices or native Safari. This is a functional/workload validation, not a temperature, battery-life or real-device frame-rate certification.

| Profile | Viewport | Pixel ratio | Reported memory / cores |
|---|---|---|---|
| Samsung A12-like | 412 × 915 | 1.75 | 4 GB / 8 |
| iPhone 12 Pro-like | 390 × 844 | 3 | unavailable |
| Older laptop-like | 1366 × 768 | 1 | 4 GB / 2 |

## Final regression matrix
24 cases: all three profiles × HD-2D/Storybook × Auto/Low/Medium/High quality.

Each case checked successful WebGL rendering, finite jumper positions, unchanged selected quality, a 30-fps render target in Auto frame-rate mode, pixel-budget ceilings, and no HD-2D initialization failure or game-reported graphics errors. These checks do **not** mean each device was measured achieving 30 fps.

Additional regressions:
- Opening-story pages, entering/resuming gameplay, replaying the intro, and title navigation.
- Three-step enclosure/jumper/habitat first-run wizard completed with real UI clicks.
- Original supplied-build save export/import, preserving the jumper name, habitat and species.
- Settings buttons for both art styles and High quality.
- Feeding, misting, save export/import and persistent reload.
- Observe/Follow, photo-mode simulation pause, hidden-tab pause/resume.
- High-quality resolution backoff without changing the High selection.
- Phone landscape resizing within the pixel budget.
- Reduced-motion manual intro and cached offline game launch.

## Additional gameplay checks
- An old unsupported art-style preference migrated to Storybook without losing progress.
- Actual WebGL context antialiasing is disabled.
- Decor placement and geometry rebuild succeeded.
- Build, Care, Jumpers and Journal controls opened successfully.
- Photo capture completed.
- Desktop file:// launch reached live gameplay.

## Sustained-session and resource tests
- Twelve alternating art-style changes: newly allocated texture/buffer counts returned to comparable levels instead of accumulating; Storybook released the HD-2D postprocessing buffers.
- Forced WebGL context loss/restoration: GPU resources rebuilt and gameplay resumed without graphics errors.
- Six-minute visible High-quality run: three minutes HD-2D followed by three minutes Storybook. High remained selected; context stayed available; no game-reported graphics errors or JavaScript/console errors occurred.

## Visual inspection
Reviewed desktop/mobile title screens, all three opening-story chapters, both gameplay styles on all three viewport profiles, phone landscape, Settings and photo mode. Replaced a font-dependent mobile picker glyph with a CSS caret. Interface text remains native-resolution; only the world-render buffer scales down.

## Packaging checks
- Retired content names/paths scanned across the complete delivered source and runtime files: none present.
- Runtime local links and offline precache paths all resolve.
- All JavaScript source files and inline HTML scripts parse.
- Only local runtime assets; no CDN dependency.
- Duplicate generated dist output excluded; editable source and rebuild script retained.
- Archive integrity and source-to-runtime reproducibility checked before delivery.

## Physical-device follow-up
Start with High + Auto frame rate. Run your usual tank for 20–30 minutes on each real device and check frame pacing, warmth and battery use. On a crowded habitat or software-only laptop, use Medium/Simple detail if necessary. No browser-only test can guarantee zero heating, zero throttling, universal compatibility or a completely bug-free game.
