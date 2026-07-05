// traffic.js — an AI yacht sailing a fixed circuit in Free Sail, used to
// practice COLREGs Rule 12 (who stands on, who keeps clear).
import { Boat, DEG, wrapPi, clamp } from './physics.js';
import { BoatView } from './boat.js';

// Diamond circuit: every leg is a sailable reach for wind from the north.
const CIRCUIT = [
  { x: 190, z: 0 },
  { x: 0, z: 150 },
  { x: -190, z: 0 },
  { x: 0, z: -150 },
];

export class TrafficBoat {
  constructor(scene) {
    this.boat = new Boat();
    this.boat.autoTrim = true;
    this.view = new BoatView(scene);
    // Tan sails so the player can tell the boats apart at a glance.
    for (const sail of [this.view.main, this.view.jib]) {
      sail.material = sail.material.clone();
      sail.material.color.set(0xe8d9b8);
    }
    this.active = false;
    this.wpIdx = 0;
    this._setVisible(false);
    this._reset();
  }

  // Circuit corners rotate with the base wind so every leg stays a reach.
  _wp(i, wind) {
    const w = wind ? wind.baseDirFrom : 0;
    const c = Math.cos(w), s = Math.sin(w);
    const p = CIRCUIT[i % CIRCUIT.length];
    return { x: p.x * c + p.z * s, z: -p.x * s + p.z * c };
  }

  _reset(wind) {
    const p0 = this._wp(0, wind);
    this.boat.pos.x = p0.x;
    this.boat.pos.z = p0.z;
    this.wpIdx = 1;
    this.boat.heading = (wind ? wind.baseDirFrom : 0) - 45 * DEG;
    this.boat.speed = 2.5;
  }

  _setVisible(v) {
    this.view.group.visible = v;
    this.view.wake.visible = v;
  }

  setActive(v, wind) {
    if (v === this.active) return;
    this.active = v;
    this._setVisible(v);
    if (v) this._reset(wind);
  }

  // Returns a Rule 12 advisory ({text, urgent}) or null.
  update(dt, wind, player, envTime) {
    if (!this.active) return null;
    const b = this.boat;

    // Autopilot: steer for the next circuit corner.
    const wp = this._wp(this.wpIdx, wind);
    const dx = wp.x - b.pos.x, dz = wp.z - b.pos.z;
    if (Math.hypot(dx, dz) < 28) this.wpIdx = (this.wpIdx + 1) % CIRCUIT.length;
    const brg = Math.atan2(dx, dz);
    b.rudder = clamp(wrapPi(brg - b.heading) * 1.6, -1, 1);
    // Never park in irons: if pinched and slow, bear away to leeward first.
    if (Math.abs(b.twa) < 40 * DEG && b.speed < 1.0) b.rudder = b.twa >= 0 ? -1 : 1;
    b.update(dt, wind);
    this.view.update(dt, b, wind, envTime);

    // ---- Rule 12 assessment --------------------------------------------
    const px = player.pos.x - b.pos.x, pz = player.pos.z - b.pos.z;
    const dist = Math.hypot(px, pz);
    if (dist > 150) return null;

    const playerStbd = player.twa >= 0; // wind over starboard side
    const trafficStbd = b.twa >= 0;
    const m = Math.round(dist);
    let text, playerGivesWay;
    if (playerStbd !== trafficStbd) {
      playerGivesWay = !playerStbd; // port tack keeps clear (Rule 12a-i)
      text = playerGivesWay
        ? `⚠️ <b>Rule 12:</b> tan boat ${m} m away is on <b>starboard tack</b> — you are on port. <b>You keep clear</b>: bear away behind her or tack.`
        : `✔ <b>Rule 12:</b> you are on <b>starboard tack</b>, the tan boat (${m} m) is on port — <b>you stand on</b>: hold course and speed.`;
    } else {
      // Same tack: the windward boat keeps clear (Rule 12a-ii).
      const wdx = Math.sin(wind.dirFrom), wdz = Math.cos(wind.dirFrom);
      const playerIsWindward = px * wdx + pz * wdz > 0;
      playerGivesWay = playerIsWindward;
      text = playerGivesWay
        ? `⚠️ <b>Rule 12:</b> same tack, and you are the <b>windward</b> boat (${m} m) — <b>you keep clear</b> of the leeward boat.`
        : `✔ <b>Rule 12:</b> same tack and you are <b>leeward</b> (${m} m) — <b>you stand on</b>.`;
    }
    return { text, urgent: playerGivesWay && dist < 90 };
  }
}
