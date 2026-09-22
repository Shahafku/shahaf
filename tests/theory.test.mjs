import test from 'node:test';
import assert from 'node:assert/strict';
import { Boat, Wind, DEG } from '../src/physics.js';
import { THEORY_STAGES, sampleTheoryPose } from '../src/theory.js';
import * as theory from '../src/theory.js';

const degrees = (radians) => Math.round(radians / DEG);

test('wind-angle demo shows no-go, close-hauled, beam, broad, and running', () => {
  assert.equal(THEORY_STAGES.length, 3);
  assert.deepEqual([0, 4, 8, 12, 16].map((time) => degrees(sampleTheoryPose(0, time).heading)),
    [0, 45, 90, 135, 175]);
  assert.equal(sampleTheoryPose(0, 0).point, 'In Irons — No-Go Zone');
  assert.equal(sampleTheoryPose(0, 8).point, 'Beam Reach');
});

test('sail-setting demo eases the sheet as wind moves aft', () => {
  const poses = [0, 4, 8, 12, 16].map((time) => sampleTheoryPose(1, time));
  assert.deepEqual(poses.map((pose) => degrees(pose.heading)), [0, 45, 90, 135, 175]);
  assert.deepEqual(poses.map((pose) => degrees(pose.sheet)), [12, 12, 45, 75, 85]);
});

test('trim demo holds the course while the sail goes from flapping to filled', () => {
  const wind = new Wind(0, 6.2);
  wind.gustiness = 0;
  wind.shiftiness = 0;
  const states = [0, 4, 8, 12].map((time) => {
    const pose = sampleTheoryPose(2, time);
    const boat = new Boat();
    Object.assign(boat, { heading: pose.heading, sheet: pose.sheet, speed: pose.speed });
    boat.update(0, wind);
    boat.boom = -Math.sign(boat.awa) * Math.min(boat.sheet, Math.abs(boat.awa));
    boat.update(0, wind);
    return boat;
  });
  assert.ok(states.every((boat) => degrees(boat.heading) === 90));
  assert.ok(states[0].luff > 0.9, 'the initial sail visibly flaps');
  assert.equal(states[1].luff, 0, 'pulling in fills the sail');
  assert.ok(states[1].drive > states[0].drive, 'the filled sail produces drive');
  assert.ok(states[2].luff > 0 && states[2].luff < states[0].luff, 'easing produces a smaller flutter');
  assert.equal(states[3].luff, 0, 'a small pull fills it again');
});

test('each demo loops smoothly and reduced motion holds a stable pose', () => {
  const start = sampleTheoryPose(1, 0);
  const repeat = sampleTheoryPose(1, 20);
  assert.equal(repeat.heading, start.heading);
  assert.equal(repeat.sheet, start.sheet);
  const moving = sampleTheoryPose(2, 3.5);
  assert.equal(moving.heading, 90 * DEG);
  assert.ok(moving.sheet < 75 * DEG && moving.sheet > 55 * DEG);
  assert.match(sampleTheoryPose(0, 3.5).caption, /Turning/);
  assert.equal(sampleTheoryPose(2, 7, { reducedMotion: true }).heading,
    sampleTheoryPose(2, 0, { reducedMotion: true }).heading);
});

test('stepping advances to the next held position and wraps at the end', () => {
  assert.equal(theory.nextTheoryBeatElapsed?.(0, 0), 4);
  assert.equal(theory.nextTheoryBeatElapsed?.(0, 3.9), 4);
  assert.equal(theory.nextTheoryBeatElapsed?.(0, 4), 8);
  assert.equal(theory.nextTheoryBeatElapsed?.(0, 16), 0);
  assert.equal(theory.nextTheoryBeatElapsed?.(1, 8), 12);
});

test('trim captions describe sail adjustments on a steady course', () => {
  assert.match(sampleTheoryPose(2, 3).caption, /Pulling.*flapping/);
  assert.match(sampleTheoryPose(2, 7).caption, /let it out/);
  assert.match(sampleTheoryPose(2, 15).caption, /letting.*flap/);
  assert.equal(sampleTheoryPose(1, 0).point, 'In Irons — No-Go Zone');
  assert.equal(sampleTheoryPose(1, 16).point, 'Running');
  assert.equal(theory.nextTheoryBeatElapsed(1, 16), 0);
});
