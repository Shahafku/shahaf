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
