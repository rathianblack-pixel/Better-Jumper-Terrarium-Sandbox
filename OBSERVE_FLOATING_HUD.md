# Floating Observe controls

The Observe caption and Photo / Ambient / Exit controls now sit directly over the scene, without a panel background, border, box shadow or backdrop blur.

- Warm-white lettering and icons have a restrained light glow with a dark contrast shadow for bright and dark scenery.
- Jumper name, species, growth stage and activity line remain in the existing layout.
- Invisible button targets remain at least 48 × 48 CSS pixels.
- Hover/press feedback and a visible keyboard-focus outline remain available without adding a permanent button box.
- Idle controls retain 75% opacity rather than becoming difficult to see without the old panel.
- Empty space in the overlay no longer intercepts scene gestures; the controls themselves remain interactive.
- The catch-replay offer now reads only “Watch in slow motion” and uses the same box-free glow/shadow treatment. Its click action, expiry and replay behaviour are preserved; Enter/Space can also activate it.
- The standard toolbar, other panels, Photo and Ambient behaviour are unchanged.

This release also retains the HD-2D lens blur correction, jumper sex/growth update and direct Tank Setup access. No save format or gameplay-rule change is introduced by this update.

## Run

Extract the entire ZIP, run `python -m http.server 8000` from the extracted folder, then open http://localhost:8000/. Reload after an older service worker updates, or use a different localhost port if an older installed build persists.

## Latest prompt validation

`validation/replay-floating-prompt/report.json` covers the shortened, transparent prompt in desktop, phone portrait and landscape day/night views, including placement above the Observe caption and click/keyboard activation of an actual recorded replay. The screenshot fixture holds the offer longer to accommodate software rendering; the production offer still expires after 3.2 seconds.

## Validation

See `validation/observe-floating-hud/report.json` and its screenshots. Tests cover desktop, phone portrait and phone landscape, day/night, both art styles, transparent computed styles, visible 48px targets, keyboard focus, Photo, Ambient, Observe Exit and the unaffected normal toolbar.

Environment: local headless Chromium / Linux / SwiftShader; not physical-phone or Safari testing.
