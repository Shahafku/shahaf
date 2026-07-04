// main.js — Sail Trainer 3D: renderer, input, cameras, audio, game loop
import * as THREE from '../vendor/three.module.min.js';
import { Wind, Boat, DEG, SHEET_MAX, clamp } from './physics.js';
import { Environment } from './ocean.js';
import { BoatView } from './boat.js';
import { HUD } from './hud.js';
import { LESSONS, LessonManager } from './lessons.js';

// ------------------------------------------------------------------ Setup
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.1, 2000);

const env = new Environment(scene);
const wind = new Wind(0, 6.2);
const boat = new Boat();
const view = new BoatView(scene);
const hud = new HUD();
const lessons = new LessonManager(scene, hud);

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ------------------------------------------------------------------ Input
const keys = Object.create(null);
addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  keys[e.code] = true;
  if (e.code === 'KeyT') toggleAutoTrim();
  if (e.code === 'KeyC') cycleCamera();
  if (e.code === 'KeyM') toggleAudio();
  if (e.code === 'KeyH') document.getElementById('helpPanel').classList.toggle('show');
  if (e.code === 'Enter' && lessons.completed) nextLesson();
  if (e.code.startsWith('Digit')) {
    const i = Number(e.code.slice(5)) - 1;
    if (i >= 0 && i < LESSONS.length) selectLesson(i);
  }
  if (['ArrowUp', 'ArrowDown', 'Space'].includes(e.code)) e.preventDefault();
});
addEventListener('keyup', (e) => (keys[e.code] = false));

function toggleAutoTrim() {
  boat.autoTrim = !boat.autoTrim;
  document.getElementById('autoTrimBtn').classList.toggle('on', boat.autoTrim);
}
document.getElementById('autoTrimBtn').addEventListener('click', toggleAutoTrim);

// Touch / mouse buttons
for (const [id, code] of [
  ['btnLeft', 'KeyA'], ['btnRight', 'KeyD'], ['btnIn', 'KeyW'], ['btnOut', 'KeyS'],
]) {
  const el = document.getElementById(id);
  const on = (e) => { e.preventDefault(); keys[code] = true; };
  const off = (e) => { e.preventDefault(); keys[code] = false; };
  el.addEventListener('pointerdown', on);
  el.addEventListener('pointerup', off);
  el.addEventListener('pointerleave', off);
}

// ------------------------------------------------------------------ Camera
let camMode = 0; // 0 chase, 1 helm, 2 tactical top-down
const camModes = ['CHASE', 'HELM', 'TACTICAL'];
function cycleCamera() {
  camMode = (camMode + 1) % camModes.length;
  document.getElementById('camBtn').textContent = '📷 ' + camModes[camMode];
}
document.getElementById('camBtn').addEventListener('click', cycleCamera);

let orbitYaw = 0, orbitPitch = 0.24, orbitDist = 26;
let dragging = false, lastX = 0, lastY = 0;
renderer.domElement.addEventListener('pointerdown', (e) => {
  dragging = true; lastX = e.clientX; lastY = e.clientY;
});
addEventListener('pointerup', () => (dragging = false));
addEventListener('pointermove', (e) => {
  if (!dragging) return;
  orbitYaw -= (e.clientX - lastX) * 0.005;
  orbitPitch = clamp(orbitPitch + (e.clientY - lastY) * 0.004, 0.05, 1.2);
  lastX = e.clientX; lastY = e.clientY;
});
renderer.domElement.addEventListener('wheel', (e) => {
  orbitDist = clamp(orbitDist + e.deltaY * 0.03, 12, 70);
});

const camPos = new THREE.Vector3(0, 10, -30);
const camTarget = new THREE.Vector3();
function updateCamera(dt) {
  const f = boat.forward();
  const bx = boat.pos.x, bz = boat.pos.z;
  let want, look, stiff = 2.4;
  if (camMode === 0) {
    const yaw = boat.heading + Math.PI + orbitYaw; // behind the boat + user orbit
    const horiz = Math.cos(orbitPitch) * orbitDist;
    want = new THREE.Vector3(
      bx + Math.sin(yaw) * horiz,
      2.5 + Math.sin(orbitPitch) * orbitDist,
      bz + Math.cos(yaw) * horiz
    );
    look = new THREE.Vector3(bx, 4.5, bz);
  } else if (camMode === 1) {
    // Helm view: standing at the wheel, looking past the mast
    want = new THREE.Vector3(bx - f.x * 3.6, 3.6, bz - f.z * 3.6);
    look = new THREE.Vector3(bx + f.x * 30, 3.0, bz + f.z * 30);
    stiff = 6;
  } else {
    // Tactical: high top-down, north up — see your zigzag like a chart
    want = new THREE.Vector3(bx, 130, bz - 18);
    look = new THREE.Vector3(bx, 0, bz);
    stiff = 3;
  }
  camPos.lerp(want, Math.min(1, stiff * dt));
  camTarget.lerp(look, Math.min(1, 5 * dt));
  camera.position.copy(camPos);
  camera.lookAt(camTarget);
}

// ------------------------------------------------------------------ Audio
let audio = null, audioOn = false;
function toggleAudio() {
  if (!audio) audio = makeAudio();
  audioOn = !audioOn;
  audio.master.gain.setTargetAtTime(audioOn ? 1 : 0, audio.ctx.currentTime, 0.2);
  document.getElementById('audioBtn').textContent = audioOn ? '🔊' : '🔇';
}
document.getElementById('audioBtn').addEventListener('click', toggleAudio);

function makeAudio() {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const master = ctx.createGain();
  master.gain.value = 0;
  master.connect(ctx.destination);
  const mkNoise = () => {
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf; src.loop = true; src.start();
    return src;
  };
  // Wind: band-passed noise, pitch/level follow apparent wind
  const windSrc = mkNoise();
  const windFilt = ctx.createBiquadFilter();
  windFilt.type = 'bandpass'; windFilt.frequency.value = 500; windFilt.Q.value = 0.6;
  const windGain = ctx.createGain(); windGain.gain.value = 0;
  windSrc.connect(windFilt).connect(windGain).connect(master);
  // Water: low-passed noise follows boat speed
  const waterSrc = mkNoise();
  const waterFilt = ctx.createBiquadFilter();
  waterFilt.type = 'lowpass'; waterFilt.frequency.value = 300;
  const waterGain = ctx.createGain(); waterGain.gain.value = 0;
  waterSrc.connect(waterFilt).connect(waterGain).connect(master);
  return { ctx, master, windFilt, windGain, waterFilt, waterGain };
}

function updateAudio() {
  if (!audio || !audioOn) return;
  const t = audio.ctx.currentTime;
  const aw = boat.aws;
  audio.windGain.gain.setTargetAtTime(clamp(aw / 14, 0, 1) * 0.22, t, 0.25);
  audio.windFilt.frequency.setTargetAtTime(300 + aw * 55, t, 0.25);
  const sp = Math.abs(boat.speed);
  audio.waterGain.gain.setTargetAtTime(clamp(sp / 5, 0, 1) * 0.18, t, 0.3);
  audio.waterFilt.frequency.setTargetAtTime(180 + sp * 90, t, 0.3);
}

// ------------------------------------------------------------- Lessons UI
const picker = document.getElementById('lessonPicker');
LESSONS.forEach((L, i) => {
  const b = document.createElement('button');
  b.textContent = L.free ? '∞' : String(i + 1);
  b.title = L.title;
  b.addEventListener('click', () => selectLesson(i));
  picker.appendChild(b);
});
function selectLesson(i) {
  if (i > lessons.unlocked && !LESSONS[i].free) {
    hud.setTip(`🔒 Finish the earlier lessons to unlock <b>${LESSONS[i].title}</b>.`, 'locked' + i);
    return;
  }
  lessons.start(i, boat, wind);
}
function nextLesson() {
  selectLesson(Math.min(lessons.index + 1, LESSONS.length - 1));
}
document.getElementById('nextLessonBtn').addEventListener('click', nextLesson);
document.getElementById('retryBtn').addEventListener('click', () => lessons.start(lessons.index, boat, wind));

// Wind panel (free sail)
const windDirInput = document.getElementById('windDir');
const windSpdInput = document.getElementById('windSpd');
windDirInput.addEventListener('input', () => {
  wind.baseDirFrom = Number(windDirInput.value) * DEG;
  document.getElementById('windDirVal').textContent = windDirInput.value + '°';
});
windSpdInput.addEventListener('input', () => {
  wind.baseSpeed = Number(windSpdInput.value) / 1.94384;
  document.getElementById('windSpdVal').textContent = windSpdInput.value + ' kn';
});

// ------------------------------------------------------------------- Loop
lessons.start(0, boat, wind);
document.getElementById('camBtn').textContent = '📷 ' + camModes[0];

let last = performance.now();
let hudAccum = 0;

function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  // Controls → boat
  const rudderIn = (keys.KeyA || keys.ArrowLeft ? -1 : 0) + (keys.KeyD || keys.ArrowRight ? 1 : 0);
  boat.rudder += (rudderIn - boat.rudder) * Math.min(1, (rudderIn ? 5 : 3.2) * dt);
  if (Math.abs(boat.rudder) < 0.01 && !rudderIn) boat.rudder = 0;
  if (keys.KeyW || keys.ArrowUp) { boat.sheet = clamp(boat.sheet - 0.55 * dt, 2 * DEG, SHEET_MAX); boat.autoTrim = false; syncTrimBtn(); }
  if (keys.KeyS || keys.ArrowDown) { boat.sheet = clamp(boat.sheet + 0.55 * dt, 2 * DEG, SHEET_MAX); boat.autoTrim = false; syncTrimBtn(); }

  // Physics substeps for stability
  const steps = 2;
  for (let i = 0; i < steps; i++) {
    wind.update(dt / steps);
    boat.update(dt / steps, wind);
  }

  view.update(dt, boat, wind, env.time);
  lessons.update(dt, boat, wind, env.time);
  updateCamera(dt);
  env.update(dt, camera, boat.pos);
  updateAudio();

  hudAccum += dt;
  if (hudAccum > 1 / 30) {
    hud.update(hudAccum, boat, wind);
    hudAccum = 0;
  }

  renderer.render(scene, camera);
}

function syncTrimBtn() {
  document.getElementById('autoTrimBtn').classList.toggle('on', boat.autoTrim);
}

requestAnimationFrame(frame);
