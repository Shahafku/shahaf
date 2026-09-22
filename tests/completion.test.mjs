import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.min.js';
import { LessonManager } from '../src/lessons.js';
import { Boat, Wind } from '../src/physics.js';
import { byId } from '../src/curriculum.js';

// Minimal DOM boundary, as in the other runtime checks, plus enough of a canvas
// boundary for the celebration burst to be observable.
const elements = new Map();
const added = [];
globalThis.document = {
  getElementById(id) {
    if (!elements.has(id)) elements.set(id, { style: {}, classList: { add() {}, remove() {}, toggle() {} }, setAttribute() {}, focus() {} });
    return elements.get(id);
  },
  querySelectorAll: () => [],
  createElement: () => ({ style: {}, getContext: () => new Proxy({}, { get: () => () => {} }), remove() {} }),
  body: { appendChild: (el) => added.push(el) },
};
globalThis.localStorage = { getItem: () => null, setItem() {} };
globalThis.innerWidth = 1024;
globalThis.innerHeight = 768;
globalThis.matchMedia = () => ({ matches: false });
globalThis.requestAnimationFrame = () => 1;

function complete(id) {
  const hud = { setMode() {}, setTip() {}, setTutorial() {} };
  const manager = new LessonManager(new THREE.Scene(), hud, {});
  const boat = new Boat(), wind = new Wind();
  manager.start(id, boat, wind);
  manager._complete();
  return { manager, recap: document.getElementById('completeText').innerHTML };
}

test('completing a lesson recaps what was learned and what comes next', () => {
  const { recap } = complete('course');
  assert.match(recap, /What you learned/);
  assert.ok(recap.includes(byId('course').takeaway), 'the takeaway is shown in full');
  assert.match(recap, /Next up/);
  assert.ok(recap.includes(byId('upwind').title), 'the next lesson is named');
  assert.ok(
    recap.includes('The buoy is dead upwind.'),
    'the next lesson is previewed with the first sentence of its brief, without markup',
  );
  assert.ok(!recap.includes('Try pointing straight at it'), 'the preview stops after one sentence');
});

test('finishing an exercise sets off a celebration burst', () => {
  added.length = 0;
  complete('course');
  assert.equal(added.length, 1, 'a confetti canvas is put on the page');
});

test('the last item of a track says the track is finished instead of naming a next one', () => {
  const { recap } = complete('t-triangle');
  assert.ok(recap.includes(byId('t-triangle').takeaway), 'the takeaway is still shown');
  assert.match(recap, /Next up/);
  assert.match(recap, /full practical exam/);
});
