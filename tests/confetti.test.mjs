import test from 'node:test';
import assert from 'node:assert/strict';
import { burstConfetti } from '../src/confetti.js';

// Canvas boundary: a recording 2D context and a hand-driven animation clock.
function stubDom({ reducedMotion = false } = {}) {
  const children = [];
  const frames = [];
  const ctx = new Proxy({ canvas: null, calls: 0 }, {
    get(target, key) {
      if (key in target) return target[key];
      return (...args) => { target.calls++; return args; };
    },
    set(target, key, value) { target[key] = value; return true; },
  });
  globalThis.document = {
    createElement: () => ({
      style: {}, width: 0, height: 0,
      getContext: () => ctx,
      remove() { const i = children.indexOf(this); if (i >= 0) children.splice(i, 1); },
    }),
    body: { appendChild: (el) => children.push(el) },
  };
  globalThis.innerWidth = 1024;
  globalThis.innerHeight = 768;
  globalThis.devicePixelRatio = 2;
  globalThis.matchMedia = () => ({ matches: reducedMotion });
  globalThis.requestAnimationFrame = (fn) => { frames.push(fn); return frames.length; };
  return { children, ctx, runFrames: (count, step = 16) => {
    for (let i = 0, t = 0; i < count; i++, t += step) {
      const fn = frames.shift();
      if (!fn) return;
      fn(t);
    }
  } };
}

test('a burst puts a canvas on the page, draws on it, and clears it away when it ends', () => {
  const { children, ctx, runFrames } = stubDom();
  burstConfetti();
  assert.equal(children.length, 1, 'one overlay canvas is added');
  runFrames(5);
  assert.ok(ctx.calls > 0, 'the burst draws');
  assert.equal(children.length, 1, 'it is still running a moment in');
  runFrames(400);
  assert.equal(children.length, 0, 'the canvas removes itself once the burst is over');
});

test('a burst is skipped entirely when the user prefers reduced motion', () => {
  const { children } = stubDom({ reducedMotion: true });
  burstConfetti();
  assert.equal(children.length, 0, 'nothing is added to the page');
});
