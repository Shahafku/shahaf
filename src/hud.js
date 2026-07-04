// hud.js — instruments: wind rose, trim gauge, speed/heel, status + tips
import { DEG, KNOTS, SHEET_MAX, pointOfSail, tackName } from './physics.js';

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
  }

  update(dt, boat, wind) {
    this._drawRose(boat, wind);
    this._drawTrim(boat);

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
      if (d % 90 === 0) {
        ctx.fillStyle = d === 0 ? '#ff8f66' : 'rgba(200, 225, 245, 0.85)';
        ctx.font = 'bold 12px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('NESW'[d / 90], 0, -R - 18);
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

    // Zones for the current apparent wind angle:
    //   sheet > AWA-5°  → sail luffs;  AWA-25°..AWA-13° → sweet spot;
    //   sheet < AWA-35° → stalled.
    const luffFrom = Math.max(0, absAWA - 5 * DEG);
    const sweetLo = absAWA - 25 * DEG, sweetHi = absAWA - 13 * DEG;
    const stallTo = absAWA - 35 * DEG;

    const zone = (a, b, color) => {
      const x1 = Math.max(pad, Math.min(X(a), pad + bw));
      const x2 = Math.max(pad, Math.min(X(b), pad + bw));
      if (x2 - x1 < 1) return;
      ctx.fillStyle = color;
      roundRect(ctx, x1, y0, x2 - x1, bh, 4);
      ctx.fill();
    };
    zone(0, stallTo, 'rgba(255,120,80,0.4)');            // stalled (too tight)
    zone(sweetLo, sweetHi, 'rgba(90,230,140,0.55)');     // perfect
    zone(luffFrom, SHEET_MAX, 'rgba(120,170,255,0.35)'); // luffing (too loose)

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
