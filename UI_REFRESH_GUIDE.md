# Responsive sizing revision (v2)

This revision fixes the overly narrow desktop Build/Care windows from the first UI refresh.

- **Desktop Build/Care:** fluid width from 480–840 CSS pixels instead of the old fixed 364 px. At 1366 px window width the panel is about 546 px; at 1920 px it is 768 px. An **Expand / Compact** control provides a wider workspace up to 1120 px.
- **Desktop dialogs:** Menu, Jumpers, Journal and Settings grow with the window, up to 1280 px. Smaller dialogs remain bounded to readable widths.
- **Phones and tablets:** taller sheets use substantially more available height. Expand makes the sheet nearly full-height while preserving main navigation. The content grid changes with the usable width rather than shrinking labels.
- **Short landscape windows:** near-full-width panels, compact category controls and readable horizontal item rows on very short screens. The meal confirmation keeps the prey name, quantity and Release action accessible without a giant portrait taking over the sheet.
- **Pinned Care actions:** Feed, Mist and Clean remain outside the scrolling content. Food confirmation keeps Release visible while the selection details scroll.
- **Safe areas and changing viewports:** sizes recalculate on browser/visual-viewport resizing, including rotation and a reduced viewport. Insets keep dialogs clear of top/bottom safe areas.

The layout tests cover 24 viewport sizes, from a 320 px-wide phone and 568 × 320 landscape through 3840 × 2160. This is a broad tested range, not a claim that every physical device/browser combination has been tested. The test report is `validation/RESPONSIVE_SIZING_TEST_REPORT.md`.

The layout source is `source/terrarium/engine/27h-fluid-panels.js`; the UI content remains in `27g-field-journal-ui.js`. The same build command applies.

---

# Living Field Journal UI refresh

This release builds on Guided New Game. It changes the interface, not the simulation, species progression, habitat IDs, or save format.

## What's new

- **Navigation:** one cream-and-olive dock with labelled controls, consistent active states, keyboard focus and a Care attention indicator for low fullness or hydration.
- **Build:** a small Recommended shelf, searchable full categories, suitability filters, consistent item cards and role descriptions. Desktop uses a side panel; phones use a bounded sheet. Short landscape screens use a horizontally scrolling category bar so items remain accessible. Existing placement, Rotate, Cancel, Undo, Remove, walls and ground tools remain.
- **Care:** starts with each jumper's hydration/fullness and the live-prey count. Feed, Mist and Clean are clear actions. Food and cleanup crew are separate. Food selection opens a quantity confirmation, defaulting to 2. Unsuitable prey cannot be released from this new confirmation; existing prey capacity is enforced. Misting, cleaning and feeding save immediately.
- **Observe:** name, species/stage and a short behaviour caption; labelled Photo, Ambient and Exit controls. Controls quieten after inactivity and brighten on interaction. Observation notifications are hidden so they do not cover the caption.
- **Jumpers:** My Jumpers, Collection and Journal. Observe and Profile remain prominent. Creating a separate tank is a secondary, clearly described action below the jumper list, not a competing header control.
- **Collection:** unlocked species first, a next-discovery prompt and collapsed locked discoveries.
- **Journal:** unwitnessed behaviours collapse by category; witnessed entries sort by recorded first-seen day within each category, newest first. Life stories are unchanged.
- **Menu:** Your world, Experience, Learn and a collapsed Advanced section. Export, Import and Title screen are directly available. Reset retains its existing confirmation.
- **Settings:** collapsible Background, Graphics, Comfort & help, Save data and installation groups. Whole-game reset is separated into Advanced and still requires confirmation.

## Compatibility and play

Extract the entire ZIP and serve the folder with `python -m http.server 8000`, then open http://localhost:8000/.

No build step or network asset download is required to play. WebGL is required. Use the existing save export before replacing an installed copy. Browser saves are tied to the site's origin (including port). This refresh retains the existing save keys and format; changing the port does not automatically move a save.

Guided First Home keeps its focused tutorial panels until completion. Its explicit placement, addition and feeding steps are not replaced by the normal-play panels.

## Source

`source/terrarium/engine/27g-field-journal-ui.js` is the interface layer, loaded after First Home and before boot through `engine/order.json`.

Rebuild with `cd source/terrarium && node build.js`. The complete generated game is in `dist/terrarium`. Top-level playable files in this ZIP already contain the refresh.

## Validation

See `validation/UI_REFRESH_TEST_REPORT.md`. Automated browser checks use Playwright and Chromium; these are development/test dependencies, not runtime dependencies. Historical QA files elsewhere describe previous releases and should not be interpreted as a fresh run of every simulation or environment test.
