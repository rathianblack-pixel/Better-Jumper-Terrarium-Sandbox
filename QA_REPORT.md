# Follow-up verification: HD critters, calmer attention, background care

This section describes the current build. The older QA notes below are historical; their full-freeze behavior has been replaced.

## Confirmed root cause and repairs
The HD shadow helper used `L` outside the scope where body length was defined (and confused helper canvas height with animal height). Grounded animal painting threw before painting its body, and the renderer's fallback swallowed the exception. The helper now derives height softness from its existing normalized `soft` argument. HD pixel-art sprites, bloom, focus and depth occlusion are preserved. Background texture retirement deletes the actual `far`/`mid`/`t` textures once; CPU fallback uploads explicitly bind the sprite atlas after GPU atlas initialization and before each upload.

## Verified
- Targeted regression: **28 behavior/painter checks, 28 art/quality/pixel/GPU-CPU combinations**, zero collected runtime/graphics errors.
- Direct painters for a grounded jumper plus springtail, isopod, aphid, fruitfly, gnat and cricket produce opaque body pixels in both art styles. A synthetic sprite contributes visible output pixels in both full pipelines.
- Final-engine behavior-only run: **28 checks**, including partially completed emergence and restored molt-site-search intent.
- Existing full UI regression: desktop, phone portrait and landscape; **24 quality/style cases**, zero collected errors.
- Updated Living Tanks compatibility suite: **5 groups passed**, including creation/cancel/capacity, lazy inactive state and catch-up, camera/selection, sensory/memory fixtures, care UI and migration. Old exact-clock equality was updated to allow genuine elapsed offline milliseconds.
- Offline/save suite passed: migration of defaults, preserved animal identity, saved graphics preferences, service-worker offline title and Continue.
- AI edge suite passed: hidden-prey aiming, strike timing, post-molt hardening, five-species simulation soak.
- Manually inspected controlled real-animal desktop and 390px-phone images in HD-2D and Storybook, plus launcher capture. Critters are visible and the intended style differences remain.

## Background model and limits
Only the viewed habitat receives continuous full AI. Other habitats are reconciled when visited or checked in the tank list. Reload and hidden-tab resume use elapsed wall seconds once; old saves without timestamps start the new policy without retroactive debt.

Catch-up uses at most 14 lifecycle boundaries per spider, not one tick per elapsed frame/second. It advances hunger, hydration, age, local clock, existing meals, retreat weaving, premolt, molt, hardening and emergence. Existing owned food is consumed once with normal meal counters; fractional feeding duration/nutrition survives saves. Old droplets, remains and silk age without particle/weather replays. It does not fabricate hunts, cannibalism, prey deaths or exact offscreen paths.

Each reconciliation is capped at three 480-second game days (24 minutes). Away-only fullness/hydration floors are 12%/25%; already-lower values are not refilled. These safeguards make absence a care reminder, not an unseen death penalty. Photo/replay/setup pauses and the holding cup are not autonomous background habitats.

Springtails/isopods do not generate incidental glances, peripheral inspections, restless lunges or vibration queue noise. Short focus holds and vibration cooldowns reduce switching among real cues. Deliberate starving springtail hunting remains possible.

Tests used headless Chromium/SwiftShader, not physical mobile hardware. They do not guarantee phone FPS/battery use, every possible furnished arrangement, or exact real-world biology. Existing navigation and retreat-safety rules remain authoritative. Compact JSON reports and selected screenshots are in `source/terrarium/tests/fix-results`; rerun scripts to regenerate complete screenshot sets.

---

# Living Tanks QA report

## Tank Setup preview checks
The dedicated `tank-setup.js` suite checks desktop 1280×720, phone 390×844 and landscape 844×390:
- Actual jumper-name shortcut, Jumpers shortcut, mode selectors, confirmation checkbox, Reroll, Cancel and Escape controls.
- Live serialized state, live data and ID counter unchanged while a visible preview is open; renderer ownership restored after rendering; 20 repeated rerolls preserve live state and RNG/game globals.
- Apply matches the preview arrangement and retains tank count, animal/prey IDs, fullness, hydration, growth/care statistics and simulation time.
- Undo restores furnishings without rewinding changed fullness, hydration or time; the saved Undo can be used after restoration and is invalidated by subsequent furnishing edits.
- Biome-only preserves furnishing identities and placement; preset preview keeps biome/humidity; saved custom presets are fixed and do not reroll.
- Molt/recovery and occupied-molt-retreat guards; inactive tank remains unchanged.
- Controlled adult fixtures resume for 30 simulated seconds after each of the three modes; positions stay finite, supports remain valid and jumper count stays unchanged. Legacy tank-settings and Menu shortcuts open the preview.
- Tray stays inside each viewport with 8px scroller separation; the enclosure floor is framed outside the tray in both Storybook and HD-2D.

Evidence: `source/terrarium/tests/living-results/tank-setup/report.json` and representative preview screenshots. Headless Chromium with SwiftShader; no physical-device performance claim. Apply deliberately invalidates obsolete movement/sight plans, and furnishing replacement can remove silk/droplets or empty nests tied to removed supports. Undo restores the setup, not those transient traces. One Undo is kept per tank; it is not a full edit-history system.

## Shared sheet spacing hotfix
- Moved Jumpers action controls/subtabs and creation-wizard actions outside the scrolling content, into fixed sibling panels. Scrolling cards cannot paint through or behind those controls.
- Added fixed 10px breathing room around the scroll area, opaque surfaces, padded collection cards, and consistent heading/paragraph/button spacing.
- Audited Jumpers, Collection, Journal, tanks, tank settings, profile, Settings, Menu, Help and all wizard steps at desktop, screenshot-like, phone portrait and phone landscape sizes: **192 sheet/scroll geometry checks**.
- Audited Decor, Plants, Walls, Ground and Care drawers: **45 additional scrolling checks**.
- Re-ran the 27 button-contrast cases and tank-management feature regressions.

Evidence: `source/terrarium/tests/living-results/modal-spacing/`. These are representative screens and layouts, not a guarantee for every possible imported text length or browser.

## Wizard button contrast hotfix
The generic modal `.gold` rule had overridden the wizard primary text to the same olive as its background (measured contrast: **1:1**). Scoped wizard-action styles now preserve white primary labels and dark secondary labels. **27 checks passed**: all three steps × desktop/phone/landscape × normal/hover/keyboard focus. Lowest measured action-button contrast is **5.48:1**, above the 4.5:1 normal-text threshold. Labels fit inside the buttons, and creation/cancel/back behavior passed the existing feature regressions again. Gameplay and save schemas are unchanged by this hotfix.

Evidence: `source/terrarium/tests/living-results/wizard-contrast/wizard-contrast-report.json`. Reproduce with `wizard-contrast.js`.

## Automated checks
Test environment: headless Chromium / Playwright on Linux, using SwiftShader software rendering. Browser tests do not establish physical-phone heat, battery or frame-rate guarantees.

| Area | Checks |
| --- | --- |
| Creation | Actual buttons on desktop 1280×720, phone 390×844, landscape 844×390; action row on all Jumpers subtabs; cancel; back/continue; only unlocked species; recommended biome; one new jumper; active destination; no forced detail card |
| Capacity | 30-tank ceiling, disabled create control, direct creation guard, modal opened before shelf filled, creation re-enabled after deletion |
| Freeze | Full inactive `h.data` unchanged during 120 active updates (60 simulated seconds); local time, age, light and saved entities unchanged; switching performs no catch-up |
| Thirty-tank shelf | Instrumented 20 ticks: active update called 20 times; inactive update called zero times |
| Switching | Per-tank camera/selection, Previous Tank, saved lighting mode after active deletion, Favorites, individual-name search and Paused indicator |
| Care | Compact care block; post-molt recovery separated from actionable hunger; molt status contributes no urgency score |
| Sensory behavior | Peripheral cue first inspects; directional vibration does not assign a prey target or visual sighting; no transmission from air/disconnected supports |
| Learning / memory | Failed-prey cooldown respected even when starving; persistent visual/failed-launch memories; discovered-water preference invalidated when a droplet disappears |
| Prey routines | Calm landed fly enters grooming with animation; alarm interrupts the routine |
| Molting | Fullness reduced to 28–30%; hardening protected; a minimum-readiness fixture ends 120-second recovery at ~20.1% fullness rather than being driven into near-starvation |
| Hidden prey / patience | Crouching aims at remembered position, not hidden live position; cannot strike a hidden prey; risky moving/alert prey produces a wait; settled prey permits a strike |
| Simulation soak | Five species (bold, regal, canopy, zebra, graywall), 90 simulated seconds each with decor, water and prey: finite positions and bounded memories |
| Save compatibility | Legacy v4 identity/fullness preserved; local clock initialized from pause stamp; memories and local clock restored; existing settings migration and later user preferences retained |
| Rendering / old interface | Existing desktop/mobile/landscape suite; HD-2D and Storybook × High/Medium/Low/Auto: 24 rendering cases; original HUD, drawers, menus, Observe/photo pause, New/Continue/backup flows |
| Offline | Cached title screen and Continue boot offline; restored saved jumper identity |

Structured evidence: `source/terrarium/tests/living-results/*.json`. Feature/layout screenshots are included as samples. The scripts are included for reproduction; use a local HTTP server.

## Decor safety and foliage validation
- **216 / 216 definitions** built with finite mesh data and rendered individually through the real decor-thumbnail pipeline. All six contact sheets were visually inspected.
- **1,728 catalog variants**: two seeds × two rotations × two base elevations for each definition; **9,948 supported hard-cap samples** checked against the rendered triangles. No failed samples. Supports blocked by higher solid layers are excluded, not treated as usable cap surfaces.
- The full-mesh audit has no missing sampled top surfaces or invalid meshes. Its remaining raised-surface entries on walls/planters describe decorative moss, foliage or ornamental mushroom caps over the support, not a hard-cap mismatch.
- Deterministic fixtures cover blocked-floor centroid escape, occupied-molt silk alignment without resetting state progress, next-stage retreat size, edge rejection, overhead rejection, refusal to weave on an unsafe face and immediate legacy retreat repair under a blocked low overhang without advancing care or growth counters.
- Foliage tests cover changing wind uniforms, rigid decor exclusion, cached mesh/navigation reuse, Auto-off on Low, slow-render rest and explicit Off. Both Storybook and HD-2D render the feature with no reported WebGL errors.
- A small controlled Off/On diagnostic is included, using software SwiftShader and two moving plants at Low resolution. It is not a representative device benchmark and does **not** establish zero cost, mobile FPS, battery life or temperature.

Evidence: `source/terrarium/tests/living-results/decor-safety/` contains per-definition audit records, the variant and behavior reports, the software-renderer diagnostic and six catalog contact sheets. `decor-audit.js`, `decor-variants.js`, `decor-safety.test.js` and `foliage-performance.js` reproduce these checks.

### Scope limits
The audit samples surfaces and selected geometry variants; it is not an exhaustive proof for every seed, every stacked furnishing arrangement or every animation pose. Dense imported layouts may still need manual clearing. Real visual openings remain, but hollow artwork does not gain new interior pathfinding. Existing biological progress is preserved rather than restarted when legacy occupied silk is moved to corrected support. Sway is deliberately subtle and cosmetic; physics and jumper paths remain static, and shadows use the existing approximate renderer.

## Original-versus-upgraded AI fixture
A deliberately missed, fixed-launch pounce is repeated until the hunter disengages:

| Measure | Original | Upgraded |
| --- | ---: | ---: |
| Total forced missed attempts | 3 | 2 |
| Immediate retries after the first miss | 2 | 1 |
| Remembered failure x-position | 35 (landing) | 30 (launch) |

This is **50% fewer immediate retries in this controlled failure fixture**, not a general intelligence score or a catch-rate comparison. A universal “2× smarter” claim is not verified. Reproduce with `ai-comparison.js` and an unchanged original release served as `baseline.html`.

## Limits and intentional simplifications
- Only the active tank simulates or renders. Inactive saved data/geometry still takes memory, and saving/browsing the shelf is not free.
- In-session switches preserve simulation state. Browser reload retains the existing safe-restore approach for transient routes and midair movement; the game does not resume every animation at an identical sub-frame after reload.
- Vibration uses shared substrate/decor or nearby silk connections and coarse direction. It is not a full material-wave propagation model or an exact hidden-prey sensor.
- Foliage nibbling is cosmetic; it does not reduce plant biomass.
- The five-species soak and deterministic policy fixtures are limited regressions, not multi-hour ecology balance tests or exhaustive tests of every species, furnishing combination or mobile device.
- No unrequested species, currencies, photography rewards, laser tool or expanded milestone journal were added.
