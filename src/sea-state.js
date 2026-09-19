// sea-state.js — one wave definition shared by CPU animation and water shader.

export const BASE_WAVES = Object.freeze([
  { dir: [1.0, 0.35], amp: 0.22, len: 23.0, speed: 1.15 },
  { dir: [0.55, 1.0], amp: 0.14, len: 11.0, speed: 1.6 },
  { dir: [-0.8, 0.6], amp: 0.07, len: 5.5, speed: 2.2, visualOnly: true },
  { dir: [0.9, -0.4], amp: 0.025, len: 2.1, speed: 3.4, ripple: true, visualOnly: true },
  { dir: [-0.2, -1.0], amp: 0.02, len: 1.3, speed: 4.1, ripple: true, visualOnly: true },
]);

export const SEA_STATES = Object.freeze({
  calm: Object.freeze({ id: 'calm', label: 'Calm water', waveScale: 0.28, rippleScale: 0.55, deep: '#124968', shallow: '#237b9e' }),
  small: Object.freeze({ id: 'small', label: 'Small waves', waveScale: 1, rippleScale: 1, deep: '#0b3d5c', shallow: '#14688f' }),
  choppy: Object.freeze({ id: 'choppy', label: 'Choppy sea', waveScale: 1.65, rippleScale: 1.5, deep: '#07334f', shallow: '#17617e' }),
});

let activeSeaState = 'small';

export function getSeaState(id = activeSeaState) {
  return SEA_STATES[id] ?? SEA_STATES.small;
}

export function setSeaState(id) {
  activeSeaState = getSeaState(id).id;
  return getSeaState();
}

export function activeSeaStateId() { return activeSeaState; }

export function sampleWaveHeight(id, x, z, t) {
  const state = getSeaState(id);
  let y = 0;
  for (const wave of BASE_WAVES) {
    if (wave.visualOnly) continue;
    const magnitude = Math.hypot(wave.dir[0], wave.dir[1]);
    const distance = (x * wave.dir[0] + z * wave.dir[1]) / magnitude;
    const scale = wave.ripple ? state.rippleScale : state.waveScale;
    y += wave.amp * scale * Math.sin(distance * Math.PI * 2 / wave.len + t * wave.speed);
  }
  return y;
}

export function waveHeight(x, z, t) {
  return sampleWaveHeight(activeSeaState, x, z, t);
}

export function sampleWaveSlope(id, x, z, t, distance = 2) {
  return {
    x: (sampleWaveHeight(id, x + distance, z, t) - sampleWaveHeight(id, x - distance, z, t)) / (distance * 2),
    z: (sampleWaveHeight(id, x, z + distance, t) - sampleWaveHeight(id, x, z - distance, t)) / (distance * 2),
  };
}

export function waveSlope(x, z, t, distance = 2) {
  return sampleWaveSlope(activeSeaState, x, z, t, distance);
}
