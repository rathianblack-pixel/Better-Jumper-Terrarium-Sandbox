# Terrarium — v27: new title screen

One title screen for both games, built on the real tank and matched to your art style.

## Flow
- **Title**: your own tank (or a built-in tank render) fills the screen behind a large "Terrarium" logo.
  - **Continue** goes straight back into the tank you played last (shows game, tank name and day).
  - **Choose terrarium** opens the chooser. With no saves, there is one **Start** button.
- **Chooser**: one big card per game, each with a picture of its tank, a "Last played" badge, chips (tanks · living · day), **Continue** and **New** (tap twice to confirm).
  Hovering or focusing a card swaps the background to that tank.
- **Into the game**: the card picture zooms to full screen. The game page opens on the same picture and fades into the live tank.
  No second "Jumper/Mantis Terrarium" splash, no extra Start button, no black flash. Screens never overlap: the old one leaves before the new one arrives.

## Matching the art style (top-right switch, also changes the in-game style)
- **HD-2D**: gilt JRPG menu windows, gold gradient logo with a passing shine, ◆ cursor on the focused button, warm light shafts, square pixel motes.
- **Cuphead**: 1930s title card with a turning sunburst, a bouncing rubber-hose logo with ink outline and red drop shadow, red banner tagline, cream card-stock buttons with hard shadows, animated film grain and scratches.
- **Storybook**: italic ink logo on a soft paper glow, watercolour paper panels with hand-drawn edges, soft pollen motes.

## Polish
- Cards tilt toward the mouse, with a glass highlight that follows it. Buttons react on hover and press.
- Mouse parallax on the background. Slow camera drift (Ken Burns) on the background and on each card.
- Optional sound: a soft generated pad with gentle chimes, plus UI ticks. Off until you turn it on; your choice is remembered.
- Keyboard: Enter / Esc / ← →. Phones get a swipeable card carousel.

## Performance (why it's lag-free)
- The menus no longer run a second live game (the old in-game splash built and simulated a throwaway showcase tank). Instead, the game saves a small JPEG of your tank (≈30–60 KB, `terrarium.shot.<game>` in localStorage) 7 s after you enter, every 2 minutes, and when you leave through the menu.
- All motion is GPU-only CSS (transform / opacity). Nothing repaints per frame, except the short logo shine.
- Low-end devices (≤4 GB RAM, ≤4 cores, Data Saver) get fewer layers, no parallax and no tilt. Reduced-motion turns all animation off.
- Checked at 6× CPU throttle on a phone viewport: title ready in ~0.4 s, steady 60 fps on title and chooser.
- Games also open faster, because their splash showcase is skipped. The next game page is prefetched while you're on the title.

## Files
- `packs/terrarium/launcher.html`: the new title screen.
- `packs/terrarium/early.html`: injected right after `<body>` in the combined game pages (loading veil, splash hidden). New `combine.early` option in `build.js`.
- `packs/terrarium/switch.js`: removes the in-game splash, fades the veil out, saves the tank pictures.
- `packs/terrarium/static/icons/hero-<game>-<art>.webp`: six built-in tank renders (356 KB total), added to the offline cache.
- `tests/combined.js`: updated for the new title screen.

# v27.1 — Mantis: bigger arms, real reach, long prey held across

**Arms**: the raptorial forelegs are about 25% longer (coxa 0.18, femur 0.225, tibia 0.135 of body length; was 0.15 / 0.18 / 0.11) and about 30% thicker, including bands, spines and arm lobes. Species differences are kept (giant Asian 1.3×, devil's flower 1.2×, stick 0.88×). `JT.MANTIS_ARM` holds the proportions; the drawing and the AI both use it.

**Reach = arm reach**
- `AI.mArmReach(sp)`: from where the mantis stands to the shoulder (measured on the drawing; longer for long-necked species), plus the arm at full stretch. Hunting range = that + a small lean (10% of body length). The old fixed +2.2 that let small nymphs reach too far is gone.
- The strike is only a lean now: the body moves at most ~0.12–0.18 body lengths (was a lunge of up to 0.6). Out of range → it creeps closer instead.
- The forelegs aim at the prey itself (2-bone reach, knee up), so the hooks close where the prey is: within ~3% of body length at full reach, and high or low targets too.
- The catch is judged from the arm reach (`AI.catchR` hook in the engine; Jumper is unaffected). Catch rate in `tests/strike_probe.js`: 83% (was 82%). The median strike distance is now 0.74 body lengths (was 0.49, which the old lunge made up for).

**Long prey held from the side**: crickets, locusts, moths, roaches/dubia, beetles, mealworms, caterpillars and mantis tank-mates are held across the arms, like a cob under the jaws, with the body running out to one side (left or right per prey). Long insects are eaten head first, then back along the body. Parts on the eaten end disappear with it; legs, wings and the rest still drop off as before. Small prey (flies, gnats, aphids) is unchanged.

Tests: `mantis_core` 65/65, `behave.js` no errors, `strike_probe` above, `combined.js` passes.

## v27.2 — better shadows

- **Shape-true decor shadows** (WebGL): each plant/rock/log's real triangles are flattened onto the floor along the sun/moon direction into one cached, floor-sized soft mask. Leaf gaps show through as dappled light, and higher leaves cast softer, lighter shadows. The mask is rebuilt only when the light moves about 1.5° or the decor/ground changes (GPU only, a few draws plus 5 small blur passes; 512 px, or 256 px on Low quality). It replaces the old oval decals, which are still used as a fallback.
- **Contact shadows**: a thin soft rim where rocks, logs and trunks meet the soil, and a small dab where each stem goes in. These replace the large discs under plants.
- **Critter shadows**: shaped like the body (abdomen + head, thin leg lines, mantis raptorial arms, and held prey) and cast along the light. On a thin stem or leaf edge, the critter only gets a faint contact at its feet, and its shadow drops to the ground or rock below, softer and fainter the higher it is. Jumping or airborne critters use the same drop shadow, and it fades out instead of spilling past the glass.
- **Per art style**: Storybook uses soft watercolour edges (noise-broken, with a slight pigment rim). HD-2D uses 2 dithered pixel levels. Cuphead uses flat, hard-edged plum-brown shapes.
- Test switch: settings `ptNoSm` turns the shadow map off (old decals).
