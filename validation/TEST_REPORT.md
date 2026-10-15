# Validation — Optimized Miniature Worlds

Playable HTML SHA-256: `1fc7f352551588371f47c9374be8fa0d364df2c888a364252a73f59568a2e8b6`.

## Completed checks

- **78 optimized geometry builds:** all 26 existing backgrounds at Low / Medium / High. All mesh vertices finite; every external batch Uint16, within 63,000 vertices and indexed within its own bounds. Geometry generation leaves saved habitat data unchanged.
- **78 baseline builds:** same preview habitat against the preserved pre-optimization source fixture. The CSV records every background/tier, counting uploaded triangles independently of the older world's reported stats.
- **26 desktop Low renders** at 700×520, all visually inspected. No WebGL or frame errors. Ordinary observer framing keeps the habitat unobstructed.
- **Six phone-sized render states** at 390×844 across Storybook / HD-2D, Low / Medium / High, reverse low horizon, overhead, maximum zoom and follow mode. All render/error checks passed; normal and overhead framing visually inspected. Extreme reverse low-horizon views can expose the finite outer terrain edge, a pre-existing limitation preserved in High; this optimization does not introduce an infinite world or restrict the original camera controls.
- **Culling:** one controlled reverse/zoomed-out view independently compares actual projected mesh vertices with the cluster visibility flag; no intersecting cluster is discarded.
- **Idle cache:** after a real-time fade and settled orbit, two consecutive renders submit **zero world-mesh calls**, with the static cache built and fading false. Creatures, live foliage, fullscreen blits and post-processing can still cost GPU time: this is not a zero-cost frame claim.
- **WebGL 1 fallback:** WebGL 2 unavailable and uint indices disabled; mossy, waterfall and snowfield render at 844×390 with valid 16-bit batches and no errors.
- **Input:** actual mouse wheel, drag and keyboard reset; synthetic two-pointer pinch and midpoint pan through the existing touch handler. Not a physical touch-hardware test.
- **Existing regression suite:** 30 behavior checks, 28 rendering combinations and actual sprite-pixel checks in both art styles passed. Four desktop/phone art-mode screenshots inspected.
- **Persistence / offline:** six checks passed: unsaved preview, previous-save identity, one-time settings migration, later user preference persistence, Auto native-resolution floor, and offline cached Continue.
- **Frame-rate controls:** live-loop target changes checked at 60 / 60 / 30 for Smooth / Auto / Battery saver, with drawing stubbed. This verifies configuration, not achieved GPU FPS. The real Settings Auto button restores the lightweight device-tier start. Mobile graphics settings screenshot inspected after the background-label overflow fix.
- **Source audit:** 38 ordered engine modules and 43 generated inline scripts parse; all 13 service-worker pre-cache files exist. No new runtime dependencies.

## Geometry workload (not a frame-rate benchmark)

These are pooled **external scenery triangles built** across all 26 backgrounds for the same preview habitat, not whole-game triangles, visible submitted triangles, bytes, timing, FPS or battery use.

| Detail | Before | Optimized | Fewer scenery triangles |
| --- | ---: | ---: | ---: |
| Low | 1,825,701 | 803,758 | 56.0% |
| Medium | 1,825,701 | 937,595 | 48.6% |
| High | 1,825,701 | 1,825,701 | 0% (unchanged per background) |

Compare `geometry-comparison.csv`, `geometry-summary.json` and the raw `report.json`. Scene geometry varies by habitat dimensions and detail tier. Lower polygon count does not imply an equal FPS increase.

## Environment and limits

Headless Chromium on Linux with SwiftShader software WebGL. **No measured physical-phone, Safari, sustained thermal, battery, or hardware 60-FPS guarantee.** Preliminary software timing runs were discarded; the release makes no timing-speedup claim. Very large tanks, many creatures, maximum zoom, expensive lens effects and weak GPUs may still miss 60 FPS. Background tabs pause rendering. Existing saved High preferences remain High; use Low + Smooth and turn blur / sway off for the lightest 60-FPS-target settings.

Selected current screenshots are included; historical screenshot collections and duplicate `source/dist` output were omitted from the ZIP to reduce download bulk. Test scripts can regenerate complete captures. Playing needs no build step; rebuilding needs Node, while browser regression tests additionally need Playwright and Chromium.
