// physics.js — wind + yacht dynamics for Sail Trainer 3D
// Model documented in docs/RESEARCH.md §7. All angles in radians, SI units.

export const TAU = Math.PI * 2;
export const DEG = Math.PI / 180;
export const KNOTS = 1.94384; // m/s -> knots

export function wrapPi(a) {
  while (a > Math.PI) a -= TAU;
  while (a < -Math.PI) a += TAU;
  return a;
}
export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
export const lerp = (a, b, t) => a + (b - a) * t;

// ---------------------------------------------------------------- Wind field
// dirFrom: compass angle the wind blows FROM. Vector convention: compass angle
// a maps to direction (-sin a, cos a) in the world XZ plane (north = +Z,
// east = -X), which keeps the frame right-handed in three.js (Y up): the
// starboard side of a boat facing +Z is -X.
export class Wind {
  constructor(dirFrom = 0, speed = 6) {
    this.baseDirFrom = dirFrom;
    this.baseSpeed = speed;      // m/s
    this.dirFrom = dirFrom;
    this.speed = speed;
    this.gustiness = 0.15;       // fraction of speed
    this.shiftiness = 6 * DEG;   // direction wander amplitude
    this._t = Math.random() * 1000;
  }
  update(dt) {
    this._t += dt;
    const t = this._t;
    // Cheap layered sines ≈ smooth noise: gusts (fast-ish) + shifts (slow).
    const gust =
      Math.sin(t * 0.31) * 0.55 + Math.sin(t * 0.113 + 1.7) * 0.35 + Math.sin(t * 0.71 + 4.1) * 0.25;
    const shift = Math.sin(t * 0.043) * 0.6 + Math.sin(t * 0.017 + 2.3) * 0.4;
    this.speed = Math.max(0.5, this.baseSpeed * (1 + this.gustiness * gust));
    this.dirFrom = this.baseDirFrom + this.shiftiness * shift;
  }
  // Velocity vector of the air (points where the wind blows TO).
  vel() {
    return { x: Math.sin(this.dirFrom) * this.speed, z: -Math.cos(this.dirFrom) * this.speed };
  }
}

// ------------------------------------------------- Sail lift/drag curves
// Airfoil coefficients over angle of attack. Lift: luff below ~5°, peak near
// 22°, stall past 30°, residual lift toward 90°. Drag: base + form drag that
// grows toward the parachute regime (α → 90°).
export function liftCoef(aoa) {
  const a = Math.abs(aoa);
  if (a < 5 * DEG) return 0.3 * (a / (5 * DEG));
  if (a < 22 * DEG) {
    const t = (a - 5 * DEG) / (17 * DEG);
    return 0.3 + 0.95 * (t * t * (3 - 2 * t)); // smoothstep to 1.25
  }
  if (a < 30 * DEG) return 1.25;
  if (a < 50 * DEG) {
    const t = (a - 30 * DEG) / (20 * DEG);
    return 1.25 - 0.55 * t;
  }
  const t = clamp((a - 50 * DEG) / (45 * DEG), 0, 1);
  return 0.7 - 0.38 * t; // ~0.32 residual past 90°
}

export function dragCoef(aoa) {
  const s = Math.sin(Math.abs(aoa));
  return 0.08 + 1.15 * s * s; // flogging floor → parachute (~1.23 at 90°)
}

// Pointing limit: below ~25° apparent the combined sail+keel drag budget eats
// all the lift — this factor kills usable drive inside the no-go zone.
export function pointingFactor(absAWA) {
  const t = clamp((absAWA - 14 * DEG) / (16 * DEG), 0, 1);
  return t * t * (3 - 2 * t);
}

// Net forward drive coefficient at a given apparent wind angle and sheet.
export function driveCoefAt(absAWA, sheet) {
  const boom = Math.min(sheet, absAWA);
  const aoa = absAWA - boom;
  return (
    liftCoef(aoa) * Math.sin(absAWA) * pointingFactor(absAWA) -
    dragCoef(aoa) * Math.cos(absAWA)
  );
}

export const SHEET_MAX = 85 * DEG; // how far the mainsheet can let the boom out
export const OPT_AOA = 19 * DEG;   // target angle of attack for auto-trim

// ------------------------------------------------------------------- Yacht
export class Boat {
  constructor() {
    this.pos = { x: 0, z: 0 };
    this.heading = 0;       // compass angle of the bow, (-sin h, cos h)
    this.speed = 0;         // m/s along heading (negative = sternway)
    this.latVel = 0;        // leeway drift, + = to starboard
    this.yawRate = 0;
    this.heel = 0;          // + = heeled to starboard
    this.rudder = 0;        // -1..1, + = turn to starboard
    this.sheet = SHEET_MAX; // mainsheet: max boom angle allowed (rad)
    this.boom = 0;          // signed boom angle, + = boom to starboard side
    this.autoTrim = false;

    // Derived / reported each step:
    this.awa = 0; this.aws = 0; this.twa = 0;
    this.aoa = 0; this.coef = 0; this.drive = 0; this.sideForce = 0;
    this.luffing = false; this.stalled = false; this.inIrons = false;
    this.byTheLee = false; this.gybeSwing = 0; // boom sweep speed (visual/audio)
    this.efficiency = 0; // 0..1 trim quality on this point of sail
    this.distance = 0;   // meters logged

    // Tunables for a ~10 m cruiser-racer:
    this.mass = 4200;
    this.sailArea = 60;          // combined main+jib (m^2)
    this.hullDrag = 100;         // quadratic drag coeff (N per (m/s)^2)
    this.windage = 2.2;          // hull+rig windage (N per (m/s)^2)
    this.maxTurn = 42 * DEG;     // rad/s at full speed & full rudder
    this.refSpeed = 4.0;         // m/s ≈ hull speed
    this.maxHeel = 38 * DEG;
  }

  forward() { return { x: -Math.sin(this.heading), z: Math.cos(this.heading) }; }
  starboard() { return { x: -Math.cos(this.heading), z: -Math.sin(this.heading) }; }

  update(dt, wind) {
    const fwd = this.forward(), stb = this.starboard();

    // Boat velocity vector (forward + leeway components).
    const vx = fwd.x * this.speed + stb.x * this.latVel;
    const vz = fwd.z * this.speed + stb.z * this.latVel;

    // ---- Apparent wind: AW = TW - Vboat -------------------------------
    const wv = wind.vel();
    const ax = wv.x - vx, az = wv.z - vz;
    this.aws = Math.hypot(ax, az);
    // Direction the apparent wind comes FROM, in boat frame.
    const fx = -(ax * fwd.x + az * fwd.z);
    const fy = -(ax * stb.x + az * stb.z);
    this.awa = Math.atan2(fy, fx); // + = wind from starboard
    this.twa = wrapPi(wind.dirFrom - this.heading);

    const absAWA = Math.abs(this.awa);
    const windSide = Math.sign(this.awa) || 1; // side the wind comes from

    // ---- Boom & angle of attack ---------------------------------------
    // The boom blows out to leeward until the sheet stops it (or it
    // weathervanes at the apparent-wind angle and the sail flogs).
    const boomAbs = Math.min(this.sheet, absAWA);
    const boomTarget = -windSide * boomAbs; // boom carried to leeward
    const prevBoom = this.boom;
    // Boom follows target; a gybe (target flips sides with wind astern)
    // sweeps fast — the classic slam.
    const rate = absAWA > 120 * DEG ? 6.0 : 3.0;
    this.boom += clamp(boomTarget - this.boom, -rate * dt, rate * dt);
    this.gybeSwing = Math.abs(this.boom - prevBoom) / Math.max(dt, 1e-4);

    this.aoa = Math.max(0, absAWA - Math.abs(this.boom));
    this.coef = liftCoef(this.aoa);
    this.luffing = absAWA < 100 * DEG && this.aoa < 6 * DEG;
    this.stalled = this.aoa > 40 * DEG && absAWA < 120 * DEG;
    this.byTheLee = absAWA > 165 * DEG || (absAWA > 140 * DEG && Math.sign(this.boom) === windSide);

    if (this.autoTrim) {
      // Chase the sheet that maximises drive (computed below, 1-frame lag).
      const ideal = clamp(this.bestSheet ?? absAWA - OPT_AOA, 4 * DEG, SHEET_MAX);
      this.sheet += clamp(ideal - this.sheet, -0.6 * dt, 0.6 * dt);
    }

    // ---- Forces --------------------------------------------------------
    // Lift ⊥ to the apparent wind, drag along it, resolved into boat axes:
    //   drive = L·sin(AWA) − D·cos(AWA)   side = L·cos(AWA) + D·sin(AWA)
    const rhoAir = 1.225;
    const q = 0.5 * rhoAir * this.sailArea * this.aws * this.aws;
    const Cl = liftCoef(this.aoa) * pointingFactor(absAWA);
    const Cd = dragCoef(this.aoa);
    const sinA = Math.sin(absAWA), cosA = Math.cos(absAWA);
    this.drive = q * (Cl * sinA - Cd * cosA); // negative near head-to-wind
    this.sideForce = q * (Cl * cosA + Cd * sinA * 0.35); // heeling push (to leeward)
    // Excess heel spills power and drags the hull.
    const heelLoss = 1 - 0.55 * Math.pow(Math.abs(this.heel) / this.maxHeel, 2);
    if (this.drive > 0) this.drive *= heelLoss;

    // Hull/rig windage (pushes aft when the apparent wind is ahead).
    const axialWind = -this.windage * this.aws * this.aws * Math.cos(this.awa);

    // Hull drag (quadratic).
    const drag = this.hullDrag * this.speed * Math.abs(this.speed);

    const accel = (this.drive + axialWind - drag) / this.mass;
    this.speed += accel * dt;
    if (this.speed < -0.8) this.speed = -0.8; // limited sternway

    // ---- Heel (smoothed spring toward force balance) -------------------
    const heelDir = -windSide; // heel away from the wind
    const heelTarget = heelDir * this.maxHeel * Math.tanh(this.sideForce / 5200);
    this.heel += (heelTarget - this.heel) * Math.min(1, 1.6 * dt);

    // ---- Leeway ---------------------------------------------------------
    const leewayTarget = heelDir * Math.min(0.5, this.sideForce / 9000) *
      Math.max(0.3, Math.min(1, Math.abs(this.speed))); // keel needs flow to resist… and to drift
    this.latVel += (leewayTarget - this.latVel) * Math.min(1, 2 * dt);

    // ---- Steering -------------------------------------------------------
    // Rudder authority needs water flow; reverses when making sternway.
    const flow = clamp(this.speed / this.refSpeed, -1, 1);
    const authority = Math.sign(flow) * (0.08 + 0.92 * Math.pow(Math.abs(flow), 0.7));
    // Weather helm: heeled boats try to round up into the wind.
    const weatherHelm = -Math.sign(this.heel) * Math.abs(this.heel) * 0.055 * clamp(Math.abs(flow), 0, 1);
    const yawTarget = this.rudder * this.maxTurn * authority + weatherHelm;
    this.yawRate += (yawTarget - this.yawRate) * Math.min(1, 3 * dt);
    this.heading = wrapPi(this.heading + this.yawRate * dt);

    // ---- Integrate position ---------------------------------------------
    const nvx = fwd.x * this.speed + stb.x * this.latVel;
    const nvz = fwd.z * this.speed + stb.z * this.latVel;
    this.pos.x += nvx * dt;
    this.pos.z += nvz * dt;
    this.distance += Math.hypot(nvx, nvz) * dt;

    // ---- Status ----------------------------------------------------------
    this.inIrons = Math.abs(this.twa) < 35 * DEG && this.speed < 0.55;

    // Trim efficiency: current drive vs best achievable drive at this AWA.
    let best = 1e-6, bestS = clamp(absAWA - OPT_AOA, 2 * DEG, SHEET_MAX);
    for (let s = 2 * DEG; s <= SHEET_MAX; s += 2 * DEG) {
      const d = driveCoefAt(absAWA, s);
      if (d > best) { best = d; bestS = s; }
    }
    this.bestSheet = bestS;
    const cur = Math.max(0, Cl * sinA - Cd * cosA);
    // No meaningful drive is possible near head-to-wind — trim reads 0 there.
    this.efficiency = best < 0.04 ? 0 : clamp(cur / best, 0, 1);
  }
}

// Human-readable point of sail from the TRUE wind angle.
export function pointOfSail(twa) {
  const a = Math.abs(twa) / DEG;
  if (a < 32) return { name: 'In Irons — No-Go Zone', short: 'NO-GO', danger: true };
  if (a < 52) return { name: 'Close-Hauled', short: 'BEAT' };
  if (a < 80) return { name: 'Close Reach', short: 'C.REACH' };
  if (a < 102) return { name: 'Beam Reach', short: 'B.REACH' };
  if (a < 150) return { name: 'Broad Reach', short: 'BROAD' };
  return { name: 'Running', short: 'RUN' };
}

export function tackName(twa) {
  return twa >= 0 ? 'Starboard tack' : 'Port tack';
}
