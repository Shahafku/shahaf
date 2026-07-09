# CLAUDE.md

Guidance for working in this repository.

## Git Authorship Policy

All commits and pull requests must be authored solely under Shahaf's name.
**Never** add `Co-Authored-By` trailers for Claude (or any AI assistant), and
never attribute authorship to Claude in commit messages, PR titles, or PR
bodies.

## What this is

**Sail Trainer 3D** — a browser-based 3D yacht-sailing simulator that teaches
how wind really works (apparent wind, sail trim, the no-go zone, tacking,
gybing) through a guided curriculum. It also models the **Israeli practical
sailing exam** (המבחן המעשי): a LEARN track (coached lessons) and an EXAM track
(the same exercises, goal-only, pass/fail).

Rendering is [Three.js](https://threejs.org/) (r160), **vendored** in
`vendor/three.module.min.js` — no CDN, works fully offline.

## Running it — no build step

There is no bundler, transpiler, or package manager. The app is plain ES
modules loaded directly by the browser. ES modules can't load over `file://`,
so serve the repo root over HTTP:

```bash
python3 -m http.server 8000   # then open http://localhost:8000
# or: npx serve .
```

`package.json`, `package-lock.json`, and `node_modules/` are **gitignored** —
do not add a build toolchain or npm dependency without discussing it first.
New runtime dependencies should be vendored under `vendor/` to keep the app
offline-friendly, matching how Three.js is handled.

### Importing Three.js

Import from the vendored file via a **relative path**, e.g. from a file in
`src/`:

```js
import * as THREE from '../vendor/three.module.min.js';
```

## Deployment

`.github/workflows/pages.yml` deploys to GitHub Pages on every push to `main`
(the entire repo root is uploaded as the Pages artifact). **Deploy happens from
`main` only** — feature branches don't publish. There is no staging step, so
anything merged to `main` goes live.

## Testing

There is no automated test suite or linter. Verify changes **manually in the
browser**: serve the repo, exercise the affected lesson/control, and confirm
the HUD, physics, and rendering behave. `force-compass.html` is a standalone
page for sanity-checking the force model in isolation.

## Architecture

Entry point: `index.html` defines the HUD DOM and loads `src/main.js` as a
module. `main.js` owns the renderer, cameras, input, audio, and game loop, and
wires the other modules together.

| File | Role |
|---|---|
| `src/main.js` | Renderer, cameras, input, audio, game loop; orchestrates everything |
| `src/physics.js` | Wind + yacht dynamics — **the model**. Exports `Wind`, `Boat`, and shared helpers (`DEG`, `KNOTS`, `SHEET_MAX`, `clamp`, `wrapPi`, `pointOfSail`, `tackName`, `driveCoefAt`) |
| `src/boat.js` | Procedural yacht mesh (`BoatView`), wind-shaped cloth sails, wake |
| `src/ocean.js` | Water/sky shaders, buoys, life rings, wind streaks (`Environment`, `WindStreaks`, `makeBuoy`, `bobBuoy`, `makeLifeRing`, `bobLifeRing`, `waveHeight`) |
| `src/hud.js` | Wind rose, trim gauge, instruments, coach tips (`HUD`) |
| `src/lessons.js` | `LessonManager` — the runtime that drives a lesson/test |
| `src/curriculum.js` | Curriculum **data**: `LESSONS`, `TESTS`, `ALL`, `byId` |
| `src/mob.js` | Man-overboard scenario (`MobController`, `mobPassCondition`) |
| `src/traffic.js` | AI traffic yacht (`TrafficBoat`) for practicing COLREGs Rule 12 right-of-way |
| `styles.css` | HUD styling |
| `index.html` | UI shell + HUD DOM |
| `force-compass.html` | Standalone interactive physics visualization (drag wind, watch forces resolve) |
| `docs/RESEARCH.md` | Nautical rules & physics research behind the model |

Physics helpers and shared constants live in `physics.js` and are imported
everywhere — put new shared math there rather than duplicating it. Keep
curriculum **content** in `curriculum.js` separate from the lesson **runtime**
in `lessons.js`.

## The physics model

The simulation is a real (simplified) sailing model, documented in
[`docs/RESEARCH.md`](docs/RESEARCH.md). Key ideas: apparent wind = true wind −
boat velocity (recomputed per frame); the sail is an airfoil with an
angle-of-attack lift/drag curve; sail force splits into drive and side force,
from which the no-go zone emerges naturally; rudder authority scales with water
flow. Read `docs/RESEARCH.md` before changing anything in `physics.js`.
