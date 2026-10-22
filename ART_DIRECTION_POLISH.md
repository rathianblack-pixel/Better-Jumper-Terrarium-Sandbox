# Art direction and visual polish

This release refines the existing game, not a separate scene or screenshot demo. All 26 backgrounds and both art modes remain, together with previous jumper, Tank Setup, blur and floating-control changes.

## Visual changes

- **Ground and banks:** seeded broad colour patches, clustered substrate marks, restrained leaf/moss accents, and weathered bank colours. Textures are generated on cache misses, not painted every frame. HD-2D uses a smaller pixel art grid; Storybook uses smoother washes and subtle surface strokes.
- **Plants and props:** more curved/cupped leaves using the same segments, seeded within-prop colour variation, less harsh thin foliage outlines, and less exaggerated translucent leaf highlights.
- **Grounding:** softened existing contact/rim shading and reduced harsh shadow hatching. No scene-wide real-time shadow-map or SSAO pass was introduced.
- **Style identity:** HD-2D keeps deliberate light bands and crisp clustered texture with restrained bloom/rays; Storybook uses softer material variation, warmer washes and coloured outlines.
- **Lighting and scenery:** adjusted night grading and post-process darkening; lower-contrast, less saturated distant scenery is baked into mesh colours. Background-only changes do not invalidate the habitat soil texture.
- **Jumper finishing:** an extra eye reflection arc is gated by projected eye size; small residents do not receive portrait detail. Existing species markings and sex-specific shapes remain.
- **Motion:** a shared, gentle breeze with a maximum of six moving plant groups. Off and reduced-motion suppress movement; Auto suppresses it at Low quality and during rapid camera changes.

## Performance guardrails

The matched Low-quality camera route retained draw-call, triangle and upload counts in both modes. All 26 scenery recipes at Low/Medium/High retained baseline mesh counts and valid core WebGL 1 Uint16 indices. Explicit quality/resolution choices were not raised. The idle static colour/depth cache remains reusable.

Soil textures are capped at 1024 pixels per dimension (512/768/1024 nominal widths for Low/Medium/High). Style, substrate, habitat size and quality participate in the cache key. This is bounded caching, not preloading all combinations.

The short matched route is a diagnostic, not a phone benchmark. Software-rendered timings are noisy; neither a universal speedup nor a stable 60 FPS is claimed. Physical phones, Safari, sustained thermal behavior and long-session memory still need device testing.

## Validation and reproduction

- `validation/art-polish/before/report.json` and `after/report.json`: same saved habitat, viewport, day/night states and observer/follow routes; ten screenshots per phase, no JavaScript or GL errors.
- `validation/art-polish/regression-report.json`: all 78 world builds, baseline geometry budgets, ground texture bounds/cache, both material paths and all explicit qualities, motion policy and idle cache reuse.
- Additional current compatibility results are summarized in `RELEASE_VALIDATION.json`.
- Rebuild: `cd source/terrarium && node build.js`; serve `dist/terrarium` over HTTP. Top-level game files already match that build.
- `tests/art-polish.test.js` uses the current build on port 8000 and the preceding release on port 8001 for matched geometry checks; override `GAME_URL` / `BASELINE_URL` if needed. Playwright and Chromium are needed to run tests, not to play the game.

No gameplay navigation boundaries, save schema, resident identity or care/build actions were intentionally changed. To keep package size down, the ZIP includes current art screenshots and reports, but excludes duplicate generated source builds and historical screenshot collections.
