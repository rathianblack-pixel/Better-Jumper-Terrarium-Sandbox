# Better Jumper Terrarium Sandbox — v21

Built on v20 (soft oval see-through window). Everything from v20 is kept; changes are incremental.

## 1. See-through window: no hard edges
- The window's depth cut-off is now a soft fade instead of a hard cut, so plant/trunk edges near the jumper no longer show a sharp outline.
- The ghost (faded) pass first writes depth, then draws a faded ink outline, then colour, so there is no seam and no halo behind the jumper.

## 2. Critter movement (jumpers and prey)
**Ground cover is walked over or on**
- Every ground cover was checked:
  - **Bulgy → walked over:** moss, cushion moss, sphagnum, glow moss, lichen, clover, pebbles, gravel, mudflat, seed pods, acorns, pinecones, twigs.
  - **Flat → walked on normally:** leaf litter (all kinds), wet litter, magnolia leaves, bark chips, coconut chips.
- A smoothed height map of the cover lifts bodies, silk and taps onto the cover so legs no longer sink into moss or pebbles. The lift fades out once the critter is ~6 units above the floor.
- Low hard decor (flat stone, water dish) already has climb paths, so critters climb onto it as before. Nothing new was needed there.

**No more walking through trunks, stems, logs and rocks**
- A floor route can no longer go in through a footprint and out the other side (it used to slip through climb bases and drop landings).
- Climbs now start from the **visible foot** of the trunk (the spot where the climbing body is drawn), not from the trunk's centre line. Moving between that spot and the climb is instant, and the body is drawn in the same place, so nothing is seen walking into the trunk.
- Climb bases buried inside another piece (for example a plant tucked under a big tree's roots) are skipped.
- Prey hops never cross a trunk or rock.
- **If there's no clear way to a destination**, the destination is rejected and the critter picks another one (it no longer falls back to the nearest node and cuts through).

**Measured (28 themes × 40 s, 8 jumpers + 10 prey each):**
| | v20 | v21 |
|---|---|---|
| Floor samples inside decor | 0.98 % | 0.26 % (what's left is mostly critters resting snug against back walls) |
| Visible body "teleports" | ~17 / min | ~0.4 / min |

## Tests
- New: `tests/critter_paths.js` (`--quick` available). Checks every ground cover's relief, floor graph edges, real routes, approach points and live jump/clip rates.
- `tests/species.js`: the giant power-leap check now uses 12 tanks (≥3 leaps) instead of 6 (≥2). Routes changed, so the old 6-tank sample was too small to be reliable.
- All the other suites pass as before. `groundcover.js` and `growth_away.js` were already failing before v21 (since v14) and are unchanged.

## Not tested
- Real phones/tablets (only tested in headless Chromium with software GL).
- Long-term balance effects of the new routes on hunting and feeding (the short test runs look normal).
- Performance on very large custom tanks with lots of ground cover (the cover map takes ~7 ms to rebuild, and only after a decor change).
