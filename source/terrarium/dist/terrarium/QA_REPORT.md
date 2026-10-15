# QA — Natural habitat edges

## Scope

The approved cosmetic shoreline/embedded-bank rework. Playable boundaries, collision, movement and placement remain unchanged. Tests use headless Chromium on Linux with SwiftShader, not physical phone hardware.

## New checks

- 72 tank/seed cases across all 9 existing enclosure types: outward-only shoulders, finite top geometry, exact rectangular-corner coverage, deterministic legacy-ID seeds, distinct outlines for different tank IDs, reload stability, background-switch stability, unchanged floor polygon and unchanged navigation reference.
- 78 scenery geometry builds: all 26 backgrounds at Low, Medium and High. Every uploaded value finite; all batches use Uint16 indices within their own vertex bounds and the existing 63,000-vertex ceiling.
- All 26 backgrounds rendered at Low with no WebGL/frame errors.
- Seven final render states: woodland/desert/snow on desktop; woodland/crystal cave in HD-2D at 390×844; reverse overhead and low-horizon views. Captures visually inspected, including mobile margin, buried lower edge, preserved decor and background-specific edge colours.
- Seven real save checks: legacy import without shoreline seeds, preserved decor coordinates/rotations/IDs/seeds, deterministic seed migration, updated save reimport, seed survival through actual game serialization, terrain-reroll stability and background-switch stability.
- Shadow lookup on the added shoulder uses world coordinates instead of mirrored substrate UVs, avoiding repeated decoration shadows; the old slab walls are suppressed in colour and HD-2D depth passes.
- Syntax audit: all 39 ordered engine modules and 44 inline scripts parse; all 13 service-worker precache assets exist.

## Retained compatibility checks — PASS

See the JSON reports in `validation/natural-edges/` for actual results:

- Existing desktop, phone and landscape regression flow: launcher, Continue/New, save backup, onboarding, quality/art settings, Build/Care/Menu, selected jumper, Observe and photo mode.
- WebGL 1 fallback with uint indices disabled on woodland, waterfall and snow scenes.
- Unsaved title preview; previous-save identity; existing one-time graphics preference migration; later user preference persistence; full-resolution Auto floor; cached offline launcher and Continue.

## Limitations

- Cosmetic extension only: the added shoulder is not legal placement or navigation space. No inward cuts or save-layout repositioning.
- No physical-phone, Safari, sustained GPU FPS, battery or thermal benchmark was performed. More geometry does not imply a frame-rate guarantee.
- Existing distant-world/camera limitations remain: extreme zoom-out or horizon angles can expose the finite scenery extent.
- Other validation files and historical test captures retained from the supplied ZIP describe older revisions. The current release manifest and natural-edges reports identify this build.
