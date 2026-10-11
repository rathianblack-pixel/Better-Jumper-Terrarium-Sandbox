# Terrarium v30 — mobile performance pass (Android Chrome + iOS Safari)

Same look and same simulation; less waiting and fewer hitches on phones.

## Faster loading / fewer freezes
- **Navigation graph builds ~2.8× faster** (`engine/04`): bounding-box pre-checks before polygon tests, solids gathered once per
  build, cheap distance pre-filter for jump edges. Output verified identical (node/edge hash) for all 11 Jumper and 13 Mantis
  habitats. Worst habitat (Cloud Forest) 740 → ~215 ms on desktop; phones see the same ratio. Runs at load and on every decor edit.
- **No redundant second rebuild on load** (`engine/05 _resnapMounts`): wall mounts only trigger a rebuild if they actually moved.
- **Shaders compile side by side** (`engine/21 prog/finishProg`): all programs are compiled + linked first, checked afterwards
  (`KHR_parallel_shader_compile` enabled when present).

## Smoother frames
- **No GPU stalls for the page-edge colour** (`engine/21`): on WebGL2 the bottom-edge pixel is read into a GPU buffer and picked up
  once a fence signals (was a synchronous `readPixels` on the first frame and every 10 s). WebGL1 keeps the old path. Test switch `ptSyncEdge`.
- **Title snapshot** (`packs/terrarium/switch.js`): the 2-minute background snapshot encodes its JPEG with `toBlob` (off the main
  thread). Leaving to the menu still encodes immediately.
- **Effects layer** (`engine/22`): the 2D overlay isn't cleared when it stayed empty (oldbark / prairie and close-ups). Test switch `ptOvClear`.

## Device-aware defaults (`JT.Device`, `engine/22`)
- Android reports RAM/cores: **mid** (< 8 GB) starts Auto at 1.75×, **low** (≤ 2 GB or ≤ 4 cores) at 1.5× (close-up 1.4×), instead of
  starting at 2× and stepping down after a few slow seconds. Auto can still step back up. iOS (no hints) unchanged: adaptive as before.
- **Glass blur off where it hurts**: on mid/low Android, or on any device while Auto has stepped down twice / is holding a steady
  30 fps, the HUD bars use solid tinted glass instead of a live `backdrop-filter` (re-blurring the moving scene every frame is
  one of the most expensive things a phone browser does). Quality = Low behaves as before (no blur).

## Battery / network
- Audio context is suspended while the app is in the background, resumed on return.
- Service worker: if a game page doesn't arrive within 2.5 s (weak mobile signal), the cached copy opens; the download continues
  and refreshes the cache.

## Checks
Legacy Jumper suite outputs identical to v29; `tests/mantis_core.js` 65/65; `tests/behave.js` no errors; `tests/combined.js`
no errors; smoke test both games × 3 art styles × Android/iPhone user agents: no errors, edge colour and snapshots working.
