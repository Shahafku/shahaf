import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.min.js';
import { LessonManager } from '../src/lessons.js';
import { Boat, Wind, DEG } from '../src/physics.js';
import { byId } from '../src/curriculum.js';

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
