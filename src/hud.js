// hud.js — instruments: wind rose, trim gauge, speed/heel, status + tips
import { DEG, KNOTS, SHEET_MAX, pointOfSail, tackName, driveCoefAt } from './physics.js';

const $ = (id) => document.getElementById(id);

export class HUD {
  constructor() {
    this.rose = $('windRose');
    this.roseCtx = this.rose.getContext('2d');
    this.trim = $('trimBar');
    this.trimCtx = this.trim.getContext('2d');
    this.speedEl = $('speedVal');
    this.headingEl = $('headingVal');
    this.posEl = $('posName');
    this.tackEl = $('tackName');
    this.heelEl = $('heelVal');
    this.effEl = $('effVal');
    this.twsEl = $('twsVal');
    this.awsEl = $('awsVal');
    this.statusEl = $('statusBadge');
    this.tipEl = $('tipText');
    this._tipTimer = 0;
    this._tipKey = '';
    this.posPanel = $('posPanel');
    this.posCtx = $('posDiagram').getContext('2d');
  }

  update(dt, boat, wind) {
    this._drawRose(boat, wind);
    this._drawTrim(boat);
    if (this.posPanel.classList.contains('show')) this._drawPos(boat);

    const kn = (boat.speed * KNOTS);
    this.speedEl.textContent = kn.toFixed(1);
    const hdg = ((boat.heading / DEG) % 360 + 360) % 360;
    this.headingEl.textContent = String(Math.round(hdg)).padStart(3, '0') + '°';
    const pos = pointOfSail(boat.twa);
    this.posEl.textContent = pos.name;
    this.posEl.classList.toggle('danger', !!pos.danger);
    this.tackEl.textContent = Math.abs(boat.twa) < 8 * DEG ? 'Head to wind' : tackName(boat.twa);
    this.heelEl.textContent = Math.round(Math.abs(boat.heel) / DEG) + '°';
    this.heelEl.classList.toggle('danger', Math.abs(boat.heel) > 30 * DEG);
    this.effEl.textContent = Math.round(boat.efficiency * 100) + '%';
    this.twsEl.textContent = (wind.speed * KNOTS).toFixed(0);
    this.awsEl.textContent = (boat.aws * KNOTS).toFixed(0);

    // Status badge
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
    if (key === this._tipKey) return;
    this._tipKey = key;
    this.tipEl.innerHTML = text;
    this.tipEl.classList.remove('pulse');
    void this.tipEl.offsetWidth; // restart animation
    this.tipEl.classList.add('pulse');
  }

  // ------------------------------------------------------ Wind rose (boat-up)
  _drawRose(boat, wind) {
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

    // No-go wedge around the true wind (±35°)
    const twa = boat.twa;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(twa); // boat-up: 0 rad = straight up
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, R + 8, -Math.PI / 2 - 35 * DEG, -Math.PI / 2 + 35 * DEG);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255, 80, 80, 0.16)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 110, 110, 0.35)';
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

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

  // ------------------------------------------- Points-of-sail diagram
  // Wind-up chart: wind always blows from the top; your boat rides around
  // the circle at its current true wind angle. A boat drawn on the RIGHT
  // half has the wind over its port side (port tack) and vice versa.
  _drawPos(boat) {
    const ctx = this.posCtx;
    const W = 300, H = 320, cx = W / 2, cy = H / 2 + 14, R = 100;
    ctx.clearRect(0, 0, W, H);

    // Sectors mirrored port/starboard. Angles in degrees off the wind.
    const sectors = [
      { a0: 0, a1: 32, color: 'rgba(255,90,90,0.30)', label: 'NO-GO' },
      { a0: 32, a1: 52, color: 'rgba(110,190,255,0.22)', label: 'CLOSE-HAULED' },
      { a0: 52, a1: 80, color: 'rgba(110,255,190,0.16)', label: 'CLOSE REACH' },
      { a0: 80, a1: 102, color: 'rgba(120,255,140,0.26)', label: 'BEAM REACH' },
      { a0: 102, a1: 150, color: 'rgba(110,255,190,0.16)', label: 'BROAD REACH' },
      { a0: 150, a1: 180, color: 'rgba(190,170,255,0.20)', label: 'RUN' },
    ];
    for (const s of sectors) {
      for (const side of [1, -1]) {
        const s0 = -Math.PI / 2 + side * s.a0 * DEG;
        const s1 = -Math.PI / 2 + side * s.a1 * DEG;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, R, Math.min(s0, s1), Math.max(s0, s1));
        ctx.closePath();
        ctx.fillStyle = s.color;
        ctx.fill();
      }
    }
    ctx.strokeStyle = 'rgba(170,210,240,0.4)';
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.stroke();

    // Labels along the starboard (left) side, horizontal for readability
    ctx.fillStyle = 'rgba(225,240,250,0.92)';
    ctx.font = 'bold 9px system-ui';
    for (const s of sectors) {
      const mid = (s.a0 + s.a1) / 2;
      const a = -Math.PI / 2 - mid * DEG; // left half
      const lr = R - 34;
      const x = cx + Math.cos(a) * lr, y = cy + Math.sin(a) * lr;
      ctx.textAlign = 'center';
      if (s.label === 'NO-GO') { ctx.fillText(s.label, cx, cy - R + 16); continue; }
      if (s.label === 'RUN') { ctx.fillText(s.label, cx, cy + R - 12); continue; }
      ctx.fillText(s.label, x, y + 3);
    }

    // Wind arrows blowing in from the top
    ctx.strokeStyle = '#4fa8ff';
    ctx.fillStyle = '#4fa8ff';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    for (const off of [-16, 0, 16]) {
      ctx.beginPath();
      ctx.moveTo(cx + off, 8);
      ctx.lineTo(cx + off, 26);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx + off, 34);
      ctx.lineTo(cx + off - 5, 25);
      ctx.lineTo(cx + off + 5, 25);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = '#8fd0ff';
    ctx.font = 'bold 10px system-ui';
    ctx.textAlign = 'left';
    ctx.fillText('WIND', cx + 30, 22);

    // Your boat on the circle: TWA + = starboard tack → LEFT half.
    const t = boat.twa;
    const px = cx - Math.sin(t) * R;
    const py = cy - Math.cos(t) * R;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(-t); // bow rotated |twa| away from the wind, toward its side
    ctx.beginPath();
    ctx.moveTo(0, -13);
    ctx.bezierCurveTo(6, -5, 6, 7, 4, 12);
    ctx.lineTo(-4, 12);
    ctx.bezierCurveTo(-6, 7, -6, -5, 0, -13);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#123';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.rotate(-boat.boom); // same convention as the wind rose glyph
    ctx.strokeStyle = '#345';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -2);
    ctx.lineTo(0, 9);
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
