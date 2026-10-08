# Better Jumper Terrarium Sandbox — v22

Built on v21. Everything else is kept; this is one focused change.

## Observe mode: no more see-through circle
- **Removed the oval window completely.** Plants, trunks and decor in front of the watched jumper no longer fade away in a soft circle. They stay fully solid, so there is no ring.
- **The jumper shows through instead.** Any part of the jumper hidden behind something is drawn through it at **65%** (up from 50%). The parts in the open look normal, so a jumper half inside the grass looks half hidden.
- **Only the watched jumper and its prey.** The prey shows through objects only while the watched jumper is hunting it (target = prey: stalk, creep, crouch). Other jumpers and prey are drawn normally.
- The camera still swings round to find the clearest view, as before.

### Code removed
- `FollowCam.updateFade` and its per-frame call (fade map, oval centre/axis/size easing).
- The decor fade/hole uniforms and the "faded decor wash" re-draw pass (depth pre-pass, ghost ink and colour passes) in the WebGL renderer.
- `holeK()` and all `uHole*` uniforms from the mesh and ink-line shaders.

### Checked
- Browser test (Chromium, WebGL): jumper pinned inside tall grass in Observe mode. The grass stays solid with no ring, and the jumper shows through the blades. No console errors.
- `tests/camera.js` runs clean.
