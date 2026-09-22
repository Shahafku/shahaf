import test from 'node:test';
import assert from 'node:assert/strict';
import { DEG } from '../src/physics.js';
import { THEORY_STAGES, sampleTheoryPose } from '../src/theory.js';

const degrees = (radians) => Math.round(radians / DEG);

test('wind-angle demo shows no-go, close-hauled, beam, broad, and running', () => {
  assert.equal(THEORY_STAGES.length, 3);
  assert.deepEqual([0, 4, 8, 12, 16].map((time) => degrees(sampleTheoryPose(0, time).heading)),
    [0, 45, 90, 135, 175]);
  assert.equal(sampleTheoryPose(0, 0).point, 'In Irons — No-Go Zone');
  assert.equal(sampleTheoryPose(0, 8).point, 'Beam Reach');
});

test('sail-setting demo eases the sheet as wind moves aft', () => {
  const poses = [0, 4, 8].map((time) => sampleTheoryPose(1, time));
  assert.deepEqual(poses.map((pose) => degrees(pose.heading)), [45, 90, 135]);
  assert.deepEqual(poses.map((pose) => degrees(pose.sheet)), [12, 45, 75]);
});

test('turning demo sheets in when heading up and eases on bearing away', () => {
  const poses = [0, 4, 8, 12].map((time) => sampleTheoryPose(2, time));
  assert.deepEqual(poses.map((pose) => degrees(pose.heading)), [90, 45, 90, 135]);
  assert.deepEqual(poses.map((pose) => degrees(pose.sheet)), [45, 12, 45, 75]);
});

test('each demo loops smoothly and reduced motion holds a stable pose', () => {
  const start = sampleTheoryPose(1, 0);
  const repeat = sampleTheoryPose(1, 12);
  assert.equal(repeat.heading, start.heading);
  assert.equal(repeat.sheet, start.sheet);
  const moving = sampleTheoryPose(2, 3.5);
  assert.ok(moving.heading < 90 * DEG && moving.heading > 45 * DEG);
  assert.equal(sampleTheoryPose(2, 7, { reducedMotion: true }).heading,
    sampleTheoryPose(2, 0, { reducedMotion: true }).heading);
});
