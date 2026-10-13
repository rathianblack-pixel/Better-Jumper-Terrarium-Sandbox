# Editable Terrarium source

Run `node build.js` to generate `dist/terrarium`. The release launcher lives in `packs/terrarium/launcher.html`; shared game HTML/CSS is in `packs/jumper/shell/head.html`. `engine/order.json` gives script order. `engine/22-renderer-camera-rigs-frame.js` defines resolution presets; `engine/21a-hd2d-post.js` handles HD-2D scene sampling; `engine/28-boot-main-loop-fixed.js` handles Auto adaptation and safe preview/New Game boot.

Only generated `dist` and top-level release files should be hosted. See the release README and tests README for play and validation instructions.
