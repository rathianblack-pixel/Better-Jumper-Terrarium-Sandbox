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
