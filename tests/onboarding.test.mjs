import test from 'node:test';
import assert from 'node:assert/strict';
import { SailingFlow } from '../src/onboarding.js';
import { byId } from '../src/curriculum.js';

test('entering Lesson 1 after theory starts sailing with its contextual tutorial', () => {
  const item = byId('course');
  let started, sailing = false;
  const flow = {
    lessons: { isUnlocked: () => true },
    theorySeen: true,
    saveTrack() {},
    start(value) { started = value; },
    sail() { sailing = true; },
    controlsIntro() { assert.fail('must not interpose a controls screen'); },
  };
  SailingFlow.prototype.enterItem.call(flow, item);
  assert.equal(started, item);
  assert.ok(started.tutorial);
  assert.equal(sailing, true);
});

test('a first Learn choice explains the journey before entering theory', () => {
  const originalDocument = globalThis.document;
  const listeners = new Map();
  globalThis.document = { getElementById: (id) => ({ addEventListener: (name, fn) => listeners.set(`${id}:${name}`, fn) }) };
  try {
    let screen, saved = false, resumed = false;
    const flow = {
      lessons: { resumeTarget: () => byId('course') },
      overlay: { classList: { toggle() {} } },
      theorySeen: false,
      forceTheory: false,
      screen(state, html) { screen = { state, html }; },
      saveTrack() { saved = true; },
      resume() { resumed = true; },
      welcome() {},
    };
    SailingFlow.prototype.introduce.call(flow, 'learn');
    assert.equal(screen.state, 'track-introduction');
    assert.match(screen.html, /Your sailing journey/);
    assert.match(screen.html, /Before we hop on the boat, let’s learn the basics\./);
    assert.match(screen.html, /Learn the basics[\s\S]*Take the helm[\s\S]*Test your skills/);
    assert.match(screen.html, /Start the tutorials/);
    assert.doesNotMatch(screen.html, /Feel the wind|Lesson 1 of 7|Fill the sail|three quick visual tutorials/i);
    listeners.get('setSailBtn:click')();
    assert.equal(flow.track, 'learn');
    assert.equal(saved, true);
    assert.equal(resumed, true);
  } finally {
    globalThis.document = originalDocument;
  }
});

test('first switch from Exam to Learn offers the journey before saving Learn', () => {
  const flow = {
    track: 'exam',
    theorySeen: false,
    state: 'sailing',
    introduce(track, options) { this.introduction = { track, options }; },
    saveTrack() { assert.fail('do not save Learn before the learner starts it'); },
    resume() { assert.fail('do not enter theory before the overview'); },
  };
  SailingFlow.prototype.switchTrack.call(flow, 'learn');
  assert.equal(flow.track, 'exam');
  assert.deepEqual(flow.introduction, { track: 'learn', options: { fromTrackSwitch: true } });
});
