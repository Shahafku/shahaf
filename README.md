# ⛵ Sail Trainer 3D

A 3D yacht-sailing simulator that teaches you **how wind really works** — apparent
wind, sail trim, the no-go zone, tacking and gybing — through a guided, hands-on
curriculum on open water.

![Made with Three.js](https://img.shields.io/badge/three.js-r160-049EF4) ![No build step](https://img.shields.io/badge/build-none-success)

![Sail Trainer 3D — close-hauled on port tack during the tacking lesson](docs/screenshot.png)

## Play

Any static file server works (ES modules can't load from `file://`):

```bash
# from the repo root — pick one:
python3 -m http.server 8000
npx serve .
```

Then open <http://localhost:8000>. No build step, no external network — Three.js
is vendored in `vendor/`.

## Getting started

On your first visit, choose **I’m new to sailing** for Learn or **I know the basics**
for Exam. Each track has a short introduction before **Set sail**. The simulator
and its controls stay paused during these entry screens.

- **Learn:** seven sequential lessons with coaching. Lesson 1 begins with a paused
  controls introduction, then guides you through filling the sail, holding your
  course for 15 continuous seconds, and reaching the ring. Guidance can be hidden
  and reopened without skipping the objectives.
- **Exam:** six sequential, goal-only tests with pass/fail results. Test 1 is open
  immediately; passing a test unlocks the next. Lessons are not required for exam
  access. Failed tests can be retried or followed by a review of the relevant lesson.
- **Free Sail:** open water with live wind controls, gusts and shifts, plus an AI
  yacht for practicing COLREGs Rule 12 right-of-way.

Use **Learn** or **Exam** in the simulator menu to switch tracks. Switching starts
that track’s next unfinished available exercise and discards the current attempt.
Completed exercises remain available for replay. Completed tracks offer replay
choices, the other track, and Free Sail.

Your selected track and completed exercises are saved in this browser. Returning
visitors resume the next unfinished available exercise; partial attempts are not
saved. **Replay introduction** reopens the welcome flow without clearing progress.
If browser storage is unavailable, progress remains available for the current
session only. Existing saved progress is preserved when the new welcome appears.

## What you'll learn

| Lesson | Skill |
|---|---|
| 1 · Hold a Course | Fill the sail, hold a steady course for 15 seconds, reach the ring |
| 2 · The No-Go Zone | Why you can't sail straight upwind; getting out of irons; close-hauled |
| 3 · Tacking | Turning the bow through the wind with speed; beating upwind; COLREGs Rule 12 |
| 4 · The Gybe | Broad reaching, running, controlled gybes, "by the lee" danger |
| 5 · Man Overboard I | Return from downwind and stop beside the casualty in light, steady wind |
| 6 · Man Overboard II | Repeat the recovery in a working breeze |
| 7 · Man Overboard III | Recover in strong, gusty, shifting wind with exam-style failure conditions |

The Exam track tests **Hold a Course**, **Tack**, **Gybe**, **Man Overboard**,
**Beat to Windward**, and a timed **Triangle Course**, in that order.

## Controls

| Key | Action |
|---|---|
| `←`/`→` | Move the helm left / right |
| `↑`/`↓` | Sheet in / ease out |
| `T` | Auto-trim assist (starts off in Lesson 1) |
| `E` | Helm: wheel (turn toward the desired direction) · tiller (move opposite) |
| `C` | Camera: chase · helm · tactical top-down · stern |
| `P` | Points-of-sail diagram |
| `1`–`7` | Select an available lesson |
| `8` | Free Sail |
| `Shift` + `1`–`6` | Select an available exam test |
| `M` | Sound |
| `H` | Help |
| drag / wheel | Orbit / zoom (chase camera) |

On touch devices, hold the helm or sail buttons to steer and trim. Sail-in is
**−**, and ease-out is **+**. Narrow screens put track choices and tools in the
**☰ menu**. Lesson 1 instructions adapt to the input device and selected helm mode.

## Verification

Run the dependency-free runtime regression checks with Node.js:

```bash
node --test tests/progression.test.mjs
```

With the repository served over HTTP, open [`tests/browser.html`](tests/browser.html)
and choose **Run checks**. The browser checks exercise the real app in isolated
frames with in-memory storage, so they do not change your saved progress.

See [`tests/README.md`](tests/README.md) for coverage and manual layout checks.
Touch input is simulated in the browser checks; also verify on a physical touch
device when changing mobile interactions. Use [`force-compass.html`](force-compass.html)
to inspect the force model independently.

## The physics (short version)

Everything the HUD shows is computed from a real (simplified) sailing model,
documented in [`docs/RESEARCH.md`](docs/RESEARCH.md). For an interactive visualization
of how lift, drag, and drive vectors compose to steer a yacht, open [`force-compass.html`](force-compass.html) — drag the wind direction around a boat and watch the forces resolve in real time, with a performance polar showing boat speed at every true wind angle.

- **Apparent wind** = true wind − boat velocity, recomputed every frame; sails
  respond to *apparent*, not true wind.
- The sail is an **airfoil**: an angle-of-attack curve gives luffing below ~5°,
  peak lift near 20°, stall beyond ~35°, parachute-drag mode toward 90°.
- Sail force splits into **drive** (`F·sin(boom)`) and **side force**
  (`F·cos(boom)`) — which is why close-hauled boats heel hard and running boats
  stand upright, and why the **no-go zone** emerges naturally from the math.
- Rudder authority scales with water flow: no speed, no steering — and reversed
  steering when drifting backwards in irons.
- Weather helm, leeway, windage, gusts and wind shifts are all in there.

## Project layout

```
index.html            UI shell + HUD DOM
force-compass.html    interactive physics visualization (drag wind, see forces)
styles.css            HUD styling
src/main.js           renderer, cameras, input, audio, game loop
src/onboarding.js     welcome, track selection, resume and completion screens
src/storage.js        browser storage with session-memory fallback
src/physics.js        wind + yacht dynamics (the model)
src/boat.js           procedural yacht, wind-shaped cloth sails, wake
src/ocean.js          water/sky shaders, buoys, life rings, wind streaks
src/hud.js            wind rose, trim gauge, instruments, coach tips
src/lessons.js        lesson/test runtime (LessonManager)
src/curriculum.js     curriculum data — LEARN lessons + EXAM tests
src/mob.js            man-overboard scenario
src/mob-drill.js      man-overboard demo steps + precomputed route
src/mob-demo.js       man-overboard demo player (captions + voiceover)
src/voiceover.js      browser speech-synthesis narration
src/traffic.js        AI traffic yacht (COLREGs Rule 12 right-of-way)
docs/RESEARCH.md      nautical rules & physics research behind the model
tests/                runtime and browser regression checks
vendor/               three.js (vendored, offline-friendly)
```
