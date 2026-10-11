# Terrarium v32 — lifelike movement + cleaner shadows

New shared module `source/terrarium/engine/18b-procedural-gait.js` (visual only; AI, saves and timings are unchanged).
Used by the jumper drawer (`engine/19-…`) and the mantis drawer (`packs/mantis/mantis-draw.js`).

## Movement
- **Planted feet.** Each foot keeps its world position while the body moves over it (no more sliding / "ice skating").
  A foot lifts once it strays too far from its rest spot and swings in an arc to a spot a little ahead (lead by speed).
  Neighbouring legs never lift together (jumper: alternating tetrapod, ≥4 feet down; mantis: diagonal pairs, ≥2 down).
  Feet that run out of room drag instead of floating. Standing still, feet tidy themselves up with small settle steps.
- **Turning on the spot** = a ripple of steps instead of the whole spider rotating like a stamp.
- **Two-bone leg IK.** Leg segment lengths stay constant; the old knee placement is kept as the bend direction.
- **Staged turning.** Jumpers hold their heading, then pivot in quick snaps (saccades); mantises turn slowly.
  The head keeps pointing where the AI wants, so the head leads and the body follows.
- **Springs.** Body dips a little each time a foot lands; landing from a jump squashes the body and splays the legs.
  Abdomen trails round turns (jumper and mantis) and twitches while a jumper stalks.
- **Hunting details.** Jumper hind legs gather in under the body before a jump. Mantis forelegs are "cocked"
  (lifted, tibiae eased open, faint quiver) while stalking / peering.
- **Small life.** Occasional front-leg tap when idle; mantis abdomen breathing pump; mantis antennae lag in turns and
  flick while alert.
- LOD: the rig only runs for live critters drawn on screen (not thumbnails, shed skins, cards or prey pseudo-spiders).
  `window.JT_NO_GAIT = true` switches back to the old gait (for comparisons).

## Shadows
- Leg shadows come from the real leg joints (projected along the light), not a fixed template, so they match the steps.
- A shadow is painted as one union shape and composited once: overlapping body/leg pieces no longer stack into dark
  blotches. Storybook gets a cheap soft penumbra (low-res scratch, smoothed up), HD-2D keeps pixel levels, Cuphead
  stays flat and crisp.
- Lower, steadier opacity (body ≈0.3 by day, lighter at night; legs lighter and softer than the body; feet contact
  dots fade when a foot lifts). A high-standing body casts a lighter, softer shadow.
- Airborne critters always get the ground shadow (no more vanishing shadow just after take-off / before landing).

## Verified
- `tests/gait_film.js` (new): close-up film, old vs new, walking / turning / arc / stalk / idle. Planted-foot slip 0,
  never more than 4 (jumper) / 2 (mantis) feet up, no errors.
- `tests/gait_probe.js` (new): in-game follow-cam run, both games: no errors, no NaNs.
- mantis_core 65/65, lineup (both games) no errors, shadows checked in all 3 art styles.
- Not measured on a real phone; the cost is a few vector ops per leg per frame, and up to 4 small shadow composites per critter.

# v32.1 — fix: lag + bouncing in place
- **Bouncing:** the body/abdomen springs took one big step per frame. At low frame rates (or when a critter sprite is only
  repainted every other frame) that step went unstable and the body bounced up and down on the spot (measured: up to
  6 body-lengths of up/down travel per 4 s at 8–15 fps). Springs are now sub-stepped (≤ 1/120 s): travel ≈ 0 at any frame
  rate. The leg splay is tied to real landings only, so it can no longer feed the bounce.
- **Lag:** v32 painted every shadow through a scratch canvas. Critter sprites are painted on a CPU-side sheet, so each
  shadow forced a GPU read-back on phones. Shadows are now a single path (ellipses + leg capsules, same winding, one
  fill) drawn straight into the sprite: same soft/union look, no scratch canvas, no read-back.
- Critter draw cost is back to within ~10 % of v31 (`tests/gait_bench.js`).
