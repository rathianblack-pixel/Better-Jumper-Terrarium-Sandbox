# v18 — "New Jumper unlocked" reveal

Built on v17 (validated). All v17 features and fixes are kept.

## New
- **Unlock reveal**: when a jumper unlocks, a full-screen card appears. It shows a dark silhouette first, then the colour sweeps in. The glow and light rays are tinted per species. Hybrids show a "?" and the heading "A hybrid has appeared", and they hold the silhouette a bit longer.
- **Buttons**: "Add to a tank" opens Jumpers → Collection, scrolls to that species and highlights it. "Later" closes the card, and so does tapping anywhere once the reveal finishes. A tap during the reveal can't skip it. Keys: Enter = add, Esc/Space = close.
- **Queue**: several unlocks show one after another. They wait while Replay, Photo mode, TV mode, the splash screen or biome setup is active.
- **"All grown up" banner**: a light banner that doesn't block play when a jumper reaches Adult. It hides itself after about 4 s. If an unlock card is showing or queued, a toast is shown instead.
- **Reduced motion**: shorter hold, no sweeping animation.

## Tests
- All suites pass: terrain 37, coinfree 28, tanks 28, personality 9, species 17, hunting 26, hybrids 20, biomes 785, decor_clearance, sim, scenarios. Smoke tests (b1, TV) show no errors.
- Tested in the browser on mobile 412×860 and desktop 1280×800: silhouette, reveal, hybrid "?", queueing, tap-to-close, Add to a tank + highlight, holding during TV mode, Esc, adult banner and reduced motion.
- tests/groundcover.js and tests/growth_away.js still fail, as they have since v14 (not related).
