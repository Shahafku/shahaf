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
    lead: 'Watch how far the sail is let out as the boat turns from facing the wind to sailing with the wind behind it.',
    transition: 'Turning now: watch the sail open or close with the course.',
    takeaway: 'Outside the no-go zone: wind near the bow, sail in. Wind farther behind, sail out. Pointing into the wind? Turn away first.',
    beats: [
      { heading: 0, sheet: 12, speed: 0.2, caption: 'No-go zone → the sail flaps. Pulling it in will not help; turn away from the wind.' },
      { heading: 45, sheet: 12, speed: 2.2, caption: 'Wind near the bow → pull the sail in close.' },
      { heading: 90, sheet: 45, speed: 2.6, caption: 'Wind from the side → let the sail halfway out.' },
      { heading: 135, sheet: 75, speed: 2.2, caption: 'Wind farther behind → ease the sail well out.' },
      { heading: 175, sheet: 85, speed: 1.8, caption: 'Run → wind almost directly behind the boat. Let the sail far out.' },
    ],
  },
  {
    title: 'Turn the boat. Adjust the sail.',
    focus: 'TOWARD THE WIND: SAIL IN · AWAY: SAIL OUT',
    lead: 'The bow is the front of the boat. As it turns closer to the wind, pull the sail in. As it turns away, let the sail out.',
    transition: 'Turning now: steer and trim together.',
    takeaway: 'Pull in means bring the sail closer to the boat’s centre. Let out means allow it farther to the side.',
    beats: [
      { heading: 90, sheet: 45, speed: 2.6, caption: 'Start here: wind from the side, sail halfway out.', transition: 'Turning toward the wind → bringing the sail closer to the boat.' },
      { heading: 45, sheet: 12, speed: 2.2, caption: 'Closer to the wind: the sail is pulled in close.', transition: 'Turning away from the wind → letting the sail out to the side.' },
      { heading: 90, sheet: 45, speed: 2.6, caption: 'Wind from the side again: the sail is halfway out.', transition: 'Turning farther away → letting the sail out even more.' },
      { heading: 135, sheet: 75, speed: 2.2, caption: 'Wind from behind the side: the sail is well out.', transition: 'Turning back toward the wind → pulling the sail halfway in.' },
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
    caption: blend > 0 && blend < 1 ? (current.transition ?? stage.transition) : current.caption,
    point: pointOfSail(-heading).name,
  };
}
