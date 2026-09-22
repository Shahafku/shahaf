// confetti.js — a one-shot celebration burst over the whole window.
// Self-contained 2D canvas: no dependencies, nothing left behind when it ends.

const COLORS = ['#7dffb5', '#8fd0ff', '#ffd166', '#4fa8ff', '#ffffff'];
const COUNT = 140;
const LIFE = 3.2;      // seconds until the canvas removes itself
const FADE = 0.8;      // seconds of fade-out at the end
const GRAVITY = 260;   // px/s²

export function burstConfetti() {
  if (typeof document === 'undefined' || !document.createElement) return;
  if (globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) return;

  const w = globalThis.innerWidth, h = globalThis.innerHeight;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const dpr = Math.min(globalThis.devicePixelRatio || 1, 2);
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.cssText =
    `position:fixed;inset:0;width:${w}px;height:${h}px;pointer-events:none;z-index:30`;
  ctx.scale(dpr, dpr);
  document.body.appendChild(canvas);

  const bits = Array.from({ length: COUNT }, () => ({
    x: w * (0.15 + 0.7 * Math.random()),
    y: -20 - Math.random() * h * 0.35,
    vx: (Math.random() - 0.5) * 190,
    vy: 90 + Math.random() * 210,
    spin: (Math.random() - 0.5) * 9,
    angle: Math.random() * Math.PI,
    width: 5 + Math.random() * 6,
    height: 8 + Math.random() * 7,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
  }));

  let start = null, prev = null;
  const frame = (now) => {
    if (start === null) start = now;
    const dt = Math.min((now - (prev ?? now)) / 1000, 0.05);
    prev = now;
    const age = (now - start) / 1000;

    ctx.clearRect(0, 0, w, h);
    ctx.globalAlpha = age > LIFE - FADE ? Math.max(0, (LIFE - age) / FADE) : 1;
    for (const b of bits) {
      b.vy += GRAVITY * dt;
      b.vx *= 0.995;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.angle += b.spin * dt;
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.angle);
      ctx.fillStyle = b.color;
      ctx.fillRect(-b.width / 2, -b.height / 2, b.width, b.height);
      ctx.restore();
    }

    if (age < LIFE) globalThis.requestAnimationFrame(frame);
    else canvas.remove();
  };
  globalThis.requestAnimationFrame(frame);
}
