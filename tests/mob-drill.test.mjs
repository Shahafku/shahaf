import test from 'node:test';
import assert from 'node:assert/strict';
import { DEG, wrapPi, pointOfSail } from '../src/physics.js';
import {
  MOB_DEMO_STEPS, MOB_DEMO_WIND, buildMobTrack, sampleMobTrack, stepAt, mobDemoFinalCheck,
} from '../src/mob-drill.js';

const track = buildMobTrack();
const inStep = (i) => track.samples.filter((s) => s.step === i);
const twa = (s) => wrapPi(MOB_DEMO_WIND.dirFrom - s.h);
const BOAT_LENGTH = 9.5;

test('the demo runs the six exam steps in order', () => {
  assert.equal(MOB_DEMO_STEPS.length, 6);
  assert.equal(track.stepStarts.length, 6);
  for (let i = 1; i < 6; i++) assert.ok(track.stepStarts[i] > track.stepStarts[i - 1]);
  for (const step of MOB_DEMO_STEPS) {
    assert.ok(step.title && step.caption && step.say);
    assert.doesNotMatch(step.say, /[֐-׿]/, 'speech text must be plain English');
  }
});

test('the ring goes in over the leeward side while on a beam reach', () => {
  assert.ok(track.ring.z < 0, 'ring lands downwind of the course');
  assert.equal(pointOfSail(twa(sampleMobTrack(track, track.releaseAt))).short, 'B.REACH');
});

test('the boat reaches 3–4 boat lengths away on a beam reach before tacking', () => {
  for (const s of inStep(1)) assert.equal(pointOfSail(twa(s)).short, 'B.REACH');
  const atTack = inStep(2)[0];
  const d = Math.hypot(atTack.x - track.ring.x, atTack.z - track.ring.z) / BOAT_LENGTH;
  assert.ok(d >= 3 && d <= 4.2, `tacked ${d.toFixed(1)} lengths away`);
});

test('the turn is a tack: the bow crosses the wind, never the stern', () => {
  const tack = inStep(2);
  assert.ok(tack.some((s) => Math.abs(twa(s)) < 5 * DEG), 'bow passes head-to-wind');
  assert.ok(tack.every((s) => Math.abs(twa(s)) <= 95 * DEG), 'stern never passes the wind');
  assert.ok(Math.sign(twa(tack[0])) !== Math.sign(twa(tack[tack.length - 1])), 'ends on the other tack');
});

test('the return is a broad reach to about two lengths downwind of the ring', () => {
  const steady = inStep(3).filter((s) => Math.abs(s.turn) < 1e-6);
  assert.ok(steady.length > 60);
  for (const s of steady) assert.equal(pointOfSail(twa(s)).short, 'BROAD');
  const turnUp = inStep(4)[0];
  const away = Math.hypot(turnUp.x - track.ring.x, turnUp.z - track.ring.z) / BOAT_LENGTH;
  assert.ok(away >= 1.5 && away <= 2.8, `headed up ${away.toFixed(1)} lengths from the ring`);
  assert.ok(turnUp.z < track.ring.z - BOAT_LENGTH / 2, 'heads up from downwind of the ring');
});

test('the final approach is a luffing close reach that glides to a stop', () => {
  const approach = inStep(4);
  const settled = approach.filter((s) => Math.abs(s.turn) < 2 * DEG);
  assert.ok(settled.length > 90);
  for (const s of settled) assert.equal(pointOfSail(twa(s)).short, 'C.REACH');
  assert.ok(approach.every((s) => s.luff));
  for (let i = 1; i < approach.length; i++) assert.ok(approach[i].v <= approach[i - 1].v + 1e-9, 'never speeds up');
  assert.ok(inStep(5).every((s) => s.v === 0));
});

test('the demo ends in the exam pass position', () => {
  const { pass, mob } = mobDemoFinalCheck(track);
  assert.ok(pass, JSON.stringify(mob));
  assert.ok(mob.ringWindward);
  assert.ok(mob.ringFwdOffset > 1.6);
});

test('playback sampling and step lookup agree with the precomputed track', () => {
  for (let i = 0; i < 6; i++) {
    assert.equal(stepAt(track, track.stepStarts[i]), i);
    assert.equal(stepAt(track, track.stepStarts[i] + 0.1), i);
  }
  const end = sampleMobTrack(track, track.duration + 5);
  const last = track.samples[track.samples.length - 1];
  assert.equal(end.x, last.x);
  assert.equal(end.step, 5);
});
