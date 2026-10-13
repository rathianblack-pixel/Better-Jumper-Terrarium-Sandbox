# Browser regression tests

Requires Node, Playwright and Chromium. The game itself does not require these tools.

Host the built release and run:

```sh
GAME_URL=http://localhost:8000 CHROMIUM=/path/to/chromium node regression.js
```

`TEST_OUTPUT` optionally selects the output folder. Defaults to `tests/results`.
Tests cover desktop 1280×720, phone 390×844 at DPR 3, and phone landscape 844×390; HD-2D and Storybook with all four quality settings; live unsaved title preview; Start/New/Continue; confirmation/cancellation and local backup; onboarding, notebook screens, contextual jumper details, Observe and photo pause. Screenshots and a JSON report are written to the output folder.

Included `release-results` are from headless Chromium with SwiftShader software rendering. They are not measurements of physical phone performance. The old pixel-budget/intro-story tests were replaced because those behaviors were intentionally removed.

Additional final-build save/defaults/offline checks: `GAME_URL=http://localhost:8000 CHROMIUM=/path/to/chromium node final-check.js`.
