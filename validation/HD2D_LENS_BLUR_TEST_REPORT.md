# HD-2D lens blur validation

Environment: headless Chromium on Linux with SwiftShader (software WebGL2).

## Rendering checks

- Off, Light and Strong render with HD-2D active and no GL errors at desktop 960×640, phone 390×844 and landscape 844×390.
- Low, Medium and High × Fine, Classic and Chunky × Off, Light and Strong: 27 setting combinations.
- Additional Light and Strong screenshots in night/follow mode.
- Screenshots are full-page browser captures, not the transparent 2D creature/particle overlay.

## Controlled render-target assertions

The test feeds known colour/depth patterns into the actual HD-2D framebuffer and runs the production post-process shaders.

- Uniform RGB (64,128,192) remains unchanged through every blur preset.
- A red/blue depth discontinuity rejects foreground-colour leakage on the far side (tolerance 2/255, measured four half-resolution pixels beyond the boundary).
- An equal-depth black/white edge has a broader Gaussian transition in Strong than Light, and Light than Off.
- Bloom framebuffer hashes are identical across Off, Light and Strong for each input pattern.
- No GL errors in these synthetic tests.

Exact values and setting results: `hd2d-lens-blur/report.json`.

## Existing functionality spot checks

- Prior-save compatibility, settings persistence, automatic-resolution floor and offline cached title/Continue: `hd2d-lens-blur/final-check-report.json`.
- Phone Tank Setup: background Reroll remains hidden, Apply/Cancel/Undo fit in one row, Apply succeeds. `hd2d-lens-blur/tank-regression.txt`.
- Earlier full sex/growth/Tank Setup suites remain available in `sex-and-tank-setup/`; the complete earlier suite was not rerun for this shader-only correction.

## Scope and limitations

Visual review confirms the backdrop is blurred while central furnishings and UI remain legible, without the earlier broad colour halos. Light remains visibly more restrained than Strong. Synthetic framebuffer checks supplement, rather than replace, visual inspection.

This is not testing on a physical phone, Safari, battery/thermal behaviour or hardware frame rates. Camera movement, extreme manual zoom, and artistic preferences still warrant checking on the target device. No game rules or creature-care behaviour were changed in this correction.

## Reproduce

Serve `source/terrarium/dist/terrarium` with an HTTP server, then run from an environment with Node, Playwright and Chromium:

```
GAME_URL=http://127.0.0.1:8000 node source/terrarium/tests/hd2d-lens-blur.test.js
TEST_OUTPUT=validation/hd2d-lens-blur node source/terrarium/tests/final-check.js
node source/terrarium/tests/sex-phone-footer.test.js
```
