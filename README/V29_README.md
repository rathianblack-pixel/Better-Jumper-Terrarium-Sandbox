# Terrarium v29 — animated start screen

## What's new
- **Intro film** (15 s, with music) plays once per visit when the title screen opens, then crossfades into a
  **seamless 10 s menu loop**. One version per art style (HD-2D, Cuphead, Storybook), each in portrait and landscape.
  - Story: a dew drop falls → dawn breaks inside the dome → close-up of the jumping spider's eyes → slow-motion leap →
    the mantis rises against the sun → crane out to the glowing terrarium and the title.
- Video replaces the CSS light rays / motes / sunburst / grain on the title screen, which is much lighter on
  low- and mid-range phones (video decoding is done by the hardware).
- **Skip ›** button (or Esc / Enter / Space) skips the intro. Tapping anywhere else turns sound on.
- Sound: if sound was on last time, the intro tries to play with music; browsers that block that start it muted
  and show "Tap for sound". The generated ambient pad stays silent until the intro ends.
- Rotating the device swaps to the other framing at the same moment; switching art style swaps the loop.
- The chooser screen keeps the per-game pictures (video pauses there).
- Falls back to the still hero picture with reduced motion, data saver, no MP4 support, or slow/offline loading.
- Fixed: `requestIdleCallback` was called with a number instead of options (threw in Chrome), so page prefetch never ran.
- Version READMEs moved into this `README/` folder.

## Files
- `intro/intro-<style>-<portrait|landscape>.mp4` (H.264 + AAC) and `intro/loop-<style>-<orientation>.mp4` (silent).
- Videos are not pre-cached by the service worker (size). Offline, the title screen uses the still picture.
- Source: `source/terrarium/intro-film/` — everything is drawn and composed in JavaScript (canvas 2D for video,
  WebAudio OfflineAudioContext for the music). `build-videos.sh` re-renders all 12 files into
  `packs/terrarium/static/intro/` (needs Node, Playwright + Chromium, ffmpeg), then run `node build.js terrarium`.
