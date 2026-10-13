# Jumper Terrarium source

- `engine/`: game, simulation, camera, graphics and interface modules. `order.json` sets script order.
- `packs/jumper/shell/`: gameplay HTML/CSS shell.
- `packs/terrarium/`: title screen, Storybook opening, jumper-only navigation and static files.
- `build.js`: rebuilds the app into `dist/terrarium`.
- `tests/`: this release’s browser regression checks.

Run `node build.js` with Node 18+. No runtime dependencies are needed to build or play. Tests use Playwright and a system Chromium executable. The shipping app is the contents of `dist/terrarium`; the source tree is included for editing.
