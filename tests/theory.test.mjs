import test from 'node:test';
import assert from 'node:assert/strict';
import { DEG } from '../src/physics.js';
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

test('turning demo sheets in when heading up and eases on bearing away', () => {
  const poses = [0, 4, 8, 12].map((time) => sampleTheoryPose(2, time));
  assert.deepEqual(poses.map((pose) => degrees(pose.heading)), [90, 45, 90, 135]);
  assert.deepEqual(poses.map((pose) => degrees(pose.sheet)), [45, 12, 45, 75]);
});

test('each demo loops smoothly and reduced motion holds a stable pose', () => {
  const start = sampleTheoryPose(1, 0);
  const repeat = sampleTheoryPose(1, 20);
  assert.equal(repeat.heading, start.heading);
  assert.equal(repeat.sheet, start.sheet);
  const moving = sampleTheoryPose(2, 3.5);
  assert.ok(moving.heading < 90 * DEG && moving.heading > 45 * DEG);
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

test('turning captions explain the matching sail action, including the loop', () => {
  assert.match(sampleTheoryPose(2, 3).caption, /toward.*closer/);
  assert.match(sampleTheoryPose(2, 7).caption, /away.*out/);
  assert.match(sampleTheoryPose(2, 15).caption, /toward.*in/);
  assert.equal(sampleTheoryPose(1, 0).point, 'In Irons — No-Go Zone');
  assert.equal(sampleTheoryPose(1, 16).point, 'Running');
  assert.equal(theory.nextTheoryBeatElapsed(1, 16), 0);
});
