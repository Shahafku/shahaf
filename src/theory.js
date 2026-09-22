// Short, scripted demonstrations drawn from docs/RESEARCH.md §§1–4.
// Headings are relative to a fixed north wind; no exercise physics or scoring runs.
import { DEG, pointOfSail } from './physics.js';

export const THEORY_STAGES = Object.freeze([
  {
    title: 'Find your angle',
    lead: 'The wind can carry you in many directions. Straight into it is the exception.',
    takeaway: 'To travel upwind, sail at an angle and zigzag. Across the wind is a beam reach.',
    beats: [
      { heading: 0, sheet: 12, speed: 0.2, caption: 'Straight into the wind: the sail flaps. This is the no-go zone.' },
      { heading: 45, sheet: 12, speed: 2.2, caption: 'About 45° off the wind: close-hauled, sailing upwind.' },
      { heading: 90, sheet: 45, speed: 2.6, caption: 'Wind across the boat: a fast, forgiving beam reach.' },
      { heading: 135, sheet: 75, speed: 2.2, caption: 'Wind over the rear quarter: a broad reach.' },
      { heading: 175, sheet: 85, speed: 1.8, caption: 'Wind behind the boat: running downwind.' },
    ],
  },
  {
    title: 'Set the sail',
    lead: 'The sail needs room to meet the wind at each angle.',
    takeaway: 'Wind farther forward: sheet in. Wind farther aft: ease out. Fine-tune to the apparent wind once sailing.',
    beats: [
      { heading: 45, sheet: 12, speed: 2.2, caption: 'Close-hauled: keep the sail near the centerline.' },
      { heading: 90, sheet: 45, speed: 2.6, caption: 'Beam reach: let the sail halfway out.' },
      { heading: 135, sheet: 75, speed: 2.2, caption: 'Broad reach: ease the sail well out.' },
    ],
  },
  {
    title: 'Turn and adjust',
    lead: 'Every change of course needs a matching sail adjustment.',
    takeaway: 'Turn toward the wind and sheet in; turn away and ease out. Later lessons teach tacks and gybes.',
    beats: [
      { heading: 90, sheet: 45, speed: 2.6, caption: 'Start across the wind on a beam reach.' },
      { heading: 45, sheet: 12, speed: 2.2, caption: 'Head up toward the wind: turn and sheet in.' },
      { heading: 90, sheet: 45, speed: 2.6, caption: 'Turn away again: ease the sail as the wind moves aft.' },
      { heading: 135, sheet: 75, speed: 2.2, caption: 'Bear away onto a broad reach: ease farther out.' },
    ],
  },
]);

const BEAT_SECONDS = 4;
const TURN_SECONDS = 1.5;
const smooth = (value) => value * value * (3 - 2 * value);

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
    caption: blend > 0.5 ? next.caption : current.caption,
    point: pointOfSail(-heading).name,
  };
}
