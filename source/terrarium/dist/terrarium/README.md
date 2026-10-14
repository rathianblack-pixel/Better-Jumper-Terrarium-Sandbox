# Terrarium — Living Tanks edition

## Play
Unzip the whole folder and open **index.html** in a current browser. Keep the files together; do not run from inside the ZIP preview. For reliable mobile and offline installation, host the folder over HTTPS. Desktop local hosting:

```sh
python -m http.server 8000
```

Open http://localhost:8000. WebGL is required; HD-2D uses WebGL2. Older WebGL1 devices fall back to Storybook.

## Living Tanks update
Create tanks from the top left of **Jumpers**. Choose an enclosure, an unlocked species (a new jumper is spawned), and its recommended biome. Use **Switch Tank** or **Previous Tank** to move between your 30-tank shelf. Inactive tanks run no continuous AI. When you revisit or check the tank shelf, their needs and ongoing activities catch up using bounded elapsed time.

Smarter sensory attention, remembered locations, failed-hunt adaptation, post-molt hunger/recovery, ambient prey routines and a clearer compact care card are included. See **CHANGELOG_LIVING_TANKS.md** for the complete changes and **QA_REPORT.md** for measured checks and limitations.

## Decor safety and gentle foliage
The solid tops of cork blocks, rocks, stacks, ledges and other bulky decor now match their walkable surfaces. Rounded logs have a matching crown strip, and cactus crowns match their physical top. Clear visual arches and hide entrances remain; this update does not add new interior navigation to hollow artwork.

New molt retreats require room for the **next growth stage**, including edge and overhead clearance. Invalid saved supports are moved onto a usable exterior surface or clear floor; occupied silk follows the jumper without resetting molt progress. In a very crowded tank, provide a clear floor patch or roomy solid perch if a jumper cannot find a safe weaving site.

**Menu → Settings → Foliage sway** controls subtle leaf, stem and flower motion:
- **Auto** (default): off on Low or Battery saver; limited to four moving plants on Medium or six on higher quality. Sustained slow rendering pauses sway temporarily.
- **On**: at most two moving plants on Low, otherwise six.
- **Off**: disables ambient foliage motion.

Motion is cosmetic and uses existing GPU mesh buffers. It does not rebuild navigation each frame; rocks, pots and rigid trunks stay still. Sway only animates in the viewed tank and is reduced on plants supporting a jumper. Animated plants still require extra rendering work, so no universal zero-cost, phone-FPS or battery guarantee is made.

## Quick Tank Setup
Tap the jumper name at the top left → **Tank Setup**, or use **Jumpers → Tank Setup** beside Switch Tank.

- **Biome only** keeps your furnishings and changes the biome/climate and ground/backdrop.
- **Biome + recommended layout** generates a furnished arrangement for that biome.
- **Preset layout** previews a generated preset while keeping the current biome/climate. Saved custom presets are fixed arrangements, so they do not reroll.

The habitat is framed beside or above a compact tray. Preview pauses simulation; **Reroll** tries another arrangement without changing your live tank. Confirm furnishing replacement, then **Apply setup**, or **Cancel** / Escape to discard the preview. No new tank or jumper is created. Animal identities, growth, care values, progress and clocks are retained; invalid perches and interrupted movements are safely adjusted when furnishings change.

**Undo last setup** restores the last applied setup without rewinding animal progress. It is saved per tank and remains available after reload, unless later furnishing/ground/enclosure edits change the setup. Apply and Undo are locked while a jumper is molting, occupying a molt retreat or recovering; Cancel resumes time so recovery can finish.

## Retained interface and rendering
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

First loading an older save creates a one-time **jumperTerrarium.v14.save.before-living** backup before adding local clocks. Biological values and animal identities are retained. Export before updating for a portable backup.

Starting a new game keeps a single local backup at **jumperTerrarium.v14.save.before-new**. Each later new game replaces that backup. For dependable recovery, use the existing Export/Import controls before replacing a world.

## Source and rebuild
Editable engine and UI source are included in **source/terrarium**. With Node 18+:

```sh
cd source/terrarium
node build.js
```

Copy **dist/terrarium** to your hosting folder. Runtime assets are local; no CDN or package download is needed to play. Browser regression tests require Playwright and Chromium; see **source/terrarium/tests/README.md**. See **QA_REPORT.md** for tested scenarios and limitations.

## HD-2D critters, calmer attention, and background care
- Fixed an HD-only shadow helper that referenced out-of-scope body length/height variables, aborting grounded critter drawing before their bodies were painted. The intended HD-2D pixel sprites, depth occlusion and bloom remain intact. Texture cleanup and CPU fallback uploads explicitly use the correct GPU textures.
- Springtails and isopods are ignored by incidental glances, peripheral inspection, lunges and vibration cues. Real prey still attract attention, but a short focus hold and vibration cooldown prevent constant direction switching. A starving jumper can still deliberately hunt a springtail in front of it.
- Only the viewed tank runs full locomotion/hunting AI. Revisit or open the tank shelf to reconcile other tanks in one bounded pass; no per-second inactive simulation.
- Hunger, hydration, age, local time, mist droplets and old remains progress. Meals already being held finish normally; premolt, weaving, molt and skin hardening advance through their existing state transitions. Fractional feeding progress is saved.
- No invented offscreen hunts, cannibalism or deaths. Unowned live food stays available; the simplified away model does not replay animal movement or every weather event.
- A game day lasts 480 seconds. Absence uses elapsed game time while playing, and elapsed real seconds after closing/hiding the app. Catch-up is capped at **3 game days (24 minutes)** per reconciliation. Away-only fullness/hydration floors are **12% / 25%** (already-lower values are not magically refilled). These are gentle care reminders, not an unattended death penalty.
- Closing/reopening or hiding/resuming applies offline time once. Legacy saves without timestamps start this policy at their first load, without retroactive punishment. The holding cup is not a simulated habitat. Photo, replay and Tank Setup remain intentionally paused.
- Rehosting: replace the whole release folder, including `sw.js`; its cache version changed. If an installed copy still shows the old behavior, close it and reopen after the update, or refresh the site. Back up an exported save before deployment.
