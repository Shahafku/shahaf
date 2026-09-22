import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.min.js';
import { LessonManager } from '../src/lessons.js';
import { Boat, Wind, DEG } from '../src/physics.js';
import { byId, upwindSailCue } from '../src/curriculum.js';

// Minimal DOM boundary; exercise the real runtime, curriculum, boat and buoys.
const elements = new Map();
globalThis.document = {
  getElementById(id) {
    if (!elements.has(id)) elements.set(id, { style: {}, classList: { add() {}, remove() {}, toggle() {} }, setAttribute() {}, focus() {} });
    return elements.get(id);
  },
  querySelectorAll: () => [],
};
globalThis.localStorage = { getItem: () => null, setItem() {} };
function setup(id = 'course') {
  const hud = { setMode() {}, setTip() {}, setTutorial() {} };
  const manager = new LessonManager(new THREE.Scene(), hud, {});
  const boat = new Boat(), wind = new Wind();
  manager.start(id, boat, wind);
  return { manager, boat, wind };
}
test('starting any activity applies its environment through the shared runtime path', () => {
  const applied = [];
  const hud = { setMode() {}, setTip() {}, setTutorial() {} };
  const environment = { apply: (spec, type) => applied.push({ spec, type }) };
  const manager = new LessonManager(new THREE.Scene(), hud, {}, environment);
  const boat = new Boat(), wind = new Wind();
  manager.start('course', boat, wind);
  manager.start('t-gybe', boat, wind);
  assert.deepEqual(applied, [
    { spec: { locationId: 'tel-aviv', seaState: 'calm' }, type: 'lesson' },
    { spec: { locationId: 'bat-yam', seaState: 'small' }, type: 'test' },
  ]);
});
test('exam entry does not require lessons; later exams require the previous pass', () => {
  const { manager } = setup();
  assert.equal(manager.isUnlocked(byId('t-course')), true);
  assert.equal(manager.isUnlocked(byId('t-tack')), false);
  manager.progress.add('t-course');
  assert.equal(manager.isUnlocked(byId('t-tack')), true);
  assert.equal(manager.progress.has('course'), false);
});
test('old passes remain replayable despite gaps', () => {
  const { manager } = setup();
  manager.progress.add('t-gybe');
  assert.equal(manager.isUnlocked(byId('t-gybe')), true);
});
test('Learn completion proceeds to the next lesson', () => {
  const { manager } = setup();
  assert.equal(manager.nextTarget().id, 'upwind');
});
test('Lesson 1 cannot finish by reaching the ring before the objectives', () => {
  const { manager, boat, wind } = setup();
  boat.pos.x = -260; boat.pos.z = 10;
  manager.update(0.05, boat, wind, 0);
  assert.equal(manager.completed, false);
  assert.equal(manager.markIdx, 0);
});
test('course-holding starts fresh and requires continuous time before ring completion', () => {
  const { manager, boat, wind } = setup();
  manager.ctx.onCourseTime = 14;
  boat.efficiency = 0.8; boat.speed = 2; boat.sheet = 60 * DEG;
  manager.update(0.05, boat, wind, 0);
  assert.equal(manager.stepIdx, 1);
  assert.equal(manager.ctx.onCourseTime, 0);
  manager.update(14, boat, wind, 0);
  assert.equal(manager.stepIdx, 1);
  boat.heading = 0;
  manager.update(0.05, boat, wind, 0);
  assert.equal(manager.ctx.onCourseTime, 0);
  boat.heading = 90 * DEG;
  manager.update(15, boat, wind, 0);
  assert.equal(manager.stepIdx, 2);
  boat.pos.x = -260; boat.pos.z = 10;
  manager.update(0.05, boat, wind, 0);
  assert.equal(manager.completed, true);
});

test('Lesson 1 waits for sail adjustment instead of transient startup efficiency', () => {
  const { manager, boat, wind } = setup();
  for (let i = 0; i < 120; i++) {
    wind.update(1 / 60); boat.update(1 / 60, wind);
    manager.update(1 / 60, boat, wind, 0);
  }
  assert.equal(manager.stepIdx, 0);
});

test('Lesson 2 guides a no-go attempt, a close-hauled leg, a tack, then the buoy', () => {
  const { manager, boat, wind } = setup('upwind');
  assert.equal(manager.stepIdx, 0);
  boat.twa = 0; boat.heading = 0;
  manager.update(2.6, boat, wind, 0);
  assert.equal(manager.stepIdx, 1);
  boat.twa = -45 * DEG; boat.heading = 45 * DEG; boat.speed = 2.1;
  manager.update(0.1, boat, wind, 0);
  assert.equal(manager.stepIdx, 2);
  boat.pos.z += 72;
  manager.update(0.1, boat, wind, 0);
  assert.equal(manager.stepIdx, 3);
  manager.ctx.tacked = true; boat.twa = 45 * DEG; boat.heading = -45 * DEG;
  manager.update(0.1, boat, wind, 0);
  assert.equal(manager.stepIdx, 4);
  boat.pos.z = 300; boat.pos.x = 0;
  manager.update(0.1, boat, wind, 0);
  assert.equal(manager.completed, true);
});

test('Lesson 2 sail cue distinguishes no-go, loose, tight and filled trim', () => {
  const boat = { twa: 0, sheet: 50 * DEG, bestSheet: 12 * DEG, luffing: true, stalled: false };
  assert.match(upwindSailCue(boat, false), /turn.*before.*sail/i);
  boat.twa = 45 * DEG;
  assert.match(upwindSailCue(boat, false), /too loose.*tighten.*↑/i);
  assert.match(upwindSailCue(boat, true), /too loose.*sail-in/i);
  boat.sheet = 2 * DEG; boat.luffing = false; boat.stalled = true;
  assert.match(upwindSailCue(boat, false), /too tight.*ease.*↓/i);
  boat.sheet = 12 * DEG; boat.stalled = false;
  assert.match(upwindSailCue(boat, false), /trim.*good/i);
});

test('Lesson 3 requires speed, a fresh tack, and acceleration on the new side before rings', () => {
  const { manager: m, boat: b, wind } = setup('tack');
  const tick = () => m.update(0.05, b, wind, 0);
  b.pos.x = 90; b.pos.z = 170;
  b.speed = 2.2; b.twa = -45 * DEG;
  tick();
  assert.equal(m.markIdx, 0, 'early rings cannot bypass coaching');
  assert.equal(m.stepIdx, 0, 'wait for 4.5 knots');
  b.speed = 2.4; b.twa = -10 * DEG;
  tick();
  assert.equal(m.stepIdx, 0, 'speed in the no-go zone is not ready to tack');
  b.twa = -45 * DEG;
  m.ctx.tacked = true;
  tick();
  assert.equal(m.stepIdx, 1);
  tick();
  assert.equal(m.stepIdx, 1, 'an earlier tack does not count');
  b.twa = 170 * DEG;
  tick();
  assert.equal(m.stepIdx, 1, 'a gybe is not a tack');
  b.twa = -45 * DEG; tick();
  // A new bow-first crossing reaches the recovery step, but not the ring step.
  b.twa = 5 * DEG; b.speed = 1.1; tick();
  assert.equal(m.stepIdx, 2);
  tick();
  assert.equal(m.stepIdx, 2, 'crossing the wind is not a settled tack');
  b.twa = 45 * DEG; b.speed = 2.4; b.efficiency = 0.2; tick();
  assert.equal(m.stepIdx, 2, 'wait for the sail to fill');
  b.efficiency = 0.8; b.twa = -45 * DEG; tick();
  assert.equal(m.stepIdx, 2, 'returning to the original side does not count');
  b.twa = 45 * DEG; tick();
  assert.equal(m.stepIdx, 3);
  for (const mark of m.current.marks) {
    b.pos.x = mark.x; b.pos.z = mark.z; tick();
  }
  assert.equal(m.completed, true);
});
