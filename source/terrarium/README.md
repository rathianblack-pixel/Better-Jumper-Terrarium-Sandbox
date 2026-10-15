# Editable Terrarium source

Run `node build.js` to generate `dist/terrarium`. The release launcher lives in `packs/terrarium/launcher.html`; shared game HTML/CSS is in `packs/jumper/shell/head.html`. `engine/order.json` gives script order. `engine/22-renderer-camera-rigs-frame.js` defines resolution presets; `engine/21a-hd2d-post.js` handles HD-2D scene sampling; `engine/28-boot-main-loop-fixed.js` handles Auto adaptation and safe preview/New Game boot.

Only generated `dist` and top-level release files should be hosted. See the release README and tests README for play and validation instructions.

The Living Tanks changes are in `engine/27a-living-tanks.js` plus targeted clock, hunt, molt, prey-animation and UI edits in the original modules. Keep `engine/order.json` in sync; the feature layer loads before boot.

Shared modal spacing is in `engine/27b-modal-layout.js`; disposable Tank Setup previews, commit/Undo, shortcuts and preview-only camera framing are in `engine/27c-tank-setup-preview.js`. Boot skips simulation and interpolation while the setup preview is open.

Decor cap geometry and wind weights are in `engine/20-storybook-renderer-part-1.js`; shared GPU mesh/outline uniforms and cache classification are in `engine/21-storybook-renderer-part-2.js`. Support masks and saved-support reconciliation are in modules 04/05, and next-stage molt clearance in 06. `engine/27d-decor-safety-and-foliage.js` adds whole-retreat overhead checks, occupied-silk synchronization and bounded cosmetic wind selection. This layer loads before boot.

## Miniature Worlds rework

`engine/28b-miniature-worlds.js` replaces the historical mossy-only module in the build order. It supplies all 26 scene recipes, continuous land/water geometry, WebGL 1-safe 16-bit batches, selective cluster fading coordinated with the static cache, and a modest observer framing margin. `engine/21a-hd2d-post.js` now uses highlight-headroom-aware bloom/shafts to preserve bright terrain detail. The original simulation, navigation, background selection IDs and save schema are unchanged.

See the top-level README for the per-background change table and the current `validation/` directory for actual testing, screenshots and limitations. Supplied-version reports in `docs/previous-release/` are historical, not current validation.

Pre-existing `tests/fix-results/` and `tests/living-results/` files came with the input and are historical. New rework results are in the top-level `validation/` directory.

## Optimized build

The performance changes are in 28b (tiered scenery, direct small-mesh uploads, projected-AABB culling, nonblocking draw-state handling and faster slow-frame fade settling), 21 (include scenery detail tier in the habitat mesh cache key), 22 (lighter initial Auto tier and subpixel observer-camera settling), 21a (Low bloom path), 25 (correct settings descriptions / Auto reset), and 28 boot (honor Battery saver’s saved value). Simulation/save modules are unchanged. The top-level README documents recommended performance settings. Historical result-image folders and duplicate dist output are omitted from the lightweight ZIP.
