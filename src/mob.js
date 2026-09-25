// mob.js — man-overboard (אדם בים) exercise: a crewmate throws a lifebuoy
// (גלגל הצלה) over the quarter; the helm must sail back and stop the boat
// with the ring close aboard in the front third of the boat, to windward —
// the final picture the Israeli practical exam asks for:
// "המצוף בשליש הקדמי של הספינה, הספינה עומדת, המצוף מעל לרוח".
import { DEG, wrapPi } from './physics.js';
import { makeLifeRing, bobLifeRing } from './ocean.js';

export const THROW_ANIM = 0.7;   // seconds of arm swing before the ring is loose
export const SPLASH_TIME = 0.5;  // seconds of ballistic arc down to the water
export const THROW_HEIGHT = 1.6; // deck height the ring falls from

// Where the lifebuoy lands: over the leeward quarter, clear of the hull.
export function ringDropPoint(boat, tossDist) {
  const fwd = boat.forward(), stb = boat.starboard();
  const windSide = Math.sign(boat.awa) || 1; // + = wind from starboard
  const side = -windSide * (1.3 + tossDist);
  return {
    x: boat.pos.x - fwd.x * 3 + stb.x * side,
    z: boat.pos.z - fwd.z * 3 + stb.z * side,
  };
}

export class MobController {
  // cfg = { throwAfter, tossDist, driftFactor } from the curriculum item.
  constructor(scene, view, cfg) {
    this.scene = scene;
    this.view = view;
    this.cfg = cfg;
    this.state = 'armed'; // armed → throwing → adrift
    this.t = 0;
    this.throwT = 0;
    this.ring = null;
    this._throwY = 0;
    this._wasClose = false;
  }

  dispose() {
    if (this.ring) this.scene.remove(this.ring);
    this.ring = null;
    this.view.setCrewPose('idle');
  }

  update(dt, boat, wind, envTime, ctx) {
    this.t += dt;

    if (this.state === 'armed') {
      // Don't dump the ring on a boat that hasn't started sailing yet.
      if (this.t > this.cfg.throwAfter && boat.speed > 1.5) {
        this.state = 'throwing';
        this.throwT = 0;
      }
    } else if (this.state === 'throwing') {
      this.throwT += dt;
      this.view.setCrewPose('throw', this.throwT / THROW_ANIM);
      if (this.throwT >= THROW_ANIM) {
        this._release(boat);
        this.state = 'adrift';
      }
    } else if (this.ring) {
      // Settle from deck height into the water, then drift downwind at a
      // small fraction of wind speed (real life-ring drift is ~2%).
      const sinceSplash = this.throwT - THROW_ANIM;
      this.throwT += dt;
      const wv = wind.vel();
      this.ring.position.x += wv.x * this.cfg.driftFactor * dt;
      this.ring.position.z += wv.z * this.cfg.driftFactor * dt;
      bobLifeRing(this.ring, envTime);
      if (sinceSplash < SPLASH_TIME) {
        const k = sinceSplash / SPLASH_TIME;
        this.ring.position.y += this._throwY * (1 - k) * (1 - k);
      }
      if (this.throwT > THROW_ANIM + 1.5) this.view.setCrewPose('idle');
    }

    this._fillCtx(boat, wind, ctx);
  }

  _release(boat) {
    const drop = ringDropPoint(boat, this.cfg.tossDist);
    this.ring = makeLifeRing();
    this.ring.position.set(drop.x, 0, drop.z);
    this._throwY = THROW_HEIGHT; // decays to the water over SPLASH_TIME
    this.scene.add(this.ring);
  }

  _fillCtx(boat, wind, ctx) {
    if (!this.ring) {
      ctx.mob = { thrown: false };
      return;
    }
    const m = ctx.mob && ctx.mob.thrown ? ctx.mob : { overshoots: 0, hullStrike: false };
    m.thrown = true;
    Object.assign(m, ringRelation(boat, this.ring.position, wind.dirFrom));

    // A pass close aboard at speed that then opens up again = blown approach.
    if (m.ringDist < 12 && Math.abs(boat.speed) > 1.8) this._wasClose = true;
    if (this._wasClose && m.ringDist > 25) {
      m.overshoots = (m.overshoots || 0) + 1;
      this._wasClose = false;
    }
    // Running the casualty down with way on.
    if (m.ringDist < 1.9 && Math.abs(boat.speed) > 0.8) m.hullStrike = true;
    ctx.mob = m;
  }
}

// Where the ring sits relative to the boat, in the terms the exam scores.
export function ringRelation(boat, ring, windDirFrom) {
  const dx = ring.x - boat.pos.x;
  const dz = ring.z - boat.pos.z;
  const brgTo = Math.atan2(-dx, dz); // compass bearing boat → ring
  const fwd = boat.forward();
  return {
    ringDist: Math.hypot(dx, dz),
    ringRelBearing: wrapPi(brgTo - boat.heading),
    ringFwdOffset: dx * fwd.x + dz * fwd.z, // meters ahead of mid-ship
    // "מעל לרוח": the ring lies toward where the wind comes from.
    ringWindward: Math.abs(wrapPi(brgTo - windDirFrom)) < 80 * DEG,
  };
}

// The exam's final picture: boat standing, ring close aboard in the front
// third of the hull, off the bow sector, to windward.
export function mobPassCondition(boat, ctx) {
  const m = ctx.mob;
  return !!(m && m.thrown &&
    ctx.stoppedFor > 3 &&                       // הספינה עומדת
    m.ringDist > 1.5 && m.ringDist < 8 &&       // boat-hook working range
    m.ringFwdOffset > 1.6 &&                    // שליש קדמי (bow is at +4.9 m)
    Math.abs(m.ringRelBearing) < 70 * DEG &&
    m.ringWindward);                            // המצוף מעל לרוח
}
