# Natural habitat edges — reworked release

## Play / deploy

The ready-to-run game is `index.html` with `jumper.html`, the icons, manifest and service worker next to it. No build is needed to play. For normal save and offline behaviour, serve this folder over HTTP/HTTPS (for local testing: `python -m http.server 8000`, then open `http://localhost:8000`). Deploy the top-level release files together, not the editable source folder. Existing browser saves remain tied to the original host/origin; use the game's save export/import when moving hosts.

## Changes

- An outward-only, asymmetric, softly rounded soil shoulder replaces the visible rectangular slab outline. The whole original usable floor remains inside it, including all four corners.
- A separate persistent `shorelineSeed` is saved per tank. Older tanks derive it deterministically from their existing ID. Different IDs get different outlines; reloads, terrain rerolls and background switches do not reroll the silhouette.
- The shoulder tapers into an uneven raised ground apron. Its lower foot merges with the existing scenery instead of ending in a straight exposed slab bottom.
- The old rectangular vertical slab walls are no longer drawn when the new shoreline is active.
- The edge blends using the current background's terrain palette: snow/frost, sand, rock, woodland or other ground. Sparse accents bridge selected sections, not a uniform decorative ring. Existing interior substrate and decor are not recoloured.
- Observer framing is slightly wider to accommodate the shoulders on phone screens. Follow mode and camera controls are retained.
- Static, cached geometry; no new runtime libraries, downloaded assets, animation loops or particle systems.

## Deliberate gameplay boundary

This is the approved cosmetic approach, not irregular navigation. Movement, collision, legal placement, tank capacity and existing layouts still use the original floor. The added shoulder/apron is scenery and is not extra usable space. Terrain/background rerolls keep the shoreline seed. An ID-based seed is additive to the existing save format, not a save reset.

## Editable source

From `source/terrarium`, run `node build.js` to regenerate `dist/terrarium`. Copy the generated release files into the deployment folder when publishing.

Key changes:

- `engine/28c-natural-shoreline.js`: seeded profile, textured shoulder, buried bank and sparse edge accents.
- `engine/05-habitat-model-decor-placement.js`: additive seed initialization/migration.
- `engine/21-storybook-renderer-part-2.js`: shoulder top, cache identity and suppression of buried slab walls.
- `engine/28b-miniature-worlds.js`: bank integration through the existing 16-bit mesh pipeline and observer margin.
- `engine/order.json`: module registration before scenery construction.
- `tests/natural-shoreline.test.js`: reproducible shape, geometry and render checks. Browser tests require Playwright and Chromium; gameplay itself does not.

See `QA_REPORT.md` and `validation/natural-edges/` for this release's checks. Other validation files and historical test captures shipped in the original project are prior-release evidence, not claims about new checks.
