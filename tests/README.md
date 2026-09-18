# Onboarding regression checks

No dependencies or build step are required.

- Run `node --test tests/progression.test.mjs` for runtime progression, exam access, and Lesson 1 objective regressions. These use the real curriculum, physics and lesson runtime with a minimal DOM boundary.
- Serve the repository over HTTP and open `/tests/browser.html`, then select **Run checks**. This exercises the real app in disposable iframes with isolated in-memory storage; it does not change your saved progress.
- The browser checks cover entry-state freezing, keyboard focus, track resume and completion, legacy/malformed/unavailable storage, failure/retry/review, steering conventions, touch input cancellation and tutorial progression. Touch capability and pointer capture are simulated in their targeted fixture; visually verify on a touch device too.
- Visually check the welcome, coach and menu at desktop, phone portrait and phone landscape sizes. Verify that prompts, ring distance, trim gauge and controls remain reachable. Reduced-motion styling disables interface animations and transitions.

Only the local vendored assets are needed. When iterating, ensure the browser reloads both the HTML and its ES modules; a preview server with `Cache-Control: no-store` avoids mixed versions.
