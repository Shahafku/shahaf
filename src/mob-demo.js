// mob-demo.js — the man-overboard demo shown before Lesson 5. Plays the
// precomputed recovery from mob-drill.js on the shared yacht mesh and sea,
// with captions and voiceover. Presentation only, like TheoryDemo: it has its
// own Boat/Wind and never touches LessonManager, marks, timers or scoring.
import * as THREE from '../vendor/three.module.min.js';
import { Boat, Wind, DEG, SHEET_MAX, clamp } from './physics.js';
import { makeLifeRing, bobLifeRing } from './ocean.js';
import { THROW_ANIM, SPLASH_TIME, THROW_HEIGHT, ringRelation } from './mob.js';
import { MOB_DEMO_STEPS, buildMobTrack, sampleMobTrack, stepAt } from './mob-drill.js';

const NARRATION_WAIT = 8; // s — longest hold at a step boundary for a slow voice
const TRAIL_STRIDE = 3;   // samples per trail vertex
const $ = (id) => document.getElementById(id);
const dir = (h) => new THREE.Vector3(-Math.sin(h), 0, Math.cos(h));   // Boat.forward()
const side = (h) => new THREE.Vector3(-Math.cos(h), 0, -Math.sin(h)); // Boat.starboard()

function trailLine(track, material) {
  const pts = [];
  for (let i = 0; i < track.samples.length; i += TRAIL_STRIDE) {
    const s = track.samples[i];
    pts.push(new THREE.Vector3(s.x, 0.25, s.z));
  }
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), material);
  line.renderOrder = 2;
  line.frustumCulled = false;
  return line;
}

export class MobDemo {
  constructor({ scene, view, env, coast, streaks, camera, voice }) {
    Object.assign(this, { scene, view, env, coast, streaks, camera, voice });
    this.track = buildMobTrack();
    this.boat = new Boat();
    this.wind = new Wind(this.track.wind.dirFrom, this.track.wind.speed);
    this.wind.gustiness = 0;
    this.wind.shiftiness = 0;
    this.ring = makeLifeRing();
    // The whole route, faint, so the shape of the maneuver reads at a glance;
    // the sailed part is drawn over it as the yacht goes.
    this.planned = trailLine(this.track, new THREE.LineDashedMaterial({
      color: 0xffffff, dashSize: 1.6, gapSize: 1.1, transparent: true, opacity: 0.45, depthWrite: false,
    }));
    this.planned.computeLineDistances();
    this.sailed = trailLine(this.track, new THREE.LineBasicMaterial({
      color: 0xffb14f, transparent: true, opacity: 0.95, depthWrite: false,
    }));
    this.finalHeading = this.track.samples[this.track.samples.length - 1].h;
    this.camPos = new THREE.Vector3();
    this.camLook = new THREE.Vector3();
    this.active = false;
    this.t = 0;
    this.rate = 1;
    this.paused = false;
    this.finished = false;
    this.spokenStep = -1;
    this.held = 0;
    this.shownStep = -1;
    this.viewShift = null;
    this.visible = { w: camera.aspect, h: 1 };
  }

  // Called from a click handler, so the first utterance has user activation.
  start({ reducedMotion = false } = {}) {
    this.active = true;
    this.coast.setLocation('tel-aviv');
    this.env.setSeaState('calm');
    this.scene.add(this.ring, this.planned, this.sailed);
    this.paused = reducedMotion;
    this.seek(0);
  }

  stop() {
    if (!this.active) return;
    this.active = false;
    this.voice.cancel();
    this.scene.remove(this.ring, this.planned, this.sailed);
    this.view.setCrewPose('idle');
    this.camera.clearViewOffset();
    this.viewShift = null;
  }

  seek(step) {
    this.t = this.track.stepStarts[step] ?? 0;
    this.finished = false;
    this.rate = 1;
    this.held = 0;
    this.spokenStep = -1;
    this.voice.cancel();
    if (!this.paused) this._narrate(step);
    this._settleBoat();
    this._frame(0, true);
  }

  replay() {
    this.paused = false;
    this.seek(0);
  }

  togglePause() {
    if (this.finished) return this.replay();
    this.paused = !this.paused;
    // Restart the step's line on resume rather than trusting pause/resume,
    // which several mobile speech engines ignore.
    this.voice.cancel();
    this.spokenStep = -1;
    if (!this.paused) this._narrate(stepAt(this.track, this.t));
    this._renderUi(true);
  }

  toggleVoice() {
    this.voice.setEnabled(!this.voice.enabled);
    this.spokenStep = -1;
    if (!this.paused && !this.finished) this._narrate(stepAt(this.track, this.t));
    this._renderUi(true);
  }

  update(dt) {
    if (!this.active) return;
    if (!this.paused && !this.finished) this._advance(dt);
    this._frame(this.paused ? 0 : dt, false);
  }

  // ---------------------------------------------------------------- Timing
  _narrate(step) {
    this.spokenStep = step;
    this.held = 0;
    this.voice.speak(MOB_DEMO_STEPS[step].say);
  }

  _advance(dt) {
    const tr = this.track;
    const step = stepAt(tr, this.t);
    if (this.spokenStep !== step) this._narrate(step);
    // Let each line finish before the yacht starts the next step: ease into
    // slow motion near the boundary and hold there until the voice is done.
    const next = tr.stepStarts[step + 1] ?? Infinity;
    const talking = this.voice.speaking && this.held < NARRATION_WAIT;
    const target = !talking ? 1 : this.t >= next - 0.05 ? 0 : this.t > next - 1.5 ? 0.35 : 1;
    this.rate += (target - this.rate) * Math.min(1, 4 * dt);
    if (talking && this.t >= next - 0.05) this.held += dt;
    let t = this.t + dt * this.rate;
    if (talking && t >= next) t = next - 0.01;
    this.t = Math.min(t, tr.duration);
    if (this.t >= tr.duration) this.finished = true;
  }

  // Boom and heel carry state; settle them after a jump so a seek doesn't
  // show the sail swinging across from the previous position.
  _settleBoat() {
    const p = sampleMobTrack(this.track, this.t);
    const b = this.boat;
    b.boom = 0; b.heel = 0; b.latVel = 0; b.yawRate = 0;
    b.sheet = p.luff ? SHEET_MAX : 45 * DEG;
    for (let i = 0; i < 90; i++) this._poseBoat(p, 1 / 30);
  }

  _poseBoat(p, dt) {
    const b = this.boat;
    b.autoTrim = !p.luff;
    if (p.luff) b.sheet = SHEET_MAX;
    b.rudder = clamp(p.turn / (20 * DEG), -1, 1) * 0.7;
    b.heading = p.h;
    b.speed = p.v;
    b.update(dt, this.wind); // boom, heel, luffing, AWA for the visuals
    b.pos.x = p.x;
    b.pos.z = p.z;
    b.heading = p.h;
    b.speed = p.v;
    b.latVel = 0;
  }

  // ---------------------------------------------------------------- Frame
  _frame(dt, snap) {
    const tr = this.track;
    const p = sampleMobTrack(tr, this.t);
    const visualDt = dt * this.rate;
    this._poseBoat(p, visualDt);
    const b = this.boat;
    const envTime = this.env.time;

    // Lifebuoy: arcs down from deck height, then bobs where it landed.
    const since = this.t - tr.releaseAt;
    this.ring.visible = since >= 0;
    if (this.ring.visible) {
      this.ring.position.set(tr.ring.x, 0, tr.ring.z);
      bobLifeRing(this.ring, envTime);
      if (since < SPLASH_TIME) {
        const k = since / SPLASH_TIME;
        this.ring.position.y += THROW_HEIGHT * (1 - k) * (1 - k);
      }
    }

    // Crew: throw, then point at the ring for the rest of the maneuver.
    if (this.t < tr.throwAt) this.view.setCrewPose('idle');
    else if (this.t < tr.releaseAt + 0.3) this.view.setCrewPose('throw', (this.t - tr.throwAt) / THROW_ANIM);
    else this.view.setCrewPose('point', ringRelation(b, tr.ring, this.wind.dirFrom).ringRelBearing);

    this.sailed.geometry.setDrawRange(0, Math.floor(this.t / tr.dt / TRAIL_STRIDE) + 1);

    this.view.update(visualDt, b, this.wind, envTime);
    this._camera(dt, p, snap);
    this.env.update(dt, this.camera, b.pos);
    this.streaks.update(dt, this.wind, b.pos, envTime);
    this._renderUi(false);
  }

  _camera(dt, p, snap) {
    this._shiftView();
    const tr = this.track;
    const step = stepAt(tr, this.t);
    const boat = new THREE.Vector3(p.x, 0, p.z);
    const ring = new THREE.Vector3(tr.ring.x, 0, tr.ring.z);
    // What the uncovered part of the screen sees, as tangents of its half
    // angles; narrow (portrait) views stand further off to keep the subject in.
    const tanFull = Math.tan(this.camera.fov * DEG / 2);
    const tanH = tanFull * this.visible.w, tanV = tanFull * this.visible.h;
    const back = clamp(0.6 * tanFull / Math.min(tanH, tanV), 1, 2.2);
    let want, look;
    if (step === 0) {
      // Low off the leeward quarter, where the ring goes over the side.
      const f = dir(p.h), stb = side(p.h);
      want = boat.clone().addScaledVector(f, -20 * back).addScaledVector(stb, 11 * back).setY(10 * back);
      look = boat.clone().addScaledVector(f, -1).setY(1.2);
    } else if (step <= 3) {
      // High overview fitting yacht and ring in view, upwind (north) at the top.
      const mid = boat.clone().add(ring).multiplyScalar(0.5);
      const reach = boat.distanceTo(ring) / 2 + 14;
      const h = reach / Math.min(tanH, tanV) / 1.14; // camera range ≈ 1.14 h
      want = mid.clone().setY(h).add(new THREE.Vector3(0, 0, -h * 0.55));
      look = mid;
    } else {
      // Behind and to windward of the approach, so the ring shows off the
      // windward bow and the sails (to leeward) stay out of the way.
      const f = dir(this.finalHeading), stb = side(this.finalHeading);
      want = boat.clone().addScaledVector(f, -15 * back).addScaledVector(stb, 7 * back).setY(7 * back);
      look = boat.clone().add(ring).multiplyScalar(0.5).setY(1);
    }
    if (snap) {
      this.camPos.copy(want);
      this.camLook.copy(look);
    } else {
      const k = 1 - Math.exp(-1.6 * dt);
      this.camPos.lerp(want, k);
      this.camLook.lerp(look, k);
    }
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);
  }

  // Centre the shot in the sea the card leaves uncovered: right of the side
  // card on desktop, above the bottom sheet on phones.
  _shiftView() {
    const card = document.getElementById('introContent')?.getBoundingClientRect();
    const w = innerWidth, h = innerHeight;
    let dx = 0, dy = 0;
    this.visible = { w: w / h, h: 1 }; // uncovered size, in screen heights
    if (card && card.width) {
      if (card.top > h * 0.3) {
        dy = Math.round((h - card.top) / 2);
        this.visible.h = card.top / h;
      } else if (card.right < w * 0.7) {
        dx = Math.round(card.right / 2);
        this.visible.w = (w - card.right) / h;
      }
    }
    const key = `${w}x${h}:${dx},${dy}`;
    if (key === this.viewShift) return;
    this.viewShift = key;
    if (dx || dy) this.camera.setViewOffset(w, h, -dx, dy, w, h);
    else this.camera.clearViewOffset();
  }

  // ------------------------------------------------------------------- UI
  _renderUi(force) {
    const step = stepAt(this.track, this.t);
    const bar = $('mobDemoBar');
    if (bar) bar.style.width = `${(100 * this.t / this.track.duration).toFixed(1)}%`;
    if (step !== this.shownStep || force) {
      this.shownStep = step;
      document.querySelectorAll('#mobDemoSteps li').forEach((li, i) => {
        li.classList.toggle('active', i === step);
        li.classList.toggle('done', i < step || (this.finished && i === step));
        li.querySelector('button')?.setAttribute('aria-current', i === step ? 'step' : 'false');
      });
      const caption = $('mobDemoCaption');
      if (caption) caption.innerHTML = MOB_DEMO_STEPS[step].caption;
    }
    const pause = $('mobDemoPause');
    const label = this.finished ? 'Play again' : this.paused ? 'Play' : 'Pause';
    if (pause && pause.textContent !== label) pause.textContent = label;
    const voice = $('mobDemoVoice');
    if (voice) {
      voice.hidden = !this.voice.available;
      const text = this.voice.enabled ? '🔊 Voice on' : '🔇 Voice off';
      if (voice.textContent !== text) voice.textContent = text;
      voice.setAttribute('aria-pressed', String(this.voice.enabled));
    }
  }
}
