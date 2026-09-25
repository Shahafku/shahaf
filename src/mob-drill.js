// mob-drill.js — the man-overboard (אדם בים) recovery as the Israeli practical
// exam expects it, precomputed as a track for the Lesson 5 demo. The ministry
// question bank's answer (shout, throw the ring, keep eye contact, bear away to
// a beam reach, recover) is expanded into six steps; see docs/RESEARCH.md §8.
// Pure data + math: no DOM, no three.js, so it can be checked under node.
import { Boat, Wind, DEG, clamp, wrapPi } from './physics.js';
import { THROW_ANIM, ringDropPoint, ringRelation, mobPassCondition } from './mob.js';

export const MOB_DEMO_WIND = Object.freeze({ dirFrom: 0, speed: 4.5 }); // Lesson 5 breeze

// caption: HTML shown on screen (carries the Hebrew exam terms).
// say: plain English for speechSynthesis — browser voices garble Hebrew script.
export const MOB_DEMO_STEPS = Object.freeze([
  {
    title: 'Shout, throw, point',
    caption: '<b>Shout “<bdi lang="he">אדם בים</bdi>!”</b> Throw the lifebuoy (<b><bdi lang="he">גלגל הצלה</bdi></b>) at once, and name a <b>spotter</b> who points at it and never looks away.',
    say: 'Man overboard! Shout it loud, throw the lifebuoy straight away, and name a spotter. Their only job is to keep pointing at the casualty.',
  },
  {
    title: 'Beam reach away · <bdi lang="he">רוח צד</bdi>',
    caption: 'Stay on a <b>beam reach (<bdi lang="he">רוח צד</bdi>)</b>, wind straight across the boat. Sail <b>3–4 boat lengths</b> clear to make room to turn.',
    say: 'Stay on a beam reach, with the wind straight across the boat, and sail three to four boat lengths clear. That is your room to turn.',
  },
  {
    title: 'Tack · <bdi lang="he">מהפך</bdi>',
    caption: '<b>Tack (<bdi lang="he">מהפך</bdi>)</b>: turn the bow through the wind onto the other tack. The spotter keeps pointing.',
    say: 'Now tack. Turn the bow through the wind onto the other tack, while the spotter keeps pointing at the ring.',
  },
  {
    title: 'Broad reach, below the ring',
    caption: 'Bear away to a <b>broad reach</b> and sail back to a point about <b>2 boat lengths downwind</b> of the ring. The final approach always comes from downwind.',
    say: 'Bear away to a broad reach and sail back to a point about two boat lengths downwind of the ring. The final approach always comes from downwind.',
  },
  {
    title: 'Close reach, luff to brake',
    caption: 'Head up to a <b>close reach</b> aimed at the ring and <b>ease the sheet right out</b>. The luffing sail is your brake — glide in slowly.',
    say: 'Head up to a close reach, aimed at the ring, and let the sheet run all the way out. The luffing sail is your brake. Glide in slowly.',
  },
  {
    title: 'Stop at the windward bow',
    caption: '<b>Stop</b> with the ring in the <b>front third</b>, close aboard, <b>to windward</b>. <i><bdi lang="he">המצוף בשליש הקדמי, הספינה עומדת, המצוף מעל לרוח</bdi>.</i>',
    say: 'Stop. The boat is standing still, the ring is in the front third, close aboard, on the windward side. That is exactly what the examiner wants to see.',
  },
]);

const DT = 1 / 30;
const BOAT_LENGTH = 9.5;              // bow +4.9 m, stern −4.6 m
const START_HEADING = 90 * DEG;       // beam reach, wind over the port side
const THROW_AT = 1.5;                 // s — crew starts the throw
const TOSS = 4;                       // m past the rail, as in Lesson 5
const STEP1_AT = 8;                   // s — give the shout time to be heard
const CLEAR_DIST = 4 * BOAT_LENGTH;   // how far to reach away before tacking
const TACK_HEADING = -48 * DEG;       // close-hauled on the new (starboard) tack
const TURN_RATE = 20 * DEG;           // rad/s, helm hard over
const BROAD_HEADING = -145 * DEG;     // broad reach back, wind on the starboard quarter
const APPROACH_HEADING = -60 * DEG;   // close reach on starboard tack
const STOP_AHEAD = 3.2;               // ring ahead of mid-ship at the stop…
const STOP_WINDWARD = 2.2;            // …and this far out to windward
const BRAKE = 0.17;                   // m/s² worst-case glide-down, sail luffing
const GLIDE_DRAG = 0.024;             // 1/m — hull drag ÷ mass with no drive
const HOLD = 9;                       // s standing still at the end

// Rough polar for the demo yacht in this breeze: [|TWA| deg, m/s].
const POLAR = [[0, 0.3], [35, 0.6], [45, 2.0], [90, 2.5], [150, 2.2], [180, 1.9]];
function cruiseSpeed(twa) {
  const a = Math.abs(twa) / DEG;
  for (let i = 1; i < POLAR.length; i++) {
    const [a1, v1] = POLAR[i];
    if (a <= a1) {
      const [a0, v0] = POLAR[i - 1];
      return v0 + (v1 - v0) * (a - a0) / (a1 - a0);
    }
  }
  return POLAR[POLAR.length - 1][1];
}

const dir = (h) => ({ x: -Math.sin(h), z: Math.cos(h) });    // Boat.forward()
const side = (h) => ({ x: -Math.cos(h), z: -Math.sin(h) });  // Boat.starboard()
const dot = (ax, az, b) => ax * b.x + az * b.z;

// One run of the recovery. turnUpAt is how far (m) to windward of the ring's
// approach line the helm starts heading up from the broad reach; the rest is
// fixed choreography. Kinematic, not the full force model: headings turn at a
// fixed rate and speed follows a simple polar, so the route is identical on
// every device and playback can seek freely.
function simulate(turnUpAt) {
  const wind = new Wind(MOB_DEMO_WIND.dirFrom, MOB_DEMO_WIND.speed);
  const boat = new Boat();
  const fwdA = dir(APPROACH_HEADING);
  const stbA = side(APPROACH_HEADING); // starboard = windward on this tack

  let x = 0, z = 0, h = START_HEADING, v = 2.4;
  let t = 0, step = 0, stepT = 0, settled = 0, ring = null;
  const samples = [];
  const stepStarts = [0];
  const next = () => { step++; stepT = 0; stepStarts.push(t); };

  for (let guard = 0; guard < 30 * 240; guard++) {
    // ---- Helm: turn toward the step's heading at a fixed rate -------------
    let turn = 0;
    if (step === 2) {
      // Always to port: the heading falls from 90° through 0°, the eye of the
      // wind — a tack, never the long way round through a gybe.
      const left = wrapPi(h - TACK_HEADING);
      turn = left > 0 ? -Math.min(TURN_RATE, left / DT) : 0;
    } else if (step < 5) {
      const want = step <= 1 ? START_HEADING : step === 3 ? BROAD_HEADING : APPROACH_HEADING;
      const err = wrapPi(want - h);
      turn = Math.sign(err) * Math.min(TURN_RATE, Math.abs(err) / DT);
    }

    // ---- Speed: sail on the polar, then glide with the sail luffing ---------
    if (step < 4) v += (cruiseSpeed(wrapPi(wind.dirFrom - h)) - v) * Math.min(1, DT / 2.2);
    else if (step === 4) {
      // Distance still to run before the ring sits STOP_AHEAD forward of mid-ship.
      const left = dot(ring.x - x, ring.z - z, fwdA) - STOP_AHEAD;
      v = Math.min(v - GLIDE_DRAG * v * v * DT, Math.sqrt(2 * BRAKE * Math.max(0, left)));
      if (left < 0.15 || v < 0.03) { v = 0; next(); }
    } else v = 0;

    samples.push({ t, x, z, h, v, step, luff: step >= 4, turn });
    if (step === 5 && stepT >= HOLD) break;

    // ---- Integrate ---------------------------------------------------------
    h = wrapPi(h + turn * DT);
    const f = dir(h);
    x += f.x * v * DT;
    z += f.z * v * DT;
    t += DT;
    stepT += DT;

    // ---- Step transitions ----------------------------------------------------
    if (!ring && t >= THROW_AT + THROW_ANIM) {
      boat.pos.x = x; boat.pos.z = z; boat.heading = h; boat.speed = v;
      boat.update(0, wind); // refresh AWA without moving anything
      ring = ringDropPoint(boat, TOSS);
    }
    if (step === 0 && t >= STEP1_AT) next();
    else if (step === 1 && Math.hypot(x - ring.x, z - ring.z) >= CLEAR_DIST) next();
    else if (step === 2 && Math.abs(wrapPi(h - TACK_HEADING)) < 0.5 * DEG) {
      settled += DT;
      if (settled > 1.2) next();
    } else if (step === 3 && dot(x - ring.x, z - ring.z, stbA) <= turnUpAt) next();
  }

  const last = samples[samples.length - 1];
  return {
    samples, stepStarts, ring,
    // How far the ring ends up to windward of the stopped boat's centreline.
    ringWindward: dot(ring.x - last.x, ring.z - last.z, side(last.h)),
  };
}

// Precompute the whole recovery. The turn-up point is solved by bisection so
// the straight close-reach approach ends with the ring STOP_WINDWARD out on
// the windward bow: head up too early and the boat stops on top of it, too
// late and it stops out of boat-hook reach.
export function buildMobTrack() {
  let lo = -20, hi = 20, run = null;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    run = simulate(mid);
    if (run.ringWindward > STOP_WINDWARD) lo = mid; else hi = mid;
  }
  const { samples, stepStarts, ring } = run;
  return {
    dt: DT, samples, stepStarts, ring,
    duration: samples[samples.length - 1].t,
    throwAt: THROW_AT, releaseAt: THROW_AT + THROW_ANIM, wind: MOB_DEMO_WIND,
  };
}

// Interpolated pose at playback time t (seconds).
export function sampleMobTrack(track, t) {
  const s = track.samples;
  const f = clamp(t / track.dt, 0, s.length - 1);
  const i = Math.min(Math.floor(f), s.length - 2);
  const a = s[i], b = s[i + 1], k = f - i;
  return {
    x: a.x + (b.x - a.x) * k,
    z: a.z + (b.z - a.z) * k,
    h: wrapPi(a.h + wrapPi(b.h - a.h) * k),
    v: a.v + (b.v - a.v) * k,
    turn: a.turn,
    step: k < 1 ? a.step : b.step,
    luff: a.luff,
  };
}

export function stepAt(track, t) {
  let i = 0;
  while (i + 1 < track.stepStarts.length && t >= track.stepStarts[i + 1]) i++;
  return i;
}

// Score the demo's final picture with the same rule the exam uses.
export function mobDemoFinalCheck(track) {
  const last = track.samples[track.samples.length - 1];
  const boat = new Boat();
  boat.pos.x = last.x; boat.pos.z = last.z; boat.heading = last.h; boat.speed = last.v;
  const mob = { thrown: true, ...ringRelation(boat, track.ring, track.wind.dirFrom) };
  const holdTime = last.t - track.stepStarts[5];
  return { pass: mobPassCondition(boat, { stoppedFor: holdTime, mob }), mob };
}
