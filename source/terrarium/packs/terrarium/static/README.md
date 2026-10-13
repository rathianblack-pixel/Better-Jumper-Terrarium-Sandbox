# Jumper Terrarium — reworked edition

## Start playing
Unzip the whole folder, then open **index.html** in a current browser. Do not run it inside the ZIP preview. Keep index.html, jumper.html and the icons folder together. On phones, hosting this folder over HTTPS gives the most reliable experience and enables installation/offline play. File-manager previews on iOS may block JavaScript: use a real browser with the game hosted, rather than a preview window.

WebGL is required. HD-2D uses WebGL2; older WebGL1 browsers fall back to the Storybook renderer.

For local desktop hosting (Python required):
```
python -m http.server 8000
```
Then visit http://localhost:8000. HTTPS or localhost is needed for service workers. The files also run directly from disk in desktop browsers that allow local JavaScript, without install/offline features.

## What changed
- Only jumping-spider gameplay, habitats, assets, menus and source remain.
- A three-page, jumper-only Storybook opening replaces the old video intro. First entry plays it; the title screen can replay it. Next/Skip work at any time. Reduced-motion users turn the pages manually.
- Two gameplay art styles: HD-2D and Storybook. Change them in Settings.
- The original jumper simulation, species, habitat building, feeding, water, progression, journal, saves, photo mode and replays are retained.

## Longer sessions / older devices
All quality settings, **including High**, use bounded render buffers. High retains its quality/detail selection; it no longer means huge supersampled frames. The game scales its backing image to fill the screen, while interface text/buttons stay native-resolution. HD-2D preserves crisp pixel styling; Storybook uses a lighter, smoothly scaled image.

- **Auto frame rate**: steady 30 fps. **Smooth**: up to 60 fps on desktop, 30 on phones/touch devices. Battery saver stays at 30.
- Device-class pixel budgets: about 380,000 on weaker Android devices, 600,000 on other phones, 900,000 on modest desktops, 1,200,000 on stronger desktops. These are ceilings, not minimums. Device/browser reports may be incomplete.
- Sustained slow frames or high measured CPU render cost trigger lower resolution at every quality level. Backoff holds for the session instead of repeatedly sharpening/blurring. Reloading resets the session backoff.
- Disabled expensive multisample antialiasing and requested the low-power GPU path. Fewer bloom passes retain HD-2D lighting with less work. Style changes explicitly free old GPU textures and unused effect buffers. Existing GPU critter rendering and static-scene caching remain enabled.
- Graphics-context recovery rebuilds GPU resources after the browser reclaims them.
- Hidden tabs pause game-loop work and audio; returning resets timing so there is no large catch-up burst.
- No live menu showcase, periodic screenshot encoding, background intro video decoder, or invisible wake-lock video. Keep Screen Awake uses the native browser API only; unsupported browsers may dim normally.

### Suggested starting settings
Samsung A12: High + Auto frame rate; HD-2D Classic/Chunky pixels and Light/Off lens blur. If a very crowded tank still stutters, try Medium or Simple surface detail.
iPhone 12 Pro: High + Auto frame rate. Avoid maximum screen brightness during long sessions.
Older laptop: Auto or High + Auto frame rate; use a browser with hardware acceleration. Software-only graphics can remain slow even with adaptive resolution.

A web game cannot read your device temperature or promise no heat/throttling. The safeguards use workload/timing, not temperature sensors. Actual sustained performance must be checked on your physical devices.

## Saves
The existing **jumperTerrarium.v14.save** and **jumperTerrarium.settings** storage keys are unchanged. Use the same browser and host/origin to retain progress. Moving to a new host, changing port, or switching browsers may mean a different save store. Export your existing jumper save before moving, and import it from Settings. An unsupported saved art style falls back to Storybook without changing progress. Never delete browser site data to update if you want to keep local progress.

For an already installed copy, use the same hosting folder and reload/close and reopen the app. This edition uses a new offline cache and removes superseded app shell caches. Installation/offline play requires HTTPS or localhost and a first successful online load.

## Source and rebuild
Editable game source is in **source/terrarium**. Node 18+:
```
cd source/terrarium
node build.js
```
Output: `dist/terrarium`. Copy its contents to your hosting folder. All runtime assets are local; no CDN/package download is required to play. Automated browser tests require Playwright, supplied separately, and are not needed to play.

See **QA_REPORT.md** for tested scenarios and limitations.
