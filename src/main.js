// main.js — Sail Trainer 3D: renderer, input, cameras, audio, game loop
import * as THREE from '../vendor/three.module.min.js';
import { Wind, Boat, DEG, SHEET_MAX, clamp } from './physics.js';
import { Environment } from './ocean.js';
import { CoastScene } from './coast.js';
import { COAST_LOCATIONS, locationSummary } from './coast-data.js';
import { SEA_STATES } from './sea-state.js';
import { BoatView } from './boat.js';
import { HUD } from './hud.js';
import { LessonManager } from './lessons.js';
import { LESSONS, TESTS, ALL, byId } from './curriculum.js';
import { TrafficBoat } from './traffic.js';
import { WindStreaks } from './ocean.js';
import { storage } from './storage.js';
import { SailingFlow } from './onboarding.js';
import { TheoryDemo } from './theory-demo.js';

// ------------------------------------------------------------------ Setup
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.1, 12000);

const env = new Environment(scene);
const coast = new CoastScene(scene);
const worldEnvironment = {
  apply(spec, type) {
    const locationId = COAST_LOCATIONS[spec?.locationId] ? spec.locationId : 'tel-aviv';
    const seaState = SEA_STATES[spec?.seaState] ? spec.seaState : 'small';
    coast.setLocation(locationId);
    env.setSeaState(seaState);
    document.getElementById('environmentInfo').textContent = `📍 ${locationSummary(locationId, seaState)}`;
    document.getElementById('coastLocation').value = locationId;
    document.getElementById('seaState').value = seaState;
  },
};
const wind = new Wind(0, 6.2);
const boat = new Boat();
const view = new BoatView(scene);
const hud = new HUD();
const lessons = new LessonManager(scene, hud, view, worldEnvironment);
const traffic = new TrafficBoat(scene);
const streaks = new WindStreaks(scene);
const theoryDemo = new TheoryDemo({ view, env, coast, streaks, camera });

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ------------------------------------------------------------------ Input
const keys = Object.create(null);
let flow;
const canSail = () => flow?.state === 'sailing';
function clearInput() {
  for (const key of Object.keys(keys)) delete keys[key];
  dragging = false;
  boat.rudder = 0;
}
addEventListener('blur', clearInput);
document.addEventListener('visibilitychange', () => { if (document.hidden) clearInput(); });
// Inert handles focus and pointer access; this also guards synthetic input.
for (const type of ['click', 'pointerdown', 'wheel', 'input']) {
  document.getElementById('simulator').addEventListener(type, (event) => {
    if (!canSail()) { event.preventDefault(); event.stopImmediatePropagation(); }
  }, true);
}
addEventListener('keydown', (e) => {
  if (!canSail()) {
    if (flow?.state === 'result' && e.code === 'Enter' && e.target.tagName !== 'BUTTON') {
      e.preventDefault();
      if (lessons.failed) flow.enterItem(lessons.lesson());
      else flow.next();
    }
    return;
  }
  if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName) || e.target.isContentEditable) return;
  if (e.target.tagName === 'BUTTON' && ['Enter', 'Space'].includes(e.code)) return;
  if (e.repeat && !e.code.startsWith('Arrow')) return;
  keys[e.code] = true;
  if (e.code === 'KeyT') toggleAutoTrim();
  if (e.code === 'KeyC') cycleCamera();
  if (e.code === 'KeyM') toggleAudio();
  if (e.code === 'KeyH') document.getElementById('helpPanel').classList.toggle('show');
  if (e.code === 'KeyP') document.getElementById('posPanel').classList.toggle('show');
  if (e.code === 'KeyE') toggleHelm();
  if (e.code === 'Enter' && lessons.completed) nextItem();
  if (e.code === 'Enter' && lessons.failed) lessons.start(lessons.lesson(), boat, wind);
  if (e.code.startsWith('Digit')) {
    const i = Number(e.code.slice(5)) - 1;
    const list = e.shiftKey ? TESTS : LESSONS;
    if (i >= 0 && i < list.length) selectItem(list[i]);
  }
  if (['ArrowUp', 'ArrowDown', 'Space'].includes(e.code)) e.preventDefault();
});
addEventListener('keyup', (e) => (keys[e.code] = false));

function toggleAutoTrim() {
  boat.autoTrim = !boat.autoTrim;
  document.getElementById('autoTrimBtn').classList.toggle('on', boat.autoTrim);
}
document.getElementById('autoTrimBtn').addEventListener('click', toggleAutoTrim);

// ------------------------------------------------------------------ Helm
// Two steering conventions. A *wheel* is turned into the turn like a car
// (right → bow right); a *tiller* is pushed opposite the turn (right → bow
// left). The base input mapping (ArrowRight → rudder to starboard → bow right)
// is wheel behaviour, so tiller mode flips the sign of the human helm input.
// Physics + AI keep the original convention.
let helmMode = storage.getItem('helm') === 'wheel' ? 'wheel' : 'tiller';
function syncHelmBtn() {
  hud.helmMode = helmMode;
  document.getElementById('helmBtn').textContent =
    helmMode === 'wheel' ? '🛞 WHEEL' : '⚓ TILLER';
  view.setHelm(helmMode);
}
function toggleHelm() {
  helmMode = helmMode === 'wheel' ? 'tiller' : 'wheel';
  storage.setItem('helm', helmMode);
  syncHelmBtn();
  lessons.renderTutorial(boat);
}
document.getElementById('helmBtn').addEventListener('click', toggleHelm);
syncHelmBtn();

// Touch / mouse buttons
for (const [id, code] of [
  ['btnLeft', 'ArrowLeft'], ['btnRight', 'ArrowRight'], ['btnIn', 'ArrowUp'], ['btnOut', 'ArrowDown'],
]) {
  const el = document.getElementById(id);
  const on = (e) => { e.preventDefault(); if (canSail()) { el.setPointerCapture(e.pointerId); keys[code] = true; } };
  const off = (e) => { e.preventDefault(); keys[code] = false; };
  el.addEventListener('pointerdown', on);
  el.addEventListener('pointerup', off);
  el.addEventListener('pointerleave', off);
  el.addEventListener('pointercancel', off);
  el.addEventListener('lostpointercapture', off);
}

// ------------------------------------------------------------------ Camera
let camMode = 0; // 0 chase, 1 helm, 2 tactical top-down, 3 stern
const camModes = ['CHASE', 'HELM', 'TACTICAL', 'STERN'];
function cycleCamera() {
  camMode = (camMode + 1) % camModes.length;
  document.getElementById('camBtn').textContent = '📷 ' + camModes[camMode];
}
document.getElementById('camBtn').addEventListener('click', cycleCamera);

let orbitYaw = 0, orbitPitch = 0.24, orbitDist = 26;
let dragging = false, lastX = 0, lastY = 0;
renderer.domElement.addEventListener('pointerdown', (e) => {
  if (!canSail()) return;
  dragging = true; lastX = e.clientX; lastY = e.clientY;
});
addEventListener('pointerup', () => (dragging = false));
addEventListener('pointermove', (e) => {
  if (!canSail() || !dragging) return;
  orbitYaw -= (e.clientX - lastX) * 0.005;
  orbitPitch = clamp(orbitPitch + (e.clientY - lastY) * 0.004, 0.05, 1.2);
  lastX = e.clientX; lastY = e.clientY;
});
renderer.domElement.addEventListener('wheel', (e) => {
  if (!canSail()) return;
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
      bx - Math.sin(yaw) * horiz, // compass yaw → world (-sin, cos)
      2.5 + Math.sin(orbitPitch) * orbitDist,
      bz + Math.cos(yaw) * horiz
    );
    look = new THREE.Vector3(bx, 4.5, bz);
  } else if (camMode === 1) {
    // Helm view: standing at the wheel, looking past the mast
    want = new THREE.Vector3(bx - f.x * 3.6, 3.6, bz - f.z * 3.6);
    look = new THREE.Vector3(bx + f.x * 30, 3.0, bz + f.z * 30);
    stiff = 6;
  } else if (camMode === 2) {
    // Tactical: high top-down, north up — see your zigzag like a chart
    want = new THREE.Vector3(bx, 130, bz - 18);
    look = new THREE.Vector3(bx, 0, bz);
    stiff = 3;
  } else {
    // Stern view: just aft of and above the transom, looking forward over the
    // cockpit so the stern area — helm, backstay and mainsheet — fills the frame.
    want = new THREE.Vector3(bx - f.x * 8, 4.2, bz - f.z * 8);
    look = new THREE.Vector3(bx + f.x * 3, 2.2, bz + f.z * 3);
    stiff = 5;
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
document.getElementById('posBtn').addEventListener('click', () =>
  document.getElementById('posPanel').classList.toggle('show'));

// ------------------------------------------------------------ Mobile menu
// On phones the right rail (lesson picker, exam picker, tool buttons) lives in
// a slide-in drawer so the sailing screen stays uncluttered. On desktop the
// button and backdrop are display:none and this is inert.
const menuBackdrop = document.getElementById('menuBackdrop');
const compactMenu = matchMedia('(max-width: 860px)');
const freePanelToggle = document.getElementById('freePanelToggle');
function setFreePanel(expanded) {
  document.body.classList.toggle('free-panel-collapsed', !expanded);
  freePanelToggle.setAttribute('aria-expanded', String(expanded));
  freePanelToggle.textContent = expanded ? 'Close' : 'Settings';
}
function setMenu(open) {
  const rail = document.getElementById('rail');
  const button = document.getElementById('menuBtn');
  document.body.classList.toggle('menu-open', open);
  button.setAttribute('aria-expanded', String(open));
  rail.inert = compactMenu.matches && !open;
  if (open && compactMenu.matches) document.getElementById('learnTrack').focus();
  else if (rail.contains(document.activeElement)) button.focus();
}
compactMenu.addEventListener('change', () => {
  setMenu(false);
  setFreePanel(!compactMenu.matches);
});
setMenu(false);
setFreePanel(!compactMenu.matches);
addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && document.body.classList.contains('menu-open')) setMenu(false);
});
document.getElementById('menuBtn').addEventListener('click', () =>
  setMenu(!document.body.classList.contains('menu-open')));
menuBackdrop.addEventListener('click', () => setMenu(false));
freePanelToggle.addEventListener('click', () =>
  setFreePanel(freePanelToggle.getAttribute('aria-expanded') !== 'true'));

// Mainsheet trim bar can be minimized on phones (the toggle is desktop-hidden).
const trimToggle = document.getElementById('trimToggle');
if (storage.getItem('trimMin') === '1') {
  document.body.classList.add('trim-min');
  trimToggle.textContent = '+';
  trimToggle.title = 'Show mainsheet trim';
}
trimToggle.addEventListener('click', () => {
  const min = document.body.classList.toggle('trim-min');
  trimToggle.textContent = min ? '+' : '−';
  trimToggle.title = min ? 'Show mainsheet trim' : 'Minimize mainsheet trim';
  storage.setItem('trimMin', min ? '1' : '0');
});

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
function buildPicker(el, items, label) {
  items.forEach((item, i) => {
    const b = document.createElement('button');
    b.textContent = item.free ? '∞' : label(i);
    b.title = item.title;
    b.addEventListener('click', () => selectItem(item));
    el.appendChild(b);
  });
}
buildPicker(document.getElementById('lessonPicker'), LESSONS, (i) => String(i + 1));
buildPicker(document.getElementById('testPicker'), TESTS, (i) => 'T' + (i + 1));

function selectItem(item) {
  if (!lessons.isUnlocked(item)) {
    const need = item.type === 'test'
      ? 'Pass the previous test first'
      : 'Finish the earlier lessons first';
    // setTip is muted in exam mode — the mark info line is always visible.
    hud.setTip(`🔒 ${need} to unlock <b>${item.title}</b>.`, 'locked' + item.id);
    document.getElementById('markInfo').textContent = `🔒 ${need} — ${item.title}`;
    return;
  }
  flow.enterItem(item);
  setMenu(false); // collapse the mobile drawer once we're under way
}
function nextItem() {
  flow.next();
}
document.getElementById('nextLessonBtn').addEventListener('click', nextItem);
document.getElementById('retryBtn').addEventListener('click', () => flow.enterItem(lessons.lesson()));
document.getElementById('retakeBtn').addEventListener('click', () => flow.enterItem(lessons.lesson()));
document.getElementById('reviewBtn').addEventListener('click', () => {
  if (lessons.reviewTarget) flow.enterItem(byId(lessons.reviewTarget), { review: true });
});

// Wind panel (free sail)
const windDirInput = document.getElementById('windDir');
const windSpdInput = document.getElementById('windSpd');
const coastLocationInput = document.getElementById('coastLocation');
const seaStateInput = document.getElementById('seaState');
windDirInput.addEventListener('input', () => {
  wind.baseDirFrom = Number(windDirInput.value) * DEG;
  document.getElementById('windDirVal').textContent = windDirInput.value + '°';
});
windSpdInput.addEventListener('input', () => {
  wind.baseSpeed = Number(windSpdInput.value) / 1.94384;
  document.getElementById('windSpdVal').textContent = windSpdInput.value + ' kn';
});
coastLocationInput.addEventListener('change', () => {
  const item = lessons.lesson();
  if (!item.free) return;
  item.environment = { ...item.environment, locationId: coastLocationInput.value };
  flow.enterItem(item);
});
seaStateInput.addEventListener('change', () => {
  const item = lessons.lesson();
  if (!item.free) return;
  item.environment = { ...item.environment, seaState: seaStateInput.value };
  worldEnvironment.apply(item.environment, item.type);
});

// Central application state: entry screens pause all sailing activity.
flow = new SailingFlow(lessons, (item) => {
  clearInput();
  lessons.start(item, boat, wind);
  syncTrimBtn();
  view.update(0, boat, wind, env.time);
  updateCamera(1);
  if (item.free) setFreePanel(!compactMenu.matches);
}, (state) => {
  clearInput();
  setMenu(false);
  if (state !== 'theory') theoryDemo.stop();
  if (audio) audio.master.gain.setTargetAtTime(state === 'sailing' && audioOn ? 1 : 0, audio.ctx.currentTime, 0.2);
}, () => ({ touch: matchMedia('(pointer: coarse)').matches, helm: helmMode }),
  (stage) => {
    for (const buoy of lessons.buoys) buoy.visible = false;
    if (lessons.mobCtl?.ring) lessons.mobCtl.ring.visible = false;
    traffic.setActive(false, wind);
    theoryDemo.setStage(stage);
    return theoryDemo;
  });
document.getElementById('guidanceToggle').addEventListener('click', () => {
  lessons.guidanceHidden = !lessons.guidanceHidden;
  lessons.renderTutorial(boat);
});

// Debug/console handle (also used by automated tests)
window.__sail = {
  boat, wind, lessons, LESSONS, TESTS, ALL, byId, view, traffic, flow, env, coast, streaks, scene, theoryDemo,
  select: (id) => selectItem(byId(id)),
  mob: () => lessons.mobCtl,
};

// ------------------------------------------------------------------- Loop
flow.boot();
document.getElementById('camBtn').textContent = '📷 ' + camModes[0];

let last = performance.now();
let hudAccum = 0;

function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  if (flow.state === 'theory' && !document.hidden) {
    theoryDemo.update(dt, matchMedia('(prefers-reduced-motion: reduce)').matches);
    renderer.render(scene, camera);
    return;
  }

  if (!canSail() || document.hidden) {
    renderer.render(scene, camera);
    return;
  }

  // Controls → boat
  const helmSign = helmMode === 'wheel' ? 1 : -1;
  const rudderIn = ((keys.ArrowLeft ? -1 : 0) + (keys.ArrowRight ? 1 : 0)) * helmSign;
  boat.rudder += (rudderIn - boat.rudder) * Math.min(1, (rudderIn ? 5 : 3.2) * dt);
  if (Math.abs(boat.rudder) < 0.01 && !rudderIn) boat.rudder = 0;
  if (keys.ArrowUp) { boat.sheet = clamp(boat.sheet - 0.55 * dt, 2 * DEG, SHEET_MAX); boat.autoTrim = false; syncTrimBtn(); }
  if (keys.ArrowDown) { boat.sheet = clamp(boat.sheet + 0.55 * dt, 2 * DEG, SHEET_MAX); boat.autoTrim = false; syncTrimBtn(); }

  // Physics substeps for stability
  const steps = 2;
  for (let i = 0; i < steps; i++) {
    wind.update(dt / steps);
    boat.update(dt / steps, wind);
  }

  view.update(dt, boat, wind, env.time);
  traffic.setActive(!!lessons.lesson().free, wind);
  const advisory = traffic.update(dt, wind, boat, env.time);
  lessons.update(dt, boat, wind, env.time, advisory);
  if (lessons.completed || lessons.failed) flow.showResult();
  streaks.update(dt, wind, boat.pos, env.time);
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
