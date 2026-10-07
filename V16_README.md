# v16 — Critters stay outside decor
Bug: critters (especially big adults and big prey) could look like they walked *inside* rocks, walls, trunks and stems.
Causes:
1. Floor movement only keeps the critter's centre point outside a decor's footprint; head, abdomen and legs could overlap the decor.
2. The drawing-side push-out (Draw.unclip) only sampled the body's centre line and, next to a rock, often tried to push the body out *through the floor* (the shortest way out of a block from a point just above the ground) - so it stayed inside the wall.
3. Wedged spots (the V between a trunk and its root, two pieces touching) made the push-out bounce back and forth.
4. Smooth rocks are drawn with a raised dome top that the solid model did not include (critters sank into the top).
5. Critters dropping/landing could land inside a tree trunk footprint.
Fixes: size-aware push-out (head, middle, abdomen, both flanks, scaled to body length - tiny slings to adults and 14-unit prey), sideways slide round walls/trunks/caps, escape search for wedged spots, domed tops in the solid model, landing never inside trunks/stems/logs, per-critter caching + per-part bounding boxes (cheaper than v15).
Tests: tests/decor_clearance.js (every placeable decor and plant × 6 body sizes × floor/climb/path poses, plus a live run of every theme). `--quick` for a faster pass.
