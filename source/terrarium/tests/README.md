# Browser regression checks

Serve the delivered game folder on port 8000. Install Playwright separately for testing (not needed to play). Set CHROMIUM to your Chromium executable path if it differs from /usr/local/bin/chromium. GAME_URL overrides the game URL; TEST_OUTPUT overrides the writable output folder (default: tests/results).

Run `node regression.js` for the 24-case device-profile/quality/style matrix and gameplay checks.
Run `node soak.js` for graphics resource cycling, context recovery and a six-minute sustained High-quality session (three minutes per style). SOAK_SECONDS sets the duration in seconds per style; use a multiple of 15.

The profiles emulate viewport, input and browser/device reports in Chromium. They do not run Android or iOS operating systems or native Safari, and do not measure real device temperature.

Optional TEST_ORIGINAL=1 in regression.js imports a save from the original build if you separately serve its jumper.html at http://localhost:8001. The original build is not included in this jumper-only edition.
