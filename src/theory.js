// Short, scripted demonstrations drawn from docs/RESEARCH.md §§1–4.
// Headings are relative to a fixed north wind; no exercise physics or scoring runs.
import { DEG, pointOfSail } from './physics.js';

export const THEORY_STAGES = Object.freeze([
  {
    title: 'Where can you sail?',
    focus: 'WATCH THE BOAT’S COURSE',
    lead: 'The wind stays at the top of the circle. Follow the boat marker: which angles make the sail work?',
    transition: 'Turning now: follow the boat around the circle.',
    takeaway: 'Need to go upwind? Zigzag on close-hauled courses instead of aiming straight at the wind.',
    beats: [
      { heading: 0, sheet: 12, speed: 0.2, caption: 'Bow into the wind → the sail flaps and the boat loses drive.' },
      { heading: 45, sheet: 12, speed: 2.2, caption: 'Bow angled off the wind → the sail fills and the boat climbs upwind.' },
      { heading: 90, sheet: 45, speed: 2.6, caption: 'Wind across the side → an easy, powerful beam reach.' },
      { heading: 135, sheet: 75, speed: 2.2, caption: 'Wind behind the side → a broad reach with the sail eased out.' },
      { heading: 175, sheet: 85, speed: 1.8, caption: 'Wind almost behind → a run, with the sail far out.' },
    ],
  },
  {
    title: 'How far out should the sail be?',
    focus: 'WATCH THE SAIL',
    lead: 'Now focus on the sail, not the route. Compare its position at three angles: close in, halfway out, far out.',
    transition: 'Turning now: watch the sail open or close with the course.',
    takeaway: 'Simple rule: wind near the bow, pull in. Wind farther behind, ease out. Fine-tune to the wind you feel aboard.',
    beats: [
      { heading: 45, sheet: 12, speed: 2.2, caption: 'Wind near the bow → pull the sail in close.' },
      { heading: 90, sheet: 45, speed: 2.6, caption: 'Wind from the side → let the sail halfway out.' },
      { heading: 135, sheet: 75, speed: 2.2, caption: 'Wind farther behind → ease the sail well out.' },
    ],
  },
  {
    title: 'Turn and adjust',
    focus: 'WATCH STEERING AND SAIL TOGETHER',
    lead: 'Steering changes where the wind meets the sail. Adjust both together.',
    transition: 'Turning now: steer and trim together.',
    takeaway: 'Turn toward the wind, pull in. Turn away, ease out. You will learn tacking and gybing later.',
    beats: [
      { heading: 90, sheet: 45, speed: 2.6, caption: 'Across the wind → the sail sits halfway out.' },
      { heading: 45, sheet: 12, speed: 2.2, caption: 'Turn toward the wind → pull the sail in.' },
      { heading: 90, sheet: 45, speed: 2.6, caption: 'Turn away again → ease the sail halfway out.' },
      { heading: 135, sheet: 75, speed: 2.2, caption: 'Turn farther away → ease the sail even more.' },
    ],
  },
]);

const BEAT_SECONDS = 4;
const TURN_SECONDS = 1.5;
const smooth = (value) => value * value * (3 - 2 * value);

export function nextTheoryBeatElapsed(stageIndex, elapsed) {
  const count = (THEORY_STAGES[stageIndex] ?? THEORY_STAGES[0]).beats.length;
  return ((Math.floor(elapsed / BEAT_SECONDS) + 1) % count) * BEAT_SECONDS;
}

export function sampleTheoryPose(stageIndex, elapsed, { reducedMotion = false } = {}) {
  const stage = THEORY_STAGES[stageIndex] ?? THEORY_STAGES[0];
  const beats = stage.beats;
  const time = reducedMotion ? 0 : ((elapsed % (beats.length * BEAT_SECONDS)) + beats.length * BEAT_SECONDS) % (beats.length * BEAT_SECONDS);
  const beatIndex = Math.floor(time / BEAT_SECONDS);
  const current = beats[beatIndex];
  const next = beats[(beatIndex + 1) % beats.length];
  const withinBeat = time % BEAT_SECONDS;
  const blend = reducedMotion ? 0 : smooth(Math.max(0, Math.min(1, (withinBeat - (BEAT_SECONDS - TURN_SECONDS)) / TURN_SECONDS)));
  const heading = (current.heading + (next.heading - current.heading) * blend) * DEG;
  return {
    heading,
    sheet: (current.sheet + (next.sheet - current.sheet) * blend) * DEG,
    speed: current.speed + (next.speed - current.speed) * blend,
    caption: blend > 0 && blend < 1 ? stage.transition : current.caption,
    point: pointOfSail(-heading).name,
  };
}
