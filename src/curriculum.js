// curriculum.js — the school: LEARN lessons and EXAM tests, structured after
// the Israeli sailing licence practical exam (המבחן המעשי). Lessons teach with
// full coaching; tests give only a goal, hide the aids, and can be failed.
//
// Wind blows FROM +Z ("north" on the HUD) in every item, so upwind = +Z.
import { DEG, KNOTS } from './physics.js';
import { mobPassCondition } from './mob.js';

// Shared item schema — see LessonManager for how each field is used:
// { id, type: 'lesson'|'test', title, brief, wind, boat, marks, steps,
//   pass?(boat,ctx), fail?(boat,ctx)->reason|null, timed?, timeLimit?,
//   timeLimitMsg?, mob?, stepHint?, takeaway, requires?, review?, next?, free? }

const ironsFail = (sec) => (b, ctx) =>
  ctx.ironsTime > sec ? `You sat head-to-wind (in irons) for over ${sec} seconds. Keep the boat sailing.` : null;

const mobFail = (b, ctx) => {
  const m = ctx.mob;
  if (!m || !m.thrown) return null;
  if (m.hullStrike) return 'You hit the casualty with the hull. Final approach must arrive with the way off the boat.';
  if ((m.overshoots || 0) >= 3) return 'Three blown approaches — the casualty has been in the water too long. Plan the approach before you turn.';
  return null;
};

export const LESSONS = [
  {
    id: 'course',
    type: 'lesson',
    title: 'Lesson 1 · Hold a Course',
    brief:
      'Wind pushes <b>across</b> the boat on a <b>beam reach</b> — the easiest, fastest point of sail. ' +
      'Sails work like wings: trim them to the <b>orange APP arrow</b> (apparent wind), not the blue one. ' +
      'A sailor holds a course <b>relative to the wind</b> — feel the angle, not just the compass.',
    wind: { dirFrom: 0, speed: 6.2 },
    boat: { x: 0, z: 0, heading: 90 * DEG, sheet: 80 * DEG },
    marks: [{ x: -260, z: 10 }],
    steps: [
      {
        text: 'Your sail is flapping (<b>luffing</b>) — it makes no power. Press <kbd>↑</kbd> to sheet in until it fills and the trim bar turns green.',
        done: (b) => b.efficiency > 0.7 && b.speed > 1.2,
      },
      {
        text: 'Now <b>hold the course</b>: keep the bow on the glowing ring (within ~15°) for <b>15 seconds</b> without wandering. Small rudder, steady wind angle.',
        done: (b, ctx) => ctx.onCourseTime > 15,
      },
      { text: 'Steady hand! Sail through the ring to finish.', done: () => false },
    ],
    takeaway:
      'Rule one of trim: <b>“When in doubt, let it out”</b> — ease until the sail luffs, then sheet back in until it stops. ' +
      'And a course is held with the <b>wind angle</b>: if the rose drifts, you drifted.',
    next: 't-course',
  },
  {
    id: 'upwind',
    type: 'lesson',
    title: 'Lesson 2 · The No-Go Zone',
    brief:
      'The buoy is <b>dead upwind</b>. Try pointing straight at it — and watch what the wind does to your sails. ' +
      'The red wedge on the wind rose marks the <b>no-go zone</b>.',
    wind: { dirFrom: 0, speed: 6.2 },
    boat: { x: 0, z: 0, heading: 60 * DEG, sheet: 40 * DEG },
    marks: [{ x: 0, z: 300 }],
    steps: [
      {
        text: 'Turn the bow straight toward the buoy (dead upwind) and see what happens…',
        done: (b, ctx) => (ctx.timeInNoGo ?? 0) > 2.5,
      },
      {
        text: '<b>You’re in irons!</b> Sails can’t work within ~35° of the wind. Bear away (turn ~50° off the wind), sheet in, and rebuild speed.',
        done: (b) => b.speed > 2.0 && Math.abs(b.twa) > 33 * DEG && Math.abs(b.twa) < 75 * DEG,
      },
      {
        text: 'This angle is <b>close-hauled</b> — as close to the wind as a yacht can sail. Zigzag upwind: hold this angle, and turn through the wind (<b>tack</b>) when the buoy is far to one side.',
        done: () => false,
      },
    ],
    takeaway:
      'No boat can sail straight upwind. Progress to windward is a zigzag of close-hauled legs called <b>beating</b>. If you stall head-to-wind (“in irons”), the boat drifts backwards until you fall off and refill the sails.',
    next: 'tack',
  },
  {
    id: 'tack',
    type: 'lesson',
    title: 'Lesson 3 · Tacking · מהפך',
    brief:
      'A <b>tack (מהפך)</b> turns the bow through the wind onto the other close-hauled course. ' +
      '<b>Speed is the fuel</b> that carries you through the no-go zone — never tack slow.',
    wind: { dirFrom: 0, speed: 6.6 },
    boat: { x: -60, z: 0, heading: 40 * DEG, sheet: 12 * DEG },
    marks: [
      { x: 90, z: 170 },
      { x: -90, z: 340 },
      { x: 0, z: 500 },
    ],
    steps: [
      {
        text: 'Get close-hauled on <b>port tack</b> (wind over the left side) and build speed above 4.5 kn.',
        done: (b) => b.speed * KNOTS > 4.5 && Math.abs(b.twa) < 60 * DEG,
      },
      {
        text: 'Now <b>tack</b>: turn briskly through the wind until the sails fill on the other side (~45° past head-to-wind). Keep the turn smooth — a slammed rudder is a brake.',
        done: (b, ctx) => ctx.tacked === true,
      },
      {
        text: 'Clean tack! Round each ring in order — every crossing needs another tack. Starboard tack (wind from the right) has <b>right of way</b> under COLREGs Rule 12.',
        done: () => false,
      },
    ],
    takeaway:
      'Tack recipe: <b>speed → smooth helm → cross the eye of the wind → fill on the new side → trim & accelerate</b>. ' +
      'In the exam you get only a mark — <b>you</b> plan where to tack.',
    next: 't-tack',
  },
  {
    id: 'gybe',
    type: 'lesson',
    title: 'Lesson 4 · The Gybe · סיבוב',
    brief:
      'Downwind the sail becomes a <b>parachute</b> — ease it right out. To change sides with the wind astern you <b>gybe (סיבוב)</b>: the stern crosses the wind and the boom sweeps across. On a real boat, an uncontrolled boom is dangerous — control it with the sheet.',
    wind: { dirFrom: 0, speed: 6.6 },
    boat: { x: 0, z: 320, heading: 170 * DEG, sheet: 30 * DEG },
    marks: [
      { x: 110, z: 120 },
      { x: -110, z: -60 },
      { x: 0, z: -220 },
    ],
    steps: [
      {
        text: 'Bear away onto a <b>broad reach</b> (wind over the quarter, ~130–150°) and ease the sheet way out with <kbd>↓</kbd>.',
        done: (b) => Math.abs(b.twa) > 115 * DEG && b.efficiency > 0.55,
      },
      {
        text: 'To gybe safely: <b>sheet in first</b>, turn the stern through the wind, then ease out on the new side. Watch the boom cross. Avoid sailing <b>by the lee</b> (wind sneaking behind the boom) — that invites an accidental gybe.',
        done: (b, ctx) => ctx.gybed === true,
      },
      { text: 'Gybed! Run the rings down to the finish.', done: () => false },
    ],
    takeaway:
      'Tack = bow through the wind (upwind). <b>Gybe = stern through the wind</b> (downwind) — always under control: sheet in, turn, ease out. Dead-downwind “by the lee” is the accidental-gybe danger zone.',
    next: 't-gybe',
  },
  {
    id: 'mob-easy',
    type: 'lesson',
    title: 'Lesson 5 · Man Overboard I · אדם בים',
    brief:
      'The exam’s hardest exercise: a crewmate throws a <b>lifebuoy (גלגל הצלה)</b> into the water. Bring the boat back and <b>stop</b> next to it — ' +
      'ring in the <b>front third</b> of the boat, close aboard, <b>to windward of you</b>. Light, steady wind today: learn the shape of the approach.',
    wind: { dirFrom: 0, speed: 4.5, gustiness: 0.04, shiftiness: 1.5 },
    boat: { x: 0, z: 0, heading: 90 * DEG, sheet: 45 * DEG },
    marks: [],
    mob: { throwAfter: 8, tossDist: 4, driftFactor: 0.015 },
    steps: [
      {
        text: 'Sail on — your crewmate is standing by at the stern. Build speed on the beam reach.',
        done: (b, ctx) => !!(ctx.mob && ctx.mob.thrown),
      },
      {
        text: '<b>Ring in the water!</b> Sail a few lengths clear, then turn and come back <b>below</b> the ring — get downwind of it, so your final approach points toward the wind.',
        done: (b, ctx) => ctx.mob.ringDist < 40 && ctx.mob.ringWindward,
      },
      {
        text: 'Final approach: point <b>close-hauled / close reach</b> at the ring and <b>ease the sheet out</b> to slow down. Stop with the ring off the bow, within a boat length or two, wind beyond it. To brake: let the sail luff completely.',
        done: () => false,
      },
    ],
    pass: mobPassCondition,
    takeaway:
      'The MOB shape: <b>clear away → turn → approach from downwind → luff sails to stop</b> with the casualty in the front third, to windward. ' +
      'Sails have no brakes — the luff is your brake. Next: same drill in real wind.',
    next: 'mob-med',
  },
  {
    id: 'mob-med',
    type: 'lesson',
    title: 'Lesson 6 · Man Overboard II',
    brief:
      'Same drill, working breeze. The boat carries more way — start slowing <b>earlier</b>, and mind the drift: ' +
      'the ring moves downwind while you maneuver.',
    wind: { dirFrom: 0, speed: 6.5 },
    boat: { x: 0, z: 0, heading: 90 * DEG, sheet: 45 * DEG },
    marks: [],
    mob: { throwAfter: 15, tossDist: 5, driftFactor: 0.02 },
    steps: [
      {
        text: 'Sail the beam reach and wait for the shout…',
        done: (b, ctx) => !!(ctx.mob && ctx.mob.thrown),
      },
      {
        text: '<b>Ring in the water!</b> Get downwind of it and make your approach: close-hauled, sheets eased, stop with the ring off the bow to windward.',
        done: () => false,
      },
    ],
    pass: mobPassCondition,
    takeaway:
      'More wind = more way to kill. Ease early, aim a touch below the ring, and let the luffing sail bleed the last knots. ' +
      'One more level: gusts and shifts.',
    next: 'mob-hard',
  },
  {
    id: 'mob-hard',
    type: 'lesson',
    title: 'Lesson 7 · Man Overboard III',
    brief:
      'Exam conditions and worse: strong, gusty, shifting wind. The exam’s fail rules apply — <b>don’t hit the ring</b>, ' +
      'and don’t blow three approaches. You know the drill.',
    wind: { dirFrom: 0, speed: 9, gustiness: 0.25, shiftiness: 8 },
    boat: { x: 0, z: 0, heading: 90 * DEG, sheet: 45 * DEG },
    marks: [],
    mob: { throwAfter: 10, tossDist: 6, driftFactor: 0.025 },
    steps: [
      {
        text: 'Strong breeze. When the ring goes in: clear away, come back downwind of it, and make one clean, slow approach.',
        done: () => false,
      },
    ],
    pass: mobPassCondition,
    fail: mobFail,
    review: 'mob-med',
    takeaway:
      'If you can park next to a lifebuoy in a gusty 18 knots, the exam version will feel easy. Take the test — <b>אדם בים</b> awaits.',
    next: 't-mob',
  },
  {
    id: 'free',
    type: 'lesson',
    title: 'Free Sail',
    brief:
      'Open water. Change wind strength and direction from the WIND panel and feel how the boat answers on every point of sail. Gusts and shifts are live — watch the apparent wind move. ' +
      'A <b>tan-sailed yacht</b> is sailing a circuit: practice <b>COLREGs Rule 12</b> — the HUD tells you who stands on and who keeps clear.',
    wind: { dirFrom: 0, speed: 6.5, live: true },
    boat: { x: 0, z: 0, heading: 90 * DEG, sheet: 45 * DEG },
    marks: [],
    steps: [],
    free: true,
    takeaway: '',
  },
];

// EXAM — goal only, no coaching, no trim aids. Pass/fail like the real thing.
export const TESTS = [
  {
    id: 't-course',
    type: 'test',
    title: 'Test 1 · Hold a Course · שמירת כיוון',
    brief:
      '<b>Goal:</b> sail to the mark and pass through the ring, keeping the boat driving on a steady course relative to the wind.',
    wind: { dirFrom: 0, speed: 6.2 },
    boat: { x: 0, z: 0, heading: 90 * DEG, sheet: 80 * DEG },
    marks: [{ x: -260, z: 10 }],
    steps: [],
    stepHint: 'Head for the glowing ring. The examiner is watching your wind angle.',
    fail: ironsFail(20),
    timeLimit: 240,
    requires: ['course'],
    takeaway: 'Course held, mark made. That is exam exercise one.',
    next: 'upwind',
  },
  {
    id: 't-tack',
    type: 'test',
    title: 'Test 2 · Tack · מהפך',
    brief:
      '<b>Goal:</b> plan and execute a <b>tack (מהפך)</b> — cross the wind bow-first — then fetch the mark on the new tack.',
    wind: { dirFrom: 0, speed: 6.6 },
    boat: { x: -60, z: 0, heading: 40 * DEG, sheet: 12 * DEG },
    marks: [{ x: 120, z: 260 }],
    steps: [],
    stepHint: 'One clean tack, then the ring. You choose where to turn.',
    pass: (b, ctx) => ctx.tacked && ctx.marksDone,
    fail: (b, ctx) =>
      ironsFail(8)(b, ctx) ||
      (ctx.gybed && !ctx.tacked
        ? 'You turned the stern through the wind — that was a gybe (סיבוב), not a tack (מהפך).'
        : null),
    timeLimit: 180,
    requires: ['tack'],
    takeaway: 'Bow through the eye of the wind, sails filled, mark fetched — a clean מהפך.',
    next: 'gybe',
  },
  {
    id: 't-gybe',
    type: 'test',
    title: 'Test 3 · Gybe · סיבוב',
    brief:
      '<b>Goal:</b> plan and execute a <b>gybe (סיבוב)</b> — cross the wind stern-first, boom under control — then fetch the mark on the new side.',
    wind: { dirFrom: 0, speed: 6.6 },
    boat: { x: 0, z: 320, heading: 170 * DEG, sheet: 30 * DEG },
    marks: [{ x: 140, z: 60 }],
    steps: [],
    stepHint: 'One controlled gybe, then the ring. Sheet in before you turn.',
    pass: (b, ctx) => ctx.gybed && ctx.marksDone,
    fail: (b, ctx) =>
      ctx.tacked && !ctx.gybed
        ? 'You turned the bow through the wind — that was a tack (מהפך). The examiner asked for a gybe (סיבוב).'
        : null,
    timeLimit: 180,
    requires: ['gybe'],
    takeaway: 'Stern through the wind, boom crossed under control — a clean סיבוב.',
    next: 'mob-easy',
  },
  {
    id: 't-mob',
    type: 'test',
    title: 'Test 4 · Man Overboard · אדם בים',
    brief:
      '<b>Goal:</b> when the lifebuoy goes in — bring the boat back and stop: the ring in the <b>front third</b> of the boat, close aboard, ' +
      '<b>to windward</b>, boat standing. <i>המצוף בשליש הקדמי, הספינה עומדת, המצוף מעל לרוח.</i>',
    wind: { dirFrom: 0, speed: 6.5 },
    boat: { x: 0, z: 0, heading: 90 * DEG, sheet: 45 * DEG },
    marks: [],
    mob: { throwAfter: 12, tossDist: 5, driftFactor: 0.02 },
    steps: [],
    stepHint: 'Sail on. When it happens — it’s your boat.',
    pass: mobPassCondition,
    fail: mobFail,
    timeLimit: 300,
    timeLimitMsg: 'Too long — a casualty can’t wait five minutes. Plan a tighter return.',
    requires: ['mob-easy'],
    takeaway: 'Casualty recovered: boat standing, ring in the front third, to windward. The exam’s key exercise — well sailed.',
    next: 't-beat',
  },
  {
    id: 't-beat',
    type: 'test',
    title: 'Test 5 · Beat to Windward · הפלגה ברוח',
    brief:
      '<b>Goal:</b> the mark is <b>dead upwind</b> — no boat sails straight there. Beat up to it in close-hauled legs (at least two tacks).',
    wind: { dirFrom: 0, speed: 6.6 },
    boat: { x: 0, z: 0, heading: 45 * DEG, sheet: 14 * DEG },
    marks: [{ x: 0, z: 380 }],
    steps: [],
    stepHint: 'Zigzag. Tack on the edges, keep speed through every turn.',
    pass: (b, ctx) => ctx.marksDone && ctx.tackCount >= 2,
    fail: ironsFail(10),
    timeLimit: 420,
    requires: ['upwind', 'tack'],
    takeaway: 'A windward mark, earned the only way there is — one close-hauled leg at a time.',
    next: 't-triangle',
  },
  {
    id: 't-triangle',
    type: 'test',
    title: 'Test 6 · Triangle Course · מסלול משולש',
    brief:
      '<b>Goal:</b> round all three marks in order — <b>beat</b> up, <b>reach</b> across, <b>run</b> home. Every point of sail, against the clock.',
    wind: { dirFrom: 0, speed: 7.2 },
    boat: { x: 0, z: 0, heading: 45 * DEG, sheet: 14 * DEG },
    marks: [
      { x: 0, z: 420 },
      { x: -300, z: 120 },
      { x: 0, z: -60 },
    ],
    steps: [],
    stepHint: 'Windward mark first. The clock is running.',
    timed: true,
    timeLimit: 600,
    requires: ['tack', 'gybe'],
    takeaway: 'Beat, reach and run in one course — the full exam picture. That’s yacht sailing.',
    next: 'free',
  },
];

export const ALL = [...LESSONS, ...TESTS];
export const byId = (id) => ALL.find((x) => x.id === id);
