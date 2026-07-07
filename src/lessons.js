// lessons.js — runs curriculum items: LEARN lessons (coached, step by step)
// and EXAM tests (goal only, pass/fail). Data lives in curriculum.js.
import { DEG, wrapPi } from './physics.js';
import { makeBuoy, bobBuoy, bobLifeRing } from './ocean.js';
import { LESSONS, TESTS, byId } from './curriculum.js';
import { MobController } from './mob.js';

const PROGRESS_KEY = 'sail.progress.v2';

export class LessonManager {
  constructor(scene, hud, view) {
    this.scene = scene;
    this.hud = hud;
    this.view = view;
    this.buoys = [];
    this.current = LESSONS[0];
    this.stepIdx = 0;
    this.markIdx = 0;
    this.ctx = {};
    this.completed = false;
    this.failed = false;
    this.raceTime = 0;
    this.mobCtl = null;
    this.reviewTarget = null;

    // Progress = set of completed item ids. Migrates the old linear
    // 'sail.unlocked' index (lessons 0..N-1 done) into ids once.
    let stored = null;
    try { stored = JSON.parse(localStorage.getItem(PROGRESS_KEY) || 'null'); } catch { /* reset */ }
    if (!stored) {
      const old = Number(localStorage.getItem('sail.unlocked') || 0);
      stored = { done: ['course', 'upwind', 'tack', 'gybe'].slice(0, Math.min(old, 4)) };
      localStorage.setItem(PROGRESS_KEY, JSON.stringify(stored));
    }
    this.progress = new Set(stored.done || []);

    this.panelTitle = document.getElementById('lessonTitle');
    this.panelBrief = document.getElementById('lessonBrief');
    this.panelStep = document.getElementById('lessonStep');
    this.markInfo = document.getElementById('markInfo');
    this.overlay = document.getElementById('completeOverlay');
    this.overlayText = document.getElementById('completeText');
    this.nextBtn = document.getElementById('nextLessonBtn');
    this.failOverlay = document.getElementById('failOverlay');
    this.failText = document.getElementById('failText');
    this.reviewBtn = document.getElementById('reviewBtn');
    this.raceClock = document.getElementById('raceClock');
  }

  lesson() { return this.current; }

  isUnlocked(item) {
    if (item.free) return true;
    if (item.type === 'test') return (item.requires || []).every((id) => this.progress.has(id));
    const i = LESSONS.indexOf(item);
    return i <= 0 || this.progress.has(LESSONS[i - 1].id);
  }

  nextTarget() { return this.current.next ? byId(this.current.next) : null; }

  start(itemOrId, boat, wind) {
    const L = typeof itemOrId === 'string' ? byId(itemOrId) : itemOrId;
    if (!L) return;
    this.current = L;
    this.stepIdx = 0;
    this.markIdx = 0;
    this.ctx = {
      t: 0, timeInNoGo: 0, tacked: false, gybed: false, tackCount: 0, gybeCount: 0,
      prevTwaSign: 0, ironsTime: 0, onCourseTime: 0, stoppedFor: 0,
      distToMark: Infinity, marksDone: false, mob: { thrown: false },
    };
    this.completed = false;
    this.failed = false;
    this.raceTime = 0;
    this.overlay.classList.remove('show');
    this.failOverlay.classList.remove('show');

    // Tests run in exam mode: no trim bar, no tips, no status badge.
    this.hud.setMode(L.type === 'test' ? 'exam' : 'full');

    // World state
    wind.baseDirFrom = L.wind.dirFrom;
    wind.baseSpeed = L.wind.speed;
    wind.gustiness = L.wind.gustiness ?? (L.wind.live ? 0.18 : 0.10);
    wind.shiftiness = (L.wind.shiftiness ?? (L.wind.live ? 7 : 2.5)) * DEG;
    boat.pos.x = L.boat.x; boat.pos.z = L.boat.z;
    boat.heading = L.boat.heading;
    boat.speed = 1.2; boat.latVel = 0; boat.heel = 0; boat.yawRate = 0;
    boat.sheet = L.boat.sheet; boat.boom = 0; boat.rudder = 0;

    // Buoys
    for (const b of this.buoys) this.scene.remove(b);
    this.buoys = L.marks.map((m) => {
      const buoy = makeBuoy();
      buoy.position.set(m.x, 0, m.z);
      this.scene.add(buoy);
      return buoy;
    });

    // Man-overboard rig
    if (this.mobCtl) this.mobCtl.dispose();
    this.mobCtl = L.mob ? new MobController(this.scene, this.view, L.mob) : null;

    // UI
    this.panelTitle.innerHTML = L.type === 'test'
      ? `${L.title}<span class="exampill">EXAM</span>` : L.title;
    this.panelBrief.innerHTML = L.brief;
    this._showStep();
    this.markInfo.textContent = '';
    this.raceClock.style.display = L.timed ? 'block' : 'none';
    document.getElementById('windPanel').classList.toggle('show', !!L.free);
    this._syncPickers();
  }

  _showStep() {
    const L = this.current;
    const s = L.steps[this.stepIdx];
    this.panelStep.innerHTML = s ? s.text :
      (L.stepHint ?? (L.free ? 'Sail anywhere. Try every point of sail.' : 'Head for the glowing ring.'));
  }

  _syncPickers() {
    const sync = (sel, items) =>
      document.querySelectorAll(sel).forEach((btn, j) => {
        const item = items[j];
        if (!item) return;
        btn.classList.toggle('active', item === this.current);
        btn.classList.toggle('locked', !this.isUnlocked(item));
        btn.classList.toggle('done', this.progress.has(item.id) && !item.free);
      });
    sync('#lessonPicker button', LESSONS);
    sync('#testPicker button', TESTS);
  }

  update(dt, boat, wind, envTime, advisory = null) {
    const L = this.current;

    // Buoy animation + guidance
    this.buoys.forEach((b, i) => {
      bobBuoy(b, envTime, wind.dirFrom);
      b.userData.ring.visible = i === this.markIdx && !this.completed;
    });

    if (this.completed || this.failed) {
      // World is frozen for scoring; keep the lifebuoy bobbing for looks.
      if (this.mobCtl && this.mobCtl.ring) bobLifeRing(this.mobCtl.ring, envTime);
      return;
    }

    // ---- Context tracking for predicates --------------------------------
    const ctx = this.ctx;
    ctx.t += dt;
    const twaSign = Math.sign(boat.twa) || ctx.prevTwaSign;
    if (Math.abs(boat.twa) < 32 * DEG) ctx.timeInNoGo += dt;
    if (ctx.prevTwaSign && twaSign !== ctx.prevTwaSign) {
      // crossed the wind — bow (tack) or stern (gybe)?
      if (Math.abs(boat.twa) < 90 * DEG && boat.speed > 0.8) { ctx.tacked = true; ctx.tackCount++; }
      if (Math.abs(boat.twa) > 90 * DEG) { ctx.gybed = true; ctx.gybeCount++; }
    }
    ctx.prevTwaSign = twaSign;
    ctx.ironsTime = boat.inIrons ? ctx.ironsTime + dt : 0;
    ctx.stoppedFor = Math.abs(boat.speed) < 0.5 ? ctx.stoppedFor + dt : 0;

    if (this.mobCtl) this.mobCtl.update(dt, boat, wind, envTime, ctx);

    // ---- Distance/bearing to active mark --------------------------------
    if (this.markIdx < L.marks.length) {
      const m = L.marks[this.markIdx];
      const dx = m.x - boat.pos.x, dz = m.z - boat.pos.z;
      const dist = Math.hypot(dx, dz);
      ctx.distToMark = dist;
      // Compass bearing of (dx, dz): angle a maps to (-sin a, cos a).
      const brg = ((Math.atan2(-dx, dz) / DEG) % 360 + 360) % 360;
      const rel = wrapPi(Math.atan2(-dx, dz) - boat.heading);
      const side = Math.abs(rel) < 12 * DEG ? 'ahead' : (rel > 0 ? '→ to starboard' : '← to port');
      this.markInfo.textContent =
        `Mark ${this.markIdx + 1}/${L.marks.length} · ${Math.round(dist)} m · brg ${String(Math.round(brg)).padStart(3, '0')}° ${side}`;
      ctx.onCourseTime = Math.abs(rel) < 15 * DEG && boat.speed > 1.0 ? ctx.onCourseTime + dt : 0;
      if (dist < 13) {
        this.markIdx++;
        if (this.markIdx >= L.marks.length) {
          ctx.marksDone = true;
          if (!L.pass) return this._complete();
        }
      }
    } else if (!L.marks.length) {
      if (ctx.mob.thrown) {
        const m = ctx.mob;
        const brg = ((boat.heading + m.ringRelBearing) / DEG % 360 + 360) % 360;
        const side = Math.abs(m.ringRelBearing) < 12 * DEG ? 'ahead'
          : (m.ringRelBearing > 0 ? '→ to starboard' : '← to port');
        this.markInfo.textContent =
          `🛟 RING · ${Math.round(m.ringDist)} m · brg ${String(Math.round(brg)).padStart(3, '0')}° ${side} · ` +
          (m.ringWindward ? 'TO WINDWARD' : 'TO LEEWARD');
      } else if (advisory) this.markInfo.innerHTML = advisory.text;
      else this.markInfo.textContent = L.free ? 'Free sailing — watch for the tan yacht (Rule 12)' : '';
    }

    // ---- Pass / fail -----------------------------------------------------
    if (L.pass && L.pass(boat, ctx)) return this._complete();
    let reason = L.fail ? L.fail(boat, ctx) : null;
    if (!reason && L.timeLimit && ctx.t > L.timeLimit) {
      reason = L.timeLimitMsg || `Time limit exceeded (${fmtTime(L.timeLimit)}).`;
    }
    if (reason) return this._fail(reason);

    // ---- Step advancement (lessons) -------------------------------------
    const s = L.steps[this.stepIdx];
    if (s && s.done(boat, ctx)) {
      this.stepIdx = Math.min(this.stepIdx + 1, L.steps.length - 1);
      if (L.steps[this.stepIdx] !== s) {
        // a maneuver must happen AFTER its step is shown to count
        ctx.tacked = false;
        ctx.gybed = false;
        this._showStep();
      }
    }
    if (L.timed) {
      this.raceTime += dt;
      this.raceClock.textContent = fmtTime(this.raceTime);
    }

    // Live coaching is for the classroom, not the exam.
    if (L.type !== 'test') this._tips(boat, advisory);
  }

  _tips(boat, advisory = null) {
    // Live coaching (priority order). The status badge covers the raw state;
    // these explain WHY and WHAT TO DO.
    const hud = this.hud;
    const mob = this.ctx.mob;
    if (boat.inIrons && mob && mob.thrown && mob.ringDist < 15 && mob.ringWindward) {
      hud.setTip('🛟 Head-to-wind next to the ring — perfect place to stop. Hold it and let the boat settle.', 'mobstop');
    } else if (boat.inIrons) {
      hud.setTip('⚓ <b>In irons.</b> Head-to-wind with no speed: sails can’t fill. Hold the rudder over, let the bow fall off ~50°, then sheet in.', 'irons');
    } else if (advisory && advisory.urgent) {
      hud.setTip(advisory.text, 'colreg');
    } else if (boat.byTheLee) {
      hud.setTip('⚠️ <b>Sailing by the lee</b> — the wind is creeping behind the boom. Head up a touch or gybe deliberately before the boom does it for you.', 'lee');
    } else if (mob && mob.thrown && mob.ringDist < 30 && Math.abs(boat.speed) > 1.5) {
      hud.setTip('🛟 Closing on the ring with way on — <b>ease the sheet right out</b> and let the sail luff to brake.', 'mobslow');
    } else if (boat.luffing && Math.abs(boat.twa) > 35 * DEG && !(mob && mob.thrown && mob.ringDist < 30)) {
      hud.setTip('💨 Sail is <b>luffing</b> — it’s a flag, not a wing. Sheet in (<kbd>↑</kbd>) until it fills.', 'luff');
    } else if (boat.stalled) {
      hud.setTip('🛑 Sail is <b>stalled</b> — strapped in too tight for this angle. Ease out (<kbd>↓</kbd>) and feel the boat stand up and speed on.', 'stall');
    } else if (Math.abs(boat.heel) > 30 * DEG) {
      hud.setTip('⛵ <b>Too much heel</b> slows you down. Ease the sheet or head up slightly to depower.', 'heel');
    } else if (boat.efficiency > 0.9 && boat.speed > 1.5) {
      hud.setTip('✅ <b>Perfect trim.</b> Feel that? Speed comes from the green band, not from muscle.', 'good');
    } else {
      hud.setTip('Trim to the <b>orange</b> apparent-wind arrow. Green band on the mainsheet bar = maximum drive.', 'idle');
    }
  }

  _complete() {
    this.completed = true;
    const L = this.current;
    if (!L.free && !this.progress.has(L.id)) {
      this.progress.add(L.id);
      localStorage.setItem(PROGRESS_KEY, JSON.stringify({ done: [...this.progress] }));
    }
    const time = L.timed ? `<div class="raceResult">Course time: <b>${fmtTime(this.raceTime)}</b></div>` : '';
    const head = L.type === 'test' ? `✔ PASSED · ${L.title}` : `✔ ${L.title} — complete`;
    this.overlayText.innerHTML = `<h2>${head}</h2>${time}<p>${L.takeaway}</p>`;
    const next = this.nextTarget();
    this.nextBtn.textContent = next ? `Next: ${shortTitle(next)} ⏎` : 'Free sail ⏎';
    this.overlay.classList.add('show');
    this._syncPickers();
  }

  _fail(reason) {
    this.failed = true;
    const L = this.current;
    this.failText.innerHTML =
      `<h2>✘ ${L.title} — not passed</h2><p class="failreason">${reason}</p>` +
      `<p>Retake whenever you're ready${L.requires ? ' — or go back over the lesson first' : ''}.</p>`;
    this.reviewTarget = L.review || (L.requires && L.requires[0]) || null;
    this.reviewBtn.style.display = this.reviewTarget ? '' : 'none';
    this.failOverlay.classList.add('show');
  }
}

function shortTitle(item) {
  // 'Lesson 3 · Tacking · מהפך' → 'Tacking · מהפך'; tests keep 'Test N' prefix off too.
  const parts = item.title.split('·');
  return parts.length > 1 ? parts.slice(1).join('·').trim() : item.title;
}

function fmtTime(t) {
  const m = Math.floor(t / 60), s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}
