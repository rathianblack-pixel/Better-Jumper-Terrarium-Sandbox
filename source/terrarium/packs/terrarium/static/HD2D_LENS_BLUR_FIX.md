# HD-2D lens blur correction

## Changes

- Replaced the stepped depth-of-field blend with a smooth focus falloff. Strong no longer exaggerates hard focus bands.
- Made the Gaussian lens blur depth-aware and normalised its weights, reducing foreground colour leaking across tank/background silhouettes.
- Normalised the blur radius to CSS pixels rather than internal render pixels, so changing quality or pixel-art scale no longer directly multiplies its footprint.
- Decoupled bloom from lens blur: Off, Light and Strong use the same unblurred bright-pass source.
- Corrected edge colour-fringing to modify the graded image rather than overwrite it with raw channels. Lens Off does not add this fringing.
- Replaced reversed GLSL smoothstep calls in the glass/vignette effects with defined equivalents.

Light remains subtle; Strong retains a clearly blurred backdrop rather than merely being downgraded to Light. The existing focus target, crisp creature overlay, and Off setting are retained.

## Included earlier update

All jumper sex identity, gradual growth differences, one-time choices for existing residents, and direct Tank Setup/background access remain included. See JUMPER_SEX_TANK_SETUP.md.

## Run

Extract the ZIP, run `python -m http.server 8000` from its folder, then visit http://localhost:8000/. If reusing an installed older version at the same address, reload after the new service worker activates, or use a different port.

Choose Menu → Settings → HD-2D → Lens blur: Off / Light / Strong.

## Validation

See validation/HD2D_LENS_BLUR_TEST_REPORT.md and validation/hd2d-lens-blur/. Automated tests use local headless Chromium on Linux with SwiftShader. These are not physical-phone, Safari, thermal, battery or frame-rate tests.
