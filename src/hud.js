// hud.js — instruments: wind rose, trim gauge, speed/heel, status + tips
import { DEG, KNOTS, SHEET_MAX, driveCoefAt } from './physics.js';

const $ = (id) => document.getElementById(id);

export class HUD {
  constructor() {
    this.rose = $('windRose');
    this.roseCtx = this.rose.getContext('2d');
    this.showSailingSectors = false;
    const sectorsToggle = $('windSectorsToggle');
    sectorsToggle.addEventListener('click', () => {
      this.showSailingSectors = !this.showSailingSectors;
      sectorsToggle.setAttribute('aria-pressed', String(this.showSailingSectors));
      const label = this.showSailingSectors ? 'Hide points of sail' : 'Show points of sail';
      sectorsToggle.setAttribute('aria-label', label);
      sectorsToggle.title = label;
    });
    this.trim = $('trimBar');
    this.trimCtx = this.trim.getContext('2d');
    this.speedEl = $('speedVal');
    this.headingEl = $('headingVal');
    this.heelEl = $('heelVal');
    this.effEl = $('effVal');
    this.twsEl = $('twsVal');
    this.awsEl = $('awsVal');
    this.statusEl = $('statusBadge');
    this.tipEl = $('tipText');
    this._tipTimer = 0;
    this._tipKey = '';
    this.mode = 'full';
  }

  // 'full' = lessons: every aid visible. 'exam' = tests: no trim bar, no
  // coach tips, no status badge — only real-boat instruments remain.
  setMode(mode) {
    this.mode = mode;
    document.body.classList.toggle('exam-mode', mode === 'exam');
    if (mode === 'exam') {
      this.statusEl.style.opacity = 0;
      this.tipEl.innerHTML = '';
      this._tipKey = '';
    }
  }

  // Move the existing readouts so lesson runtime remains their single data source.
  _placeTutorialFeedback(state) {
    const target = state && !state.hidden && state.step.feedbackTarget;
    const row = target === 'steer' ? $('coachSteerRow')
      : target === 'sail' ? $('coachSailRow') : null;
    const feedback = $('coachFeedback');
    const home = row || $('coachFeedbackHome');
    if (feedback.parentElement !== home) home.append(feedback);
    const mark = $('markInfo');
    const markHome = row ? feedback : $('lessonPanel');
    if (mark.parentElement !== markHome) markHome.append(mark);
    // The mark readout already includes distance, bearing and ring number.
    $('coachProgressText').hidden = !!row && state.step.progress === 'distance';
  }

  setTutorial(state) {
    this.tutorialState = state;
    document.body.classList.toggle('tutorial-active', !!state);
    $('tutorialCoach').hidden = !state;
    document.querySelectorAll('.tutorial-highlight').forEach((el) => el.classList.remove('tutorial-highlight'));
    this._placeTutorialFeedback(state);
    if (!state) {
      clearTimeout(this._coachAdvanceTimer);
      this._coachTutorial = null;
      this._coachIndex = null;
      $('coachAdvance').hidden = true;
      return;
    }
    this.tipEl.innerHTML = '';
    this._tipKey = '';
    const { tutorial, steps, step, index, count, hidden, ctx, boat } = state;
    const touch = matchMedia('(pointer: coarse)').matches;
    $('coachCount').textContent = `STEP ${index + 1} OF ${count}`;
    if (tutorial !== this._coachTutorial || index !== this._coachIndex) {
      const previousIndex = tutorial === this._coachTutorial ? this._coachIndex : null;
      const strip = $('coachSteps');
      strip.replaceChildren(...steps.map((item, i) => {
        const node = document.createElement('li');
        node.textContent = String(i + 1);
        node.setAttribute('aria-label', `Step ${i + 1}: ${item.title}`);
        if (i === index) node.setAttribute('aria-current', 'step');
        if (i < index) node.classList.add('done');
        return node;
      }));
      const advance = $('coachAdvance');
      clearTimeout(this._coachAdvanceTimer);
      if (previousIndex !== null && previousIndex < index) {
        advance.textContent = `✓ ${steps[previousIndex].title} complete · Next: ${step.title}`;
        advance.hidden = false;
        $('lessonPanel').scrollTop = 0;
        this._coachAdvanceTimer = setTimeout(() => { advance.hidden = true; }, 4000);
      } else advance.hidden = true;
      this._coachTutorial = tutorial;
      this._coachIndex = index;
    }
    $('guidanceToggle').textContent = hidden ? 'Show guidance' : 'Hide guidance';
    $('guidanceToggle').setAttribute('aria-expanded', String(!hidden));
    $('coachBody').hidden = hidden;
    if (hidden) return;
    for (const id of step.highlights || []) $(id)?.classList.add('tutorial-highlight');
    // Do not repeatedly replace the live heading while the same step is active.
    if ($('coachTitle').textContent !== step.title) $('coachTitle').textContent = step.title;
    $('coachGoal').hidden = !step.goal;
    $('coachGoal').textContent = step.goal || '';
    const action = step[touch ? 'touch' : 'keyboard'];
    $('coachAction').textContent = typeof action === 'function' ? action(boat, ctx) : action;
    const sail = step.sail;
    $('coachSailRow').hidden = !sail;
    $('coachSail').textContent = typeof sail === 'function' ? sail(boat, touch) : sail || '';
    const progress = $('coachProgress');
    progress.hidden = ['distance', 'tack'].includes(step.progress);
    if (step.progress === 'course') {
      progress.value = Math.min(1, ctx.onCourseTime / 15);
      $('coachProgressText').textContent = `${Math.min(15, ctx.onCourseTime).toFixed(1)} / 15 seconds on course`;
    } else if (step.progress === 'trim') {
      progress.value = Math.max(0, Math.min(1, boat.efficiency / 0.7, boat.speed / 1.2));
      $('coachProgressText').textContent = 'Fill the sail and build speed';
    } else if (step.progress === 'no-go') {
      progress.value = Math.min(1, ctx.timeInNoGo / 2.5);
      $('coachProgressText').textContent = 'Watch the sail and speed while pointing upwind';
    } else if (step.progress === 'speed') {
      progress.value = Math.min(1, Math.max(0, boat.speed / (step.speedTarget ?? 1.8)));
      $('coachProgressText').textContent = step.speedTarget
        ? `${Math.max(0, boat.speed * KNOTS).toFixed(1)} / ${(step.speedTarget * KNOTS).toFixed(1)} kn · close-hauled`
        : 'Build speed on a close-hauled course';
    } else if (step.progress === 'upwind-leg') {
      progress.value = Math.min(1, Math.max(0, (boat.pos.z - ctx.upwindLegStartZ) / 70));
      $('coachProgressText').textContent = `${Math.max(0, Math.round(boat.pos.z - ctx.upwindLegStartZ))} / 70 m gained upwind`;
    } else if (step.progress === 'tack') {
      $('coachProgressText').textContent = 'Turn through the wind onto the other close-hauled course';
    } else {
      $('coachProgressText').textContent = Number.isFinite(ctx.distToMark) ? `${Math.round(ctx.distToMark)} m to the ring` : 'Destination: the glowing ring';
    }
    const recovery = boat.inIrons ? tutorial.recovery.irons
      : boat.stalled ? tutorial.recovery.stall
      : boat.luffing && index > 0 ? tutorial.recovery.luff : '';
    const hideAction = !!recovery && !sail;
    $('coachAction').hidden = hideAction;
    $('coachSteerLabel').hidden = !sail || hideAction;
    if ($('coachRecovery').textContent !== recovery) $('coachRecovery').textContent = recovery;
  }

  update(dt, boat, wind, targets = []) {
    this._drawRose(boat, wind, targets);
    if (this.mode !== 'exam') this._drawTrim(boat);

    const kn = (boat.speed * KNOTS);
    this.speedEl.textContent = kn.toFixed(1);
    const hdg = ((boat.heading / DEG) % 360 + 360) % 360;
    this.headingEl.textContent = String(Math.round(hdg)).padStart(3, '0') + '°';
    this.heelEl.textContent = Math.round(Math.abs(boat.heel) / DEG) + '°';
    this.heelEl.classList.toggle('danger', Math.abs(boat.heel) > 30 * DEG);
    this.effEl.textContent = Math.round(boat.efficiency * 100) + '%';
    this.twsEl.textContent = (wind.speed * KNOTS).toFixed(0);
    this.awsEl.textContent = (boat.aws * KNOTS).toFixed(0);

    // Status badge
    if (this.mode === 'exam') return;
    let status = null, cls = '';
    if (boat.inIrons) { status = 'IN IRONS'; cls = 'bad'; }
    else if (boat.luffing) { status = 'LUFFING — sheet in'; cls = 'warn'; }
    else if (boat.stalled) { status = 'STALLED — ease out'; cls = 'warn'; }
    else if (boat.byTheLee) { status = 'BY THE LEE — gybe risk!'; cls = 'bad'; }
    else if (boat.efficiency > 0.92 && Math.abs(boat.speed) > 1) { status = 'PERFECT TRIM'; cls = 'good'; }
    if (status) {
      this.statusEl.textContent = status;
      this.statusEl.className = 'status ' + cls;
      this.statusEl.style.opacity = 1;
    } else {
      this.statusEl.style.opacity = 0;
    }
  }

  setTip(text, key = text) {
    if (this.mode === 'exam') return;
    if (key === this._tipKey) return;
    this._tipKey = key;
    this.tipEl.innerHTML = text;
    this.tipEl.classList.remove('pulse');
    void this.tipEl.offsetWidth; // restart animation
    this.tipEl.classList.add('pulse');
  }

  // ------------------------------------------------------ Wind rose (boat-up)
  _drawRose(boat, wind, targets = []) {
    const ctx = this.roseCtx;
    const W = this.rose.width, H = this.rose.height;
    const cx = W / 2, cy = H / 2, R = W / 2 - 26;
    ctx.clearRect(0, 0, W, H);

    // Dial
    ctx.beginPath();
    ctx.arc(cx, cy, R + 14, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(8, 22, 34, 0.72)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(150, 200, 235, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    const twa = boat.twa;
    if (this.showSailingSectors) {
      // Sectors are relative to TRUE wind, mirrored on both tacks. Keep
      // their boundaries aligned with pointOfSail() and the reference chart.
      const sectors = [
        { a0: 0, a1: 32, color: 'rgba(255,80,80,.16)', label: ['NO-GO'] },
        { a0: 32, a1: 52, color: 'rgba(110,190,255,.16)', label: ['CLOSE', 'HAUL'] },
        { a0: 52, a1: 80, color: 'rgba(110,255,190,.12)', label: ['CLOSE', 'REACH'] },
        { a0: 80, a1: 102, color: 'rgba(120,255,140,.18)', label: ['BEAM'] },
        { a0: 102, a1: 150, color: 'rgba(110,255,190,.12)', label: ['BROAD'] },
        { a0: 150, a1: 180, color: 'rgba(190,170,255,.16)', label: ['RUN'] },
      ];
      for (const sector of sectors) {
        for (const side of [-1, 1]) {
          const a = twa - Math.PI / 2 + side * sector.a0 * DEG;
          const b = twa - Math.PI / 2 + side * sector.a1 * DEG;
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.arc(cx, cy, R + 8, Math.min(a, b), Math.max(a, b));
          ctx.closePath();
          ctx.fillStyle = sector.color;
          ctx.fill();
        }
      }
      // Use one stable set of labels, positioned with true wind but drawn
      // in screen coordinates to stay upright as the sectors rotate.
      const labelSide = -1;
      ctx.font = 'bold 10px system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (const sector of sectors) {
        const mid = sector.a0 === 0 ? 20 : sector.a1 === 180 ? 180
          : (sector.a0 + sector.a1) / 2;
        const angle = twa - Math.PI / 2 + labelSide * mid * DEG;
        const x = cx + Math.cos(angle) * (R - 14);
        const y = cy + Math.sin(angle) * (R - 14);
        ctx.fillStyle = 'rgba(225,240,250,.9)';
        sector.label.forEach((line, i) => {
          ctx.fillText(line, x, y + (i - (sector.label.length - 1) / 2) * 10);
        });
      }
      ctx.textBaseline = 'alphabetic';
    } else {
      // Original simple compass: only the translucent no-go wedge.
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(twa);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, R + 8, -Math.PI / 2 - 35 * DEG, -Math.PI / 2 + 35 * DEG);
      ctx.closePath();
      ctx.fillStyle = 'rgba(255, 80, 80, .16)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 110, 110, .35)';
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.restore();
    }

    // Compass ticks (rotate with heading so it stays boat-up)
    ctx.save();
    ctx.translate(cx, cy);
    for (let d = 0; d < 360; d += 30) {
      const a = d * DEG - boat.heading;
      ctx.save();
      ctx.rotate(a);
      ctx.strokeStyle = 'rgba(170, 210, 240, 0.5)';
      ctx.lineWidth = d % 90 === 0 ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(0, -R - 6);
      ctx.lineTo(0, -R - (d % 90 === 0 ? 14 : 10));
      ctx.stroke();
      ctx.textAlign = 'center';
      if (d % 90 === 0) {
        ctx.fillStyle = d === 0 ? '#ff8f66' : 'rgba(200, 225, 245, 0.85)';
        ctx.font = 'bold 12px system-ui';
        ctx.fillText('NESW'[d / 90], 0, -R - 18);
      } else {
        // degree numbers between the cardinals, like a real compass card
        ctx.fillStyle = 'rgba(200, 225, 245, 0.6)';
        ctx.font = '9px system-ui';
        ctx.fillText(String(d), 0, -R - 15);
      }
      ctx.restore();
    }
    ctx.restore();

    // Wind arrows: drawn from outside pointing inward (where wind blows TO)
    const arrow = (angle, len, color, label) => {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle);
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = 3.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, -R - 2);
      ctx.lineTo(0, -R + len);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, -R + len + 10);
      ctx.lineTo(-6.5, -R + len - 2);
      ctx.lineTo(6.5, -R + len - 2);
      ctx.closePath();
      ctx.fill();
      if (label) {
        ctx.font = 'bold 11px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText(label, 0, -R + len + 24);
      }
      ctx.restore();
    };
    arrow(twa, 34, '#4fa8ff', 'TRUE');
    arrow(boat.awa, 20, '#ffb14f', 'APP');

    this._drawTargets(ctx, cx, cy, R, boat, targets);

    // Boat glyph (always up)
    ctx.save();
    ctx.translate(cx, cy);
    ctx.beginPath();
    ctx.moveTo(0, -26);
    ctx.bezierCurveTo(11, -10, 11, 12, 7, 22);
    ctx.lineTo(-7, 22);
    ctx.bezierCurveTo(-11, 12, -11, -10, 0, -26);
    ctx.fillStyle = 'rgba(235, 245, 252, 0.92)';
    ctx.fill();
    // boom line
    ctx.rotate(-boat.boom); // canvas y-down: physics +boom (stbd) → canvas right
    ctx.strokeStyle = '#345';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(0, -4);
    ctx.lineTo(0, 16);
    ctx.stroke();
    ctx.restore();
  }

  // Buoys on the rose, radar-style: boat-up bearing, distance on a square-root
  // scale to 500 m so the next buoy visibly closes in and grows. Later buoys are
  // smaller, faded and numbered; past 500 m a buoy waits on the rim with a pointer.
  _drawTargets(ctx, cx, cy, R, boat, targets) {
    const RANGE = 500; // metres at the rim
    const inner = 30;  // clear of the boat glyph
    const pos = (rel, r) => [cx + Math.sin(rel) * r, cy - Math.cos(rel) * r];
    // Later buoys first, so the next one is drawn on top.
    for (let i = targets.length - 1; i >= 0; i--) {
      const dx = targets[i].x - boat.pos.x, dz = targets[i].z - boat.pos.z;
      const dist = Math.hypot(dx, dz);
      const rel = Math.atan2(-dx, dz) - boat.heading;
      const active = i === 0, off = dist > RANGE;
      const r = off ? R - 4 : inner + (R - inner) * Math.sqrt(dist / RANGE);
      const [x, y] = pos(rel, r);
      const s = !active ? 0.75 : off ? 0.9 : 1 + 0.9 * (1 - Math.sqrt(dist / RANGE));
      ctx.save();
      ctx.globalAlpha = active ? 1 : 0.45;
      if (off) {
        const [px, py] = pos(rel, R + 3);
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(rel);
        ctx.beginPath();
        ctx.moveTo(0, -8); ctx.lineTo(6, 3); ctx.lineTo(-6, 3);
        ctx.closePath();
        ctx.fillStyle = '#ff5a1f';
        ctx.fill();
        ctx.restore();
      }
      this._drawBuoyIcon(ctx, x, y, s);
      ctx.font = `bold ${active ? 11 : 10}px system-ui`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(4, 20, 30, 0.95)';
      let label, lx, ly;
      if (active) {
        label = `${Math.round(dist)} m`;
        // Close in, the label sits outside the buoy so it never covers the boat.
        [lx, ly] = r < 62 ? pos(rel, r + 24) : [x, y + 12 * s + 8];
        ctx.fillStyle = '#ffffff';
      } else {
        label = String(i + 1);
        [lx, ly] = [x + 10, y - 10];
        ctx.fillStyle = '#ffe14d';
      }
      ctx.strokeText(label, lx, ly);
      ctx.fillText(label, lx, ly);
      ctx.restore();
    }
    ctx.textBaseline = 'alphabetic';
  }

  // Orange can buoy with a yellow flag, matching the 3D mark.
  _drawBuoyIcon(ctx, x, y, s) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.strokeStyle = '#cfd8e0';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(0, -15); ctx.lineTo(0, -4);
    ctx.stroke();
    ctx.fillStyle = '#ffe14d';
    ctx.fillRect(0.8, -15, 8, 5);
    ctx.strokeStyle = 'rgba(4, 20, 30, 0.95)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-6, 8); ctx.lineTo(-4, -4); ctx.lineTo(4, -4); ctx.lineTo(6, 8);
    ctx.closePath();
    ctx.fillStyle = '#ff5a1f';
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // -------------------------------------------------------- Trim gauge
  _drawTrim(boat) {
    const ctx = this.trimCtx;
    const W = this.trim.width, H = this.trim.height;
    ctx.clearRect(0, 0, W, H);
    const pad = 14, bw = W - pad * 2, y0 = 26, bh = 16;
    const X = (rad) => pad + (rad / SHEET_MAX) * bw;

    const absAWA = Math.abs(boat.awa);

    // Base track
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    roundRect(ctx, pad, y0, bw, bh, 8);
    ctx.fill();

    // Color the whole track from the real physics: at each sheet setting,
    // how much drive would the sail make at the current apparent wind angle?
    // Green = near-max drive, red = stalled/weak, blue = luffing (too loose).
    let best = 1e-6;
    const N = 64, drives = new Array(N + 1);
    for (let i = 0; i <= N; i++) {
      const s = (i / N) * SHEET_MAX;
      drives[i] = driveCoefAt(absAWA, s);
      if (drives[i] > best) best = drives[i];
    }
    ctx.save();
    roundRect(ctx, pad, y0, bw, bh, 8);
    ctx.clip();
    const seg = bw / N;
    for (let i = 0; i < N; i++) {
      const s = (i / N) * SHEET_MAX;
      const rel = Math.max(0, drives[i]) / best;
      const luff = absAWA - s < 5 * DEG; // boom weathervanes → flogging
      if (luff) ctx.fillStyle = 'rgba(120,170,255,0.35)';
      else if (rel > 0.93) ctx.fillStyle = 'rgba(90,230,140,0.60)';
      else if (rel > 0.7) ctx.fillStyle = `rgba(${170 - 90 * (rel - 0.7) / 0.23 | 0},210,120,0.42)`;
      else ctx.fillStyle = `rgba(255,${60 + 140 * rel | 0},70,0.38)`;
      ctx.fillRect(pad + i * seg, y0, seg + 0.5, bh);
    }
    ctx.restore();

    // Marker: current sheet
    const mx = X(boat.sheet);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(mx, y0 - 7);
    ctx.lineTo(mx - 6, y0 - 16);
    ctx.lineTo(mx + 6, y0 - 16);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(mx - 1.25, y0 - 6, 2.5, bh + 10);

    // Labels
    ctx.fillStyle = 'rgba(220,235,248,0.8)';
    ctx.font = '10px system-ui';
    ctx.textAlign = 'left';
    ctx.fillText('SHEETED IN', pad, y0 + bh + 14);
    ctx.textAlign = 'right';
    ctx.fillText('EASED OUT', pad + bw, y0 + bh + 14);
    ctx.textAlign = 'center';
    ctx.fillText(`MAINSHEET  ${Math.round(boat.sheet / DEG)}°`, W / 2, 12);
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
