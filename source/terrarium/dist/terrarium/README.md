> **Natural-edge rework:** see `NATURAL_EDGES_README.md` for the seeded outlines, embedded banks, preserved gameplay boundaries, and build instructions. Current release evidence is in `validation/natural-edges/`; older reports elsewhere are historical.

# Terrarium — Optimized Miniature Worlds

The original terrarium game, with all **26 existing backgrounds** reworked as explorable surroundings. Background IDs, names, saves, creatures, care, construction, Undo, tank management, and both existing art modes are retained. This is the game and its editable source, not an image showcase.

## Run the game

1. Extract the entire ZIP into one folder.
2. From that folder run `python -m http.server 8000` (Python 3).
3. Open **http://localhost:8000/** in a current WebGL-capable browser, then choose Start / New or Continue.
4. Change environments through **Menu → Settings → Background**. The existing picker is unchanged.

Use HTTP rather than double-clicking the HTML: the launcher's service worker and offline cache need localhost or HTTPS. No npm install, internet connection, external asset download, or build step is needed to play. The service worker caches the release after the first successful visit. If an older copy is already installed at the same address, reload after the new worker activates (or use a different localhost port).

The existing in-game camera help and gestures are unchanged: orbit, zoom, pan, camera presets and inhabitant-follow mode remain available. Normal observer framing now leaves a modest scenery margin. Zooming in deliberately can still crop the habitat; Reset View restores normal framing.

## Performance-focused build

All 26 environments and existing gameplay remain. This build reduces rendering work; it does not promise a hardware-independent frame rate.

- **Low / Medium:** lighter terrain tessellation, lower-poly distant props and fern detail, and flat contact mottling instead of tiny solid meshes. Scene landmarks and all background IDs remain. **High retains the previous scenery geometry.**
- **Off-screen clusters:** conservative projected mesh bounds skip invisible draw calls. Panning, orbiting or zooming out immediately restores visible clusters; there is no distance cutoff.
- **Static caching:** imperceptible observer-camera drift snaps to its target, allowing the existing colour/depth cache to be reused. Moving creatures remain live. Fades settle using wall-clock time and then release the cache.
- **Uploads:** small meshes use a direct typed-array upload instead of a triangle-by-triangle remapping pass. Large meshes remain split into WebGL 1-safe Uint16 batches.
- **Auto:** starts at 1.0× on lower-tier devices, 1.25× on mid-tier and 1.5× on higher-tier devices. It can still adapt up to 2.0× after sustained headroom, or down to the existing 1.0× floor. Explicit Low / Medium / High resolution multipliers remain 1.0× / 1.5× / 2.0×.
- **Frame rate:** Auto and Smooth target 60 FPS on desktop and phones; actual delivery depends on hardware and scene load. Battery saver correctly caps rendering at 30 FPS. Settings descriptions now match this behavior.
- **HD-2D Low:** uses the shorter bloom path, also on higher-tier devices.

For the lightest 60-FPS-target configuration, choose **Menu → Settings → Render quality: Low → Frame rate: Smooth → Foliage sway: Off**. In HD-2D, set **Lens blur: Off**. Storybook avoids HD-2D post-processing and is another option. Enable **Show fps** to check your own device. Keep GPU critter painting enabled where supported. Auto is the balanced default; it does not force an older saved High setting down to Low.

The ZIP includes the ready-to-run game, editable source and test scripts. Historical screenshot collections and duplicate generated builds are omitted to keep the download small; rebuild with the existing Node script if needed.

## Editable source and rebuild

- `source/terrarium/engine/28b-miniature-worlds.js`: scene recipes, seeded terrain/props, panoramic distance wash, temporary cluster fading, observer margin.
- `source/terrarium/engine/02-static-content-definitions-no.js`: original names, IDs and background picker definitions.
- `source/terrarium/engine/20-*` / `21-*`: original mesh/material/WebGL pipeline.
- `source/terrarium/engine/22-*`: original orthographic camera and controls.
- `source/terrarium/engine/order.json`: build order; `28b` replaces the older mossy-only patch.
- `source/terrarium/packs/`: original HTML/CSS shell, launcher, icons and static assets.

Rebuild with Node.js (no packages required):

```sh
cd source/terrarium
node build.js
```

The complete runnable output is `source/terrarium/dist/terrarium/`. Serve that folder to test a rebuild. The ZIP's top-level `index.html`, `jumper.html`, icons, manifest and `sw.js` are already built from this source. Do not edit only the generated HTML; change the source and rebuild instead.

## What changed in each background

| Existing background | Rework |
| --- | --- |
| Mossy River Glade | Substantial new woodland clearing; a continuous stream bends behind the habitat and continues down its side. Explicit modelled banks, broken reflections, moss stones, fern colonies, litter, fallen timber, rooted groves and lower middle-distance crowns replace the painted trunk wall. |
| Lily Pond Wetland | A round, recessed lily pool with a shared curved shoreline, pads and blossoms; reed colonies, shore stones and leafy groves surround the clearing. |
| Forest Waterfall Basin | Offset rock cascade and plunge pool; a modelled waterfall, fern banks and asymmetric basin boulders form the signature composition. |
| Mangrove Shore | Continuous undulating tidal shore with exposed rooted mangrove clusters, reeds and silty ground. |
| Sunken Grotto Pool | Cool submerged-pool colours, a recessed pool, kelp-like foliage and irregular rock outcrops. |
| Rainforest Canopy | Broad tropical leaves, layered rooted trees, trailing vines and a lower grove beneath the taller canopy. |
| Ancient Tree Hollow | A broken, open-centred trunk landmark with an intentional opening, fungus colonies and decaying timber on warm woodland ground. |
| Fallen Log Glade | Several differently oriented fallen trunks, moss, fungi and stony leaf-mould clearings; no upright tree fence. |
| Golden Autumn Forest | Ochre ground, scattered leaf patches and warm, varied tree crowns with open gaps. |
| Primeval Deep Jungle | Stronger terrain relief, denser broadleaf colonies, taller vine-bearing trees and rooted middle-distance groves. |
| Whispering Bamboo Grove | Separate irregular culm clusters with visible nodes and leaf sprays; grassy clearings and small stones break up the grove. |
| Sunlit Wildflower Meadow | Rolling meadow terrain and mixed cream, lavender and gold flower patches; deliberately open rather than forested. |
| Golden Sunset Grove | Warm earth and grass tufts beneath asymmetrically grouped amber-toned groves. |
| Misty Mountain Highland | Cooler, stronger upland relief, heather-like flowering tufts and weathered rock groups; distant colour softens without a fog wall. |
| Cloud Peak Summit | The strongest rocky relief, sparse low grasses and high stone outcrops, with cool distant mountain silhouettes. |
| Japanese Zen Stone Garden | Restrained gravel clearing with curved rake marks, sparse feature stones and an offset stepping-stone path. |
| Cherry Blossom Valley | Pink blossom crowns, scattered petals, muted valley ground and lower flowering groves. |
| Overgrown Ancient Temple | Broken column/beam groups, a fragmentary stone path, fern colonies and moss-compatible weathered stone. |
| Desert Oasis & Dunes | Smooth dune relief, a separate oasis pool, succulent rosettes and scattered warm rocks. |
| Red Rock Canyon | Red earth, taller clustered sandstone-like outcrops and sparse dry rosettes. |
| Volcanic Springs | Ash-coloured terrain, mineral clusters, dark rock groups and a pale thermal pool. |
| Twilight Woodland | Muted mauve ground, fungi, fallen wood and purple-toned layered woodland. |
| Moonlit Deep Forest | Cool blue-grey terrain, ferns, mossy timber, stone groups and pale groves. |
| Enchanted Firefly Glade | Green woodland, fungi, logs and a bounded set of small emissive firefly glints (not a particle simulation). |
| Bioluminescent Grotto | Cool pool, angular crystal clusters, rocky mineral groups and emissive-compatible surfaces. |
| Alpine Winter Forest | Snow-coloured relief, sparse ground tufts, frosted rocks and layered snow-capped conifers rather than recoloured broadleaf trees. |

## Rendering and camera design

- Surrounding terrain extends well beyond ordinary viewing ranges in every direction; there is no visible narrow apron or one-sided backdrop fence.
- Water banks and land share explicit geometry. Pools use radial shoreline topology; the stream has independently sampled curved banks. Water does not overlap a rectangular terrain cut-out.
- Scene recipes use different landforms, ecological ground cover, landmarks, density, colour and deterministic placement. Reused low-poly primitives receive scale/orientation/grouping variation.
- HD-2D bloom and light shafts now respect remaining highlight headroom, avoiding whiteout on snow and other bright terrain while retaining the original pixel, depth-of-field and grading pipeline.
- Far scenery is a seamless, low-contrast wash. Near/middle depth comes from real 3D meshes and relief; distance grading is baked into the meshes. No heavy fullscreen fog or new real-time effects.
- Only external tall scenery clusters crossing the projected habitat bounds on the camera-facing side fade. Fade state is continuous and exponential, restores after the sightline clears, and suspends static caching only during the transition. Habitat contents never participate in that fading.
- The renderer is orthographic: it has no physical camera moving through a 3D collision volume. Sightline-aware fading is used instead of introducing artificial camera pushes, collision teleports or new orbit restrictions.
- Ground cover is static and cosmetic. Large meshes are split into core 16-bit index batches, including on WebGL 1. Tall groups have bounded draw counts and all GPU buffers belong to the existing habitat-cache disposal path. No new production dependencies or downloaded models/textures.

## Validation and limitations

See `validation/TEST_REPORT.md` and the accompanying machine-readable reports for tests actually completed on this release. Selected current previews are in `validation/`; the tests can regenerate the complete capture set.

Testing uses desktop Chromium with SwiftShader software WebGL, including phone-sized viewports. It is not a physical Android/iPhone GPU, touch-hardware, Safari or battery benchmark. Device frame rates are not promised. The original day/night and follow-camera systems remain in charge of the habitat. Small decorative glints and water reflections are static; there is no new fluid or tree physics. At intentional maximum zoom/pan, users can still inspect away from the habitat; reset restores framing.

Historical screenshot/report collections from earlier versions are not included in this lightweight package. The current test report distinguishes geometry and compatibility checks from real-device performance testing.
