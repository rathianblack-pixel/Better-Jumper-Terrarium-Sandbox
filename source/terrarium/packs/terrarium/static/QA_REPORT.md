# Validation — Frameless & Field Notebook edition

## Automated browser checks: PASS
Headless Chromium with WebGL2 using SwiftShader software graphics, not physical-device measurements.

- Desktop: 1280×720, DPR 1.
- Phone: 390×844, DPR 3, touch/mobile emulation.
- Phone landscape: 844×390, DPR 1, touch/mobile emulation.
- **24 quality/style/profile combinations**: HD-2D and Storybook × High/Medium/Low/Auto × three profiles. Verified actual backing buffer multipliers of 2.0×, 1.5× and 1.0×; forced maximum Auto backoff remains 1.0×. Fine HD-2D scene buffers match the chosen backing resolution. Fixed presets remain unchanged even with the former backoff level set to maximum.
- Live title preview advances its disposable simulation and does not create/change the player's save.
- Start reveals New/Continue; Continue disabled without progress; saved progress restores through Continue.
- Retained enclosure/jumper/habitat onboarding completes using actual controls.
- New Game confirmation, cancellation and previous-save backup verified.
- Build, Care, Menu, Settings, species/collection, journal, selected-jumper card, Observe and photo mode exercised.
- Photo mode pauses simulation time.
- Zero JavaScript/console errors in the profile regression run.

## Final-build supplementary checks: PASS
- Preview has no onboarding state and never saves.
- Prior-format saved habitat and named jumper restored.
- Old Classic texture defaults migrate to Fine once; later explicit texture choices persist across reload.
- Saturated Auto backoff (level 99) still produces a 1.0× backing buffer and a matching Fine HD-2D scene.
- Service-worker-cached title screen and Continue boot offline.

Reports are included in `source/terrarium/tests/release-results`.

## Visual review
Title, Start choices and new-game confirmation reviewed at desktop, phone and landscape sizes. The final gameplay HUD and notebook states were rendered and inspected at those sizes, including Build/Care/Menu/Settings/quality controls, selected-jumper card, jumper list, collection, journal, Observe and photo mode. Fixed low-contrast inherited biome styles, leftover small caps, mobile menu row sizing, landscape build labels, background-selector labels and photo-control contrast. Final modal checks found no horizontal overflow.

## Limits
No physical Samsung/iPhone hardware, Safari/WebKit run, thermal measurement, battery-life measurement or long-duration hardware soak test. High now intentionally uses four times the pixel count of Low; it can be substantially more demanding. Auto retains a readability floor rather than pursuing an arbitrarily low resolution, so very slow hardware may still run below the target frame rate at its floor. Classic/Chunky texture modes remain optional deliberate pixel-art sampling; Fine is the clear default.

Updating at the same host/origin keeps existing saves. Export progress before moving host, browser or device. The New Game backup is a single local backup and is not a substitute for exporting a save.
