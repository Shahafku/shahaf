// lessons.js — guided curriculum: from "what is wind" to a full course race
import { DEG, KNOTS, wrapPi } from './physics.js';
import { makeBuoy, bobBuoy } from './ocean.js';

// Wind blows FROM +Z ("north" on the HUD) in every lesson, so upwind = +Z.
export const LESSONS = [
  {
    id: 'reach',
    title: 'Lesson 1 · Feel the Wind',
    brief:
      'Wind pushes <b>across</b> the boat on a <b>beam reach</b> — the easiest, fastest point of sail. ' +
      'Sails work like wings: trim them to the <b>orange APP arrow</b> (apparent wind), not the blue one.',
    wind: { dirFrom: 0, speed: 6.2 },
    boat: { x: 0, z: 0, heading: 90 * DEG, sheet: 80 * DEG },
    marks: [{ x: 260, z: 10 }],
    steps: [
      {
        text: 'Your sail is flapping (<b>luffing</b>) — it makes no power. Press <kbd>W</kbd>/<kbd>↑</kbd> to sheet in until it fills and the trim bar turns green.',
        done: (b) => b.efficiency > 0.7 && b.speed > 1.2,
      },
      {
        text: 'Trim looks good! Steer with <kbd>A</kbd>/<kbd>D</kbd> toward the glowing ring. Watch the speed climb.',
        done: (b, ctx) => ctx.distToMark < 120,
      },
      { text: 'Sail through the ring to finish.', done: () => false },
    ],
    takeaway:
      'Rule one of trim: <b>“When in doubt, let it out”</b> — ease until the sail luffs, then sheet back in until it stops. The green band on the trim bar is that sweet spot.',
  },
  {
    id: 'nogo',
    title: 'Lesson 2 · The No-Go Zone',
    brief:
      'The buoy is <b>dead upwind</b>. Try pointing straight at it — and watch what the wind does to your sails. ' +
      'The red wedge on the wind rose marks the <b>no-go zone</b>.',
    wind: { dirFrom: 0, speed: 6.2 },
    boat: { x: 0, z: 0, heading: 60 * DEG, sheet: 40 * DEG },
    marks: [{ x: 0, z: 300 }],
    steps: [
      {
        text: 'Turn the bow straight toward the buoy (dead upwind) and see what happens…',
        done: (b, ctx) => (ctx.timeInNoGo ?? 0) > 2.5,
      },
      {
        text: '<b>You’re in irons!</b> Sails can’t work within ~35° of the wind. Bear away (turn ~50° off the wind), sheet in, and rebuild speed.',
        done: (b) => b.speed > 2.0 && Math.abs(b.twa) > 33 * DEG && Math.abs(b.twa) < 75 * DEG,
      },
      {
        text: 'This angle is <b>close-hauled</b> — as close to the wind as a yacht can sail. Zigzag upwind: hold this angle, and turn through the wind (<b>tack</b>) when the buoy is far to one side.',
        done: () => false,
      },
    ],
    takeaway:
      'No boat can sail straight upwind. Progress to windward is a zigzag of close-hauled legs called <b>beating</b>. If you stall head-to-wind (“in irons”), the boat drifts backwards until you fall off and refill the sails.',
  },
  {
    id: 'tack',
    title: 'Lesson 3 · Tacking',
    brief:
      'A <b>tack</b> turns the bow through the wind onto the other close-hauled course. ' +
      '<b>Speed is the fuel</b> that carries you through the no-go zone — never tack slow.',
    wind: { dirFrom: 0, speed: 6.6 },
    boat: { x: 60, z: 0, heading: 40 * DEG, sheet: 12 * DEG },
    marks: [
      { x: -90, z: 170 },
      { x: 90, z: 340 },
      { x: 0, z: 500 },
    ],
    steps: [
      {
        text: 'Get close-hauled on <b>port tack</b> (wind over the left side) and build speed above 4.5 kn.',
        done: (b) => b.speed * KNOTS > 4.5 && Math.abs(b.twa) < 60 * DEG,
      },
      {
        text: 'Now <b>tack</b>: turn briskly through the wind until the sails fill on the other side (~45° past head-to-wind). Keep the turn smooth — a slammed rudder is a brake.',
        done: (b, ctx) => ctx.tacked === true,
      },
      {
        text: 'Clean tack! Round each ring in order — every crossing needs another tack. Starboard tack (wind from the right) has <b>right of way</b> under COLREGs Rule 12.',
        done: () => false,
      },
    ],
    takeaway:
      'Tack recipe: <b>speed → smooth helm → cross the eye of the wind → fill on the new side → trim & accelerate</b>. Too slow into the turn = stuck in irons.',
  },
  {
    id: 'gybe',
    title: 'Lesson 4 · Downwind & the Gybe',
    brief:
      'Downwind the sail becomes a <b>parachute</b> — ease it right out. To change sides with the wind astern you <b>gybe</b>: the stern crosses the wind and the boom sweeps across. On a real boat, an uncontrolled boom is dangerous — control it with the sheet.',
    wind: { dirFrom: 0, speed: 6.6 },
    boat: { x: 0, z: 320, heading: 170 * DEG, sheet: 30 * DEG },
    marks: [
      { x: -110, z: 120 },
      { x: 110, z: -60 },
      { x: 0, z: -220 },
    ],
    steps: [
      {
        text: 'Bear away onto a <b>broad reach</b> (wind over the quarter, ~130–150°) and ease the sheet way out with <kbd>S</kbd>/<kbd>↓</kbd>.',
        done: (b) => Math.abs(b.twa) > 115 * DEG && b.efficiency > 0.55,
      },
      {
        text: 'To gybe safely: <b>sheet in first</b>, turn the stern through the wind, then ease out on the new side. Watch the boom cross. Avoid sailing <b>by the lee</b> (wind sneaking behind the boom) — that invites an accidental gybe.',
        done: (b, ctx) => ctx.gybed === true,
      },
      { text: 'Gybed! Run the rings down to the finish.', done: () => false },
    ],
    takeaway:
      'Tack = bow through the wind (upwind). <b>Gybe = stern through the wind</b> (downwind) — always under control: sheet in, turn, ease out. Dead-downwind “by the lee” is the accidental-gybe danger zone.',
  },
  {
    id: 'race',
    title: 'Lesson 5 · Round the Course',
    brief:
      'Everything together: a classic triangle. <b>Beat</b> upwind to the windward mark, <b>reach</b> across, <b>run</b> home. ' +
      'Pick your tacks wisely and keep the trim bar green — the clock is running.',
    wind: { dirFrom: 0, speed: 7.2 },
    boat: { x: 0, z: 0, heading: 45 * DEG, sheet: 14 * DEG },
    marks: [
      { x: 0, z: 420 },
      { x: 300, z: 120 },
      { x: 0, z: -60 },
    ],
    steps: [
      {
        text: 'Race is on! Windward mark first — remember: zigzag, tack on the edges, keep speed through every turn.',
        done: () => false,
      },
    ],
    timed: true,
    takeaway:
      'You beat, reached and ran — every point of sail in one course. A faster lap = better tacks, better trim, better angles. That’s yacht racing.',
  },
  {
    id: 'free',
    title: 'Free Sail',
    brief:
      'Open water. Change wind strength and direction from the WIND panel and feel how the boat answers on every point of sail. Gusts and shifts are live — watch the apparent wind move.',
    wind: { dirFrom: 0, speed: 6.5, live: true },
    boat: { x: 0, z: 0, heading: 90 * DEG, sheet: 45 * DEG },
    marks: [],
    steps: [],
    free: true,
    takeaway: '',
  },
];

export class LessonManager {
  constructor(scene, hud) {
    this.scene = scene;
    this.hud = hud;
    this.buoys = [];
    this.index = 0;
    this.stepIdx = 0;
    this.markIdx = 0;
    this.ctx = {};
    this.completed = false;
    this.raceTime = 0;
    this.unlocked = Number(localStorage.getItem('sail.unlocked') || 0);

    this.panelTitle = document.getElementById('lessonTitle');
    this.panelBrief = document.getElementById('lessonBrief');
    this.panelStep = document.getElementById('lessonStep');
    this.markInfo = document.getElementById('markInfo');
    this.overlay = document.getElementById('completeOverlay');
    this.overlayText = document.getElementById('completeText');
    this.raceClock = document.getElementById('raceClock');
  }

  lesson() { return LESSONS[this.index]; }

  start(i, boat, wind) {
    this.index = Math.max(0, Math.min(LESSONS.length - 1, i));
    const L = this.lesson();
    this.stepIdx = 0;
    this.markIdx = 0;
    this.ctx = { timeInNoGo: 0, tacked: false, gybed: false, prevTwaSign: 0, prevBoomSign: 0 };
    this.completed = false;
    this.raceTime = 0;
    this.overlay.classList.remove('show');

    // World state
    wind.baseDirFrom = L.wind.dirFrom;
    wind.baseSpeed = L.wind.speed;
    wind.gustiness = L.wind.live ? 0.18 : 0.10;
    wind.shiftiness = (L.wind.live ? 7 : 2.5) * DEG;
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

    // UI
    this.panelTitle.textContent = L.title;
    this.panelBrief.innerHTML = L.brief;
    this._showStep();
    this.raceClock.style.display = L.timed ? 'block' : 'none';
    document.getElementById('windPanel').classList.toggle('show', !!L.free);
    document.querySelectorAll('#lessonPicker button').forEach((btn, j) => {
      btn.classList.toggle('active', j === this.index);
      btn.classList.toggle('locked', j > this.unlocked && !LESSONS[j].free);
    });
  }

  _showStep() {
    const L = this.lesson();
    const s = L.steps[this.stepIdx];
    this.panelStep.innerHTML = s ? s.text : (L.free ? 'Sail anywhere. Try every point of sail.' : 'Head for the glowing ring.');
  }

  update(dt, boat, wind, envTime) {
    const L = this.lesson();

    // Buoy animation + guidance
    this.buoys.forEach((b, i) => {
      bobBuoy(b, envTime, wind.dirFrom);
      const isTarget = i === this.markIdx && !this.completed;
      b.userData.ring.visible = isTarget;
    });

    // Context tracking for step predicates
    const twaSign = Math.sign(boat.twa) || this.ctx.prevTwaSign;
    if (Math.abs(boat.twa) < 32 * DEG) this.ctx.timeInNoGo = (this.ctx.timeInNoGo || 0) + dt;
    if (this.ctx.prevTwaSign && twaSign !== this.ctx.prevTwaSign) {
      // crossed the wind — bow or stern?
      if (Math.abs(boat.twa) < 90 * DEG && boat.speed > 0.8) this.ctx.tacked = true;
      if (Math.abs(boat.twa) > 90 * DEG) this.ctx.gybed = true;
    }
    this.ctx.prevTwaSign = twaSign;

    // Distance/bearing to active mark
    if (this.markIdx < L.marks.length) {
      const m = L.marks[this.markIdx];
      const dx = m.x - boat.pos.x, dz = m.z - boat.pos.z;
      const dist = Math.hypot(dx, dz);
      this.ctx.distToMark = dist;
      const brg = ((Math.atan2(dx, dz) / DEG) % 360 + 360) % 360;
      const rel = wrapPi(Math.atan2(dx, dz) - boat.heading);
      const side = Math.abs(rel) < 12 * DEG ? 'ahead' : (rel > 0 ? '→ to starboard' : '← to port');
      this.markInfo.textContent =
        `Mark ${this.markIdx + 1}/${L.marks.length} · ${Math.round(dist)} m · brg ${String(Math.round(brg)).padStart(3, '0')}° ${side}`;
      if (dist < 13 && !this.completed) {
        this.markIdx++;
        if (this.markIdx >= L.marks.length) this._complete();
      }
    } else if (!L.marks.length) {
      this.markInfo.textContent = L.free ? 'Free sailing — no marks' : '';
    }

    // Step advancement
    if (!this.completed) {
      const s = L.steps[this.stepIdx];
      if (s && s.done(boat, this.ctx)) {
        this.stepIdx = Math.min(this.stepIdx + 1, L.steps.length - 1);
        if (L.steps[this.stepIdx] !== s) {
          // a maneuver must happen AFTER its step is shown to count
          this.ctx.tacked = false;
          this.ctx.gybed = false;
          this._showStep();
        }
      }
      if (L.timed) {
        this.raceTime += dt;
        this.raceClock.textContent = fmtTime(this.raceTime);
      }
    }

    this._tips(boat);
  }

  _tips(boat) {
    // Live coaching (priority order). The status badge covers the raw state;
    // these explain WHY and WHAT TO DO.
    const hud = this.hud;
    if (boat.inIrons) {
      hud.setTip('⚓ <b>In irons.</b> Head-to-wind with no speed: sails can’t fill. Hold the rudder over, let the bow fall off ~50°, then sheet in.', 'irons');
    } else if (boat.byTheLee) {
      hud.setTip('⚠️ <b>Sailing by the lee</b> — the wind is creeping behind the boom. Head up a touch or gybe deliberately before the boom does it for you.', 'lee');
    } else if (boat.luffing && Math.abs(boat.twa) > 35 * DEG) {
      hud.setTip('💨 Sail is <b>luffing</b> — it’s a flag, not a wing. Sheet in (<kbd>W</kbd>/<kbd>↑</kbd>) until it fills.', 'luff');
    } else if (boat.stalled) {
      hud.setTip('🛑 Sail is <b>stalled</b> — strapped in too tight for this angle. Ease out (<kbd>S</kbd>/<kbd>↓</kbd>) and feel the boat stand up and speed on.', 'stall');
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
    const L = this.lesson();
    if (this.index >= this.unlocked && this.index + 1 < LESSONS.length) {
      this.unlocked = this.index + 1;
      localStorage.setItem('sail.unlocked', String(this.unlocked));
    }
    const time = L.timed ? `<div class="raceResult">Course time: <b>${fmtTime(this.raceTime)}</b></div>` : '';
    this.overlayText.innerHTML =
      `<h2>✔ ${L.title} — complete</h2>${time}<p>${L.takeaway}</p>`;
    this.overlay.classList.add('show');
  }
}

function fmtTime(t) {
  const m = Math.floor(t / 60), s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}
