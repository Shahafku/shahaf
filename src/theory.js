// Short, scripted demonstrations drawn from docs/RESEARCH.md §§1–4.
// Headings are relative to a fixed north wind; no exercise physics or scoring runs.
import { DEG, pointOfSail } from './physics.js';

export const THEORY_STAGES = Object.freeze([
  {
    title: 'Where can you sail?',
    focus: 'Watch the Boat’s Heading',
    lead: 'The wind comes from the top. See how the boat’s angle relative to the wind determines your point of sail.',
    transition: 'Turning now: track the boat as it rotates around the wind wheel.',
    takeaway: 'Need to go upwind? You can’t sail straight into the wind—zigzag on close-hauled courses instead.',
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
    focus: 'Watch the Sail Trim',
    lead: 'As the boat turns relative to the wind, watch how the sail adjusts in or out to stay filled.',
    transition: 'Turning now: watch the sail pull in (tight) or let out (eased) with each course change.',
    takeaway: 'General rule: Wind near the bow? Pull sail in. Wind behind you? Let sail out.',
    beats: [
      { heading: 0, sheet: 12, speed: 0.2, caption: 'No-go zone → the sail flaps. Pulling it in will not help; turn away from the wind.' },
      { heading: 45, sheet: 12, speed: 2.2, caption: 'Wind near the bow → pull the sail in close.' },
      { heading: 90, sheet: 45, speed: 2.6, caption: 'Wind from the side → let the sail halfway out.' },
      { heading: 135, sheet: 75, speed: 2.2, caption: 'Wind farther behind → ease the sail well out.' },
      { heading: 175, sheet: 85, speed: 1.8, caption: 'Run → wind almost directly behind the boat. Let the sail far out.' },
    ],
  },
  {
    title: 'How do I know the sail is set correctly?',
    focus: 'SAME COURSE · WATCH THE SAIL',
    lead: 'Keep the boat pointing the same way. Watch the sail flap when it is too far out, then fill as you pull it in.',
    transition: 'Adjusting the sail while holding the same course.',
    takeaway: 'Let the sail out until it just starts to flap. Then pull it in a little until the flapping stops.',
    // Fixed course and speed keep apparent wind steady for this trim comparison.
    beats: [
      { heading: 90, sheet: 75, speed: 2.6, caption: 'Too far out: the sail is flapping. Pull it in slowly.', transition: 'Pulling the sail in slowly. Watch the flapping fade.' },
      { heading: 90, sheet: 55, speed: 2.6, caption: 'Stop here: the sail has filled and stopped flapping.', transition: 'Now let it out a little. Watch for the first flutter.' },
      { heading: 90, sheet: 61, speed: 2.6, caption: 'It starts to flap again. Pull it back in just a little.', transition: 'Pulling in a little until the sail fills again.' },
      { heading: 90, sheet: 55, speed: 2.6, caption: 'Filled again. This is how you find the right sail setting.', transition: 'Watch again: letting the sail too far out makes it flap.' },
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

export function previousTheoryBeatElapsed(stageIndex, elapsed) {
  const count = (THEORY_STAGES[stageIndex] ?? THEORY_STAGES[0]).beats.length;
  return ((Math.floor(elapsed / BEAT_SECONDS) - 1 + count) % count) * BEAT_SECONDS;
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
