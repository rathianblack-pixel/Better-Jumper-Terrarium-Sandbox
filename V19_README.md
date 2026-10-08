# v19 — Weather that fades

Built on v18 (validated). All earlier features and fixes are kept.

## Weather fades
- **Rain and storms build up and taper off.** Rain thickens over about 8 s (storms about 6 s) and thins out over about 10 s when it ends. Rain → storm blends between the two.
- **Heat shimmer, wind dust, mist and fireflies** fade the same way.
- **Visual only.** Jumpers still react to the weather at the same moment as before.
- **Snaps instead of fading** on tank switch and on first load. Photo mode still freezes it. Reduced motion gives a short (1.5 s) fade.

## Extras
- **A) Overcast light.** During rain the light dims and cools slightly; storms are darker. A soft veil over the scene follows the same fade, so the backdrop darkens too.
- **B) Rain sound** (Ambience volume): a soft rain hiss plus light patter, rising and falling with the rain. Storms add a low rumble and the odd distant thunder.
- **C) Wet ground.** The floor darkens and gets a little glossy as it soaks in (~7 s) and dries slowly (~90 s) after the rain.

## Tests
- All suites pass: terrain 37, coinfree 28, tanks 28, personality 9, species 17, hunting 26, hybrids 20, biomes 785, decor_clearance, sim, scenarios. Smoke tests (b1, TV, unlock) show no errors.
- Browser check: rain fade-in/out timing, storm, tank-switch snap, light dimming, veil, rain and rumble volumes, wetness soak/dry.
- tests/groundcover.js and tests/growth_away.js still fail, as they have since v14 (not related).
