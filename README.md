# Terrarium — Frameless & Field Notebook edition

## Play
Unzip the whole folder and open **index.html** in a current browser. Keep the files together; do not run from inside the ZIP preview. For reliable mobile and offline installation, host the folder over HTTPS. Desktop local hosting:

```sh
python -m http.server 8000
```

Open http://localhost:8000. WebGL is required; HD-2D uses WebGL2. Older WebGL1 devices fall back to Storybook.

## What's new
- A frameless gameplay HUD: jumper-name control at top left, discreet day/time at top right, and one five-action line-icon toolbar at the bottom.
- Warm ivory notebook drawers and menus, charcoal text, olive selection highlights, normal-case lettering and thin dividers. No blue panels, gold frames, glass effects or heavy UI shadows.
- Jumper details appear only when selected; they no longer open automatically at startup or when switching tanks.
- A dark title screen with a live, muted terrarium behind a softly glowing **Terrarium** title. **Start Game** reveals **Continue** and **New Game**. Continue is disabled without a save. New Game asks for confirmation if a save exists.
- The title preview uses a disposable simulation. It never reads, advances or writes your saved world. No opening story interrupts entry.

## Clearer rendering
Multipliers refer to **CSS viewport pixels**, not the device's reported DPR:

| Setting | Render resolution |
| --- | --- |
| High | 2.0× viewport width and height |
| Medium | 1.5× viewport width and height |
| Low | 1.0× viewport width and height |
| Auto | 2.0×, 1.75×, 1.5×, 1.25× or 1.0× |

At 1280×720, High renders at 2560×1440. Fixed presets do not silently lower resolution under load. Auto backs off under sustained slow frames and can recover after sustained headroom; it never drops below 1.0×. The former device-area caps and hidden secondary scene downscaling are removed.

**Fine** is the new default HD-2D pixel texture and uses the full preset scene resolution. Existing installations migrate to Fine once; later choices persist. **Classic** and **Chunky** remain optional, deliberate coarser pixel-art effects, independent of the render buffer preset. Use Fine for maximum clarity. Lens blur remains separately adjustable.

Higher resolution means more GPU work: High has four times the pixels of Low. Try Medium or Auto if a device struggles. Frame-rate limits, hidden-tab pause, GPU resource cleanup and context recovery remain. No physical-device heat or battery-life guarantees are made.

## Saves and updating
The existing **jumperTerrarium.v14.save** and **jumperTerrarium.settings** keys remain unchanged. Update at the **same origin/browser** to preserve progress. Export a save from Settings before changing host, port, browser or device. Do not clear site data to update.

Starting a new game keeps a single local backup at **jumperTerrarium.v14.save.before-new**. Each later new game replaces that backup. For dependable recovery, use the existing Export/Import controls before replacing a world.

## Source and rebuild
Editable engine and UI source are included in **source/terrarium**. With Node 18+:

```sh
cd source/terrarium
node build.js
```

Copy **dist/terrarium** to your hosting folder. Runtime assets are local; no CDN or package download is needed to play. Browser regression tests require Playwright and Chromium; see **source/terrarium/tests/README.md**. See **QA_REPORT.md** for tested scenarios and limitations.
