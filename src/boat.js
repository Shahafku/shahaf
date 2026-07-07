// boat.js — procedural yacht with live, wind-shaped sails
import * as THREE from '../vendor/three.module.min.js';
import { waveHeight } from './ocean.js';

const MAST_H = 13.5;
const BOOM_LEN = 4.9;
const BOOM_H = 1.55;
const BOW_Z = 4.9;
const STERN_Z = -4.6;

export class BoatView {
  constructor(scene) {
    this.group = new THREE.Group(); // position + yaw
    this.heelGroup = new THREE.Group(); // heel + pitch
    this.group.add(this.heelGroup);
    scene.add(this.group);

    this._buildHull();
    this._buildRig();
    this._buildSails();
    this._buildWake(scene);
    this.time = 0;
  }

  // ---------------------------------------------------------------- Hull
  _buildHull() {
    // Canoe body: lathe a slender teardrop, then squash it into a hull.
    const pts = [];
    const N = 24;
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const y = -4.9 + 9.9 * t; // stern → bow along the lathe axis
      const r = 1.55 * Math.pow(Math.sin(Math.PI * Math.pow(t, 0.72)), 0.85) + 0.001;
      pts.push(new THREE.Vector2(r, y));
    }
    const lathe = new THREE.LatheGeometry(pts, 36);
    const hullMat = new THREE.MeshStandardMaterial({ color: 0xf4f6f8, roughness: 0.35, metalness: 0.05 });
    const hull = new THREE.Mesh(lathe, hullMat);
    hull.rotation.x = Math.PI / 2; // axis along Z, bow to +Z
    hull.scale.set(1.0, 1.0, 0.62); // z-scale here is vertical after rotation
    const hullWrap = new THREE.Group();
    hullWrap.add(hull);
    hullWrap.scale.set(0.92, 1, 1);
    hullWrap.position.y = 0.42;
    this.heelGroup.add(hullWrap);

    // Waterline stripe
    const stripe = new THREE.Mesh(lathe.clone(), new THREE.MeshStandardMaterial({ color: 0x14365c, roughness: 0.4 }));
    stripe.rotation.x = Math.PI / 2;
    stripe.scale.set(1.012, 1.012, 0.62 * 1.012);
    const sw = new THREE.Group();
    sw.add(stripe);
    sw.scale.set(0.92, 1, 1);
    sw.position.y = 0.30;
    // clip visually by lowering: cheap two-tone effect
    this.heelGroup.add(sw);

    // Deck: flattened ellipse
    const deckShape = new THREE.Shape();
    deckShape.moveTo(0, BOW_Z);
    deckShape.bezierCurveTo(1.35, BOW_Z - 2.2, 1.5, -1.5, 1.15, STERN_Z);
    deckShape.lineTo(-1.15, STERN_Z);
    deckShape.bezierCurveTo(-1.5, -1.5, -1.35, BOW_Z - 2.2, 0, BOW_Z);
    const deckGeo = new THREE.ShapeGeometry(deckShape, 24);
    const deck = new THREE.Mesh(
      deckGeo,
      new THREE.MeshStandardMaterial({ color: 0xd9c49a, roughness: 0.8 })
    );
    deck.rotation.x = -Math.PI / 2;
    deck.position.y = 0.88;
    this.heelGroup.add(deck);

    // Cabin
    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 0.5, 2.6),
      new THREE.MeshStandardMaterial({ color: 0xeef1f4, roughness: 0.4 })
    );
    cabin.position.set(0, 1.1, 0.3);
    this.heelGroup.add(cabin);
    const windowMat = new THREE.MeshStandardMaterial({ color: 0x1c2e3f, roughness: 0.15, metalness: 0.4 });
    for (const s of [-1, 1]) {
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.2, 1.9), windowMat);
      win.position.set(0.76 * s, 1.18, 0.3);
      this.heelGroup.add(win);
    }

    // Cockpit coaming (aft)
    const coaming = new THREE.Mesh(
      new THREE.BoxGeometry(1.7, 0.18, 2.2),
      new THREE.MeshStandardMaterial({ color: 0xcbd4da, roughness: 0.6 })
    );
    coaming.position.set(0, 0.95, -2.6);
    this.heelGroup.add(coaming);

    // Helm: wheel pedestal
    const wheel = new THREE.Mesh(
      new THREE.TorusGeometry(0.42, 0.035, 8, 24),
      new THREE.MeshStandardMaterial({ color: 0x8a5a2b, roughness: 0.5 })
    );
    wheel.position.set(0, 1.35, -3.1);
    this.heelGroup.add(wheel);
    this.wheel = wheel;

    // Keel fin + bulb
    const keel = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 1.9, 1.7),
      new THREE.MeshStandardMaterial({ color: 0x8b1e2d, roughness: 0.5 })
    );
    keel.position.set(0, -1.15, 0.1);
    this.heelGroup.add(keel);

    // Rudder blade
    this.rudderMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.09, 1.35, 0.62),
      new THREE.MeshStandardMaterial({ color: 0x8b1e2d, roughness: 0.5 })
    );
    this.rudderMesh.position.set(0, -0.55, STERN_Z + 0.5);
    this.heelGroup.add(this.rudderMesh);
  }

  // ----------------------------------------------------------------- Rig
  _buildRig() {
    const alu = new THREE.MeshStandardMaterial({ color: 0xd7dde2, roughness: 0.35, metalness: 0.55 });
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, MAST_H, 10), alu);
    mast.position.set(0, 0.9 + MAST_H / 2, 1.15);
    this.heelGroup.add(mast);
    this.mastTop = new THREE.Vector3(0, 0.9 + MAST_H, 1.15);

    // Boom pivots at the mast
    this.boomGroup = new THREE.Group();
    this.boomGroup.position.set(0, BOOM_H + 0.9, 1.15);
    this.heelGroup.add(this.boomGroup);
    const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, BOOM_LEN, 8), alu);
    boom.rotation.x = Math.PI / 2;
    boom.position.z = -BOOM_LEN / 2;
    this.boomGroup.add(boom);

    // Standing rigging
    const rigMat = new THREE.LineBasicMaterial({ color: 0x4a4f55, transparent: true, opacity: 0.85 });
    const stay = (a, b) => {
      const g = new THREE.BufferGeometry().setFromPoints([a, b]);
      this.heelGroup.add(new THREE.Line(g, rigMat));
    };
    stay(this.mastTop, new THREE.Vector3(0, 1.0, BOW_Z - 0.1));   // forestay
    stay(this.mastTop, new THREE.Vector3(0, 1.0, STERN_Z + 0.1)); // backstay
    stay(this.mastTop, new THREE.Vector3(1.05, 0.95, 1.1));       // shrouds
    stay(this.mastTop, new THREE.Vector3(-1.05, 0.95, 1.1));

    // Masthead wind vane (windex) — points where the apparent wind comes from
    this.windex = new THREE.Group();
    this.windex.position.copy(this.mastTop).add(new THREE.Vector3(0, 0.35, 0));
    const vane = new THREE.Mesh(
      new THREE.ConeGeometry(0.09, 0.85, 6),
      new THREE.MeshStandardMaterial({ color: 0xff3b30, roughness: 0.4 })
    );
    vane.rotation.x = Math.PI / 2; // cone tip points +Z (local forward)
    vane.position.z = 0.28;
    this.windex.add(vane);
    const tail = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.16, 0.4),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 })
    );
    tail.position.z = -0.35;
    this.windex.add(tail);
    this.heelGroup.add(this.windex);
  }

  // --------------------------------------------------------------- Sails
  _makeSailMesh(rows, cols) {
    const geo = new THREE.BufferGeometry();
    const verts = new Float32Array(rows * cols * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    const idx = [];
    for (let r = 0; r < rows - 1; r++)
      for (let c = 0; c < cols - 1; c++) {
        const a = r * cols + c, b = a + 1, d = a + cols, e = d + 1;
        idx.push(a, d, b, b, d, e);
      }
    geo.setIndex(idx);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xfdfaf1,
      roughness: 0.85,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.97,
      // sailcloth is translucent — keep the shaded side from going charcoal
      emissive: 0xb8b4a6,
      emissiveIntensity: 0.38,
    });
    return new THREE.Mesh(geo, mat);
  }

  _buildSails() {
    this.mainRows = 14; this.mainCols = 8;
    this.main = this._makeSailMesh(this.mainRows, this.mainCols);
    this.boomGroup.add(this.main);

    // Jib pivots at the bow (forestay)
    this.jibGroup = new THREE.Group();
    this.jibGroup.position.set(0, 1.0, BOW_Z - 0.1);
    this.heelGroup.add(this.jibGroup);
    this.jibRows = 12; this.jibCols = 7;
    this.jib = this._makeSailMesh(this.jibRows, this.jibCols);
    this.jibGroup.add(this.jib);
    // Forestay direction in jib-local space (toward masthead)
    this.jibLuff = this.mastTop.clone().sub(this.jibGroup.position); // (0, up, aft)

    this._buildTelltales();
  }

  // Telltales: yarn ribbons on the main leech — they stream aft with clean
  // flow and whip around when the sail is luffing or stalled.
  _buildTelltales() {
    this.telltales = [];
    const mat = new THREE.LineBasicMaterial({ color: 0xe33d2e, linewidth: 2 });
    const SEGS = 3, LEN = 0.85;
    const heights = [0.3, 0.55, 0.78]; // fractions up the leech
    for (const h of heights) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((SEGS + 1) * 3), 3));
      const line = new THREE.Line(geo, mat);
      line.frustumCulled = false;
      this.boomGroup.add(line);
      this.telltales.push({ line, h, segs: SEGS, len: LEN, seed: Math.random() * 10 });
    }
  }

  _updateTelltales(boat, t) {
    // Attachment point: on the leech (aft edge) of the main at height h.
    const H = MAST_H - BOOM_H - 0.2;
    for (const tt of this.telltales) {
      const u = tt.h;
      const chord = BOOM_LEN * Math.pow(1 - u, 0.92);
      const ax = 0, ay = u * H, az = -chord; // leech point in boom-local space
      // Flow state decides the ribbon's shape.
      // Partial luff already unsettles the telltales before the full flog.
      const chaos = Math.max(boat.stalled ? 0.75 : 0.12, boat.luff ?? (boat.luffing ? 1 : 0));
      const pos = tt.line.geometry.attributes.position.array;
      let px = ax, py = ay, pz = az;
      pos[0] = px; pos[1] = py; pos[2] = pz;
      const step = tt.len / tt.segs;
      for (let s = 1; s <= tt.segs; s++) {
        const w1 = Math.sin(t * (14 + 5 * chaos) + tt.seed + s * 1.7) * chaos;
        const w2 = Math.cos(t * 11 + tt.seed * 2 + s * 2.3) * chaos;
        px += w1 * step * 0.9;                 // sideways whip
        py += (w2 * 0.55 - 0.12) * step;       // droop a little, flap a lot
        pz += -step * (1 - 0.55 * chaos);      // stream aft when flow is clean
        pos[s * 3] = px; pos[s * 3 + 1] = py; pos[s * 3 + 2] = pz;
      }
      tt.line.geometry.attributes.position.needsUpdate = true;
    }
  }

  // Reshape a sail grid. luffFn(u)->Vector3 point on the luff, chordFn(u)->length,
  // camber & flap describe belly depth (signed toward ±X) and luff depth 0..1.
  _deformSail(mesh, rows, cols, luffFn, chordFn, camber, flap, t) {
    const pos = mesh.geometry.attributes.position.array;
    // Luffing is progressive, and it starts at the luff: first a soft
    // backwinded bubble right behind the leading edge, then detached flow
    // (flutter) eats aft along the chord until the whole sail flogs.
    const reach = 0.22 + 0.78 * flap;          // chord fraction that lost flow
    const tempo = 13 + 9 * flap;               // ripple → violent flog
    const bubbleAmp = 0.20 * flap * (1 - flap); // backwinding peaks mid-luff
    const bellySign = Math.sign(camber) || 1;
    let i = 0;
    for (let r = 0; r < rows; r++) {
      const u = r / (rows - 1);
      const L = luffFn(u);
      const chord = chordFn(u);
      for (let c = 0; c < cols; c++) {
        const v = c / (cols - 1);
        const belly = Math.sin(Math.PI * v) * camber * chord;
        // Dome over the detached forward section, zero aft of `reach`
        const lw = v >= reach ? 0 : Math.sin((Math.PI * v) / reach);
        const flutter = flap * chord * 0.16 * Math.sin(10 * v + 7 * u - t * tempo) * lw;
        const bubble = -bellySign * bubbleAmp * chord * lw;
        pos[i++] = L.x + belly + bubble + flutter;
        pos[i++] = L.y;
        pos[i++] = L.z - v * chord;
      }
    }
    mesh.geometry.attributes.position.needsUpdate = true;
    mesh.geometry.computeVertexNormals();
  }

  // ---------------------------------------------------------------- Wake
  _buildWake(scene) {
    const N = 240;
    this.wakeN = N;
    const g = new THREE.BufferGeometry();
    this.wakePos = new Float32Array(N * 3);
    this.wakeLife = new Float32Array(N); // 0 = dead
    this.wakeAge = new Float32Array(N);
    g.setAttribute('position', new THREE.BufferAttribute(this.wakePos, 3));
    g.setAttribute('aLife', new THREE.BufferAttribute(this.wakeAge, 1));
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {},
      vertexShader: `
        attribute float aLife;
        varying float vA;
        void main() {
          vA = aLife;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = (140.0 / -mv.z) * (1.2 + (1.0 - aLife) * 3.0);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        varying float vA;
        void main() {
          vec2 p = gl_PointCoord - 0.5;
          float d = smoothstep(0.5, 0.05, length(p));
          gl_FragColor = vec4(0.92, 0.97, 1.0, d * vA * 0.5);
        }`,
    });
    this.wake = new THREE.Points(g, mat);
    this.wake.frustumCulled = false;
    scene.add(this.wake);
    this._wakeCursor = 0;
    this._wakeAccum = 0;
  }

  _spawnWake(worldX, worldZ, spread) {
    const i = this._wakeCursor;
    this._wakeCursor = (i + 1) % this.wakeN;
    this.wakePos[i * 3] = worldX + (Math.random() - 0.5) * spread;
    this.wakePos[i * 3 + 1] = 0.12;
    this.wakePos[i * 3 + 2] = worldZ + (Math.random() - 0.5) * spread;
    this.wakeLife[i] = 1;
    this.wakeAge[i] = 1;
  }

  // --------------------------------------------------------------- Update
  update(dt, boat, wind, envTime) {
    this.time += dt;
    const t = this.time;

    // Position on the waves + a touch of bob
    const wy = waveHeight(boat.pos.x, boat.pos.z, envTime);
    this.group.position.set(boat.pos.x, wy * 0.55, boat.pos.z);
    // Compass heading h → world forward (-sin h, cos h) = three.js yaw of -h.
    this.group.rotation.y = -boat.heading;

    // Heel (+heel = leans to starboard = local -X down = positive rot.z)
    // Pitch from wave slope fore/aft.
    const f = boat.forward();
    const ahead = waveHeight(boat.pos.x + f.x * 4, boat.pos.z + f.z * 4, envTime);
    const astern = waveHeight(boat.pos.x - f.x * 4, boat.pos.z - f.z * 4, envTime);
    const pitch = (astern - ahead) * 0.09 + boat.speed * 0.004;
    this.heelGroup.rotation.z = boat.heel;
    this.heelGroup.rotation.x = pitch;

    // Rudder & wheel
    this.rudderMesh.rotation.y = boat.rudder * 0.6;
    this.wheel.rotation.z = -boat.rudder * 2.2;

    // Boom: physics +boom = starboard; rotation.y = +θ swings the aft-pointing
    // tip (local -Z) to local -X = visual starboard.
    this.boomGroup.rotation.y = boat.boom;

    // Windex points into the apparent wind (boat frame): rotate local +Z to AWA
    this.windex.rotation.y = -boat.awa;

    // Sail shapes
    // Flap depth follows the physics' continuous luff fraction (0 = drawing
    // cleanly, 1 = fully flogging); head-to-wind always flogs completely.
    const luffTarget = Math.max(boat.luff ?? (boat.luffing ? 1 : 0), Math.abs(boat.awa) < 0.15 ? 1 : 0);
    this._flap = (this._flap ?? 0) + (luffTarget - (this._flap ?? 0)) * Math.min(1, 6 * dt);
    const flap = this._flap;
    const boomSign = Math.sign(boat.boom) || 1; // + = boom carried to starboard
    // Sail bellies to leeward (the side the boom is on). +boom sweeps the tip
    // toward local -X, so the belly offset in boom-local X is -sign(boom).
    const bellySide = -boomSign;
    const power = Math.min(1, boat.coef);
    const camberMain = bellySide * (0.06 + 0.10 * power) * (1 - flap * 0.9);

    this._deformSail(
      this.main, this.mainRows, this.mainCols,
      (u) => new THREE.Vector3(0, u * (MAST_H - BOOM_H - 0.2), 0),
      (u) => BOOM_LEN * Math.pow(1 - u, 0.92) + 0.001,
      camberMain, flap, t
    );

    // Jib: swings a little wider than the main, same side
    const jibAngle = Math.min(Math.abs(boat.boom) * 1.06 + 0.06, 1.5) * boomSign;
    this.jibGroup.rotation.y = jibAngle;
    const JH = this.jibLuff.y * 0.94, JAFT = -this.jibLuff.z; // luff rises & goes aft
    this._deformSail(
      this.jib, this.jibRows, this.jibCols,
      (u) => new THREE.Vector3(0, u * JH, -u * JAFT * 0.9),
      (u) => 3.4 * Math.pow(1 - u, 1.0) + 0.001,
      bellySide * (0.07 + 0.11 * power) * (1 - flap * 0.9), flap, t + 0.7
    );

    this._updateTelltales(boat, t);

    // Wake spawning ∝ speed
    this._wakeAccum += dt * Math.min(28, Math.abs(boat.speed) * 9);
    const stern = {
      x: boat.pos.x - f.x * 4.6,
      z: boat.pos.z - f.z * 4.6,
    };
    while (this._wakeAccum > 1) {
      this._wakeAccum -= 1;
      this._spawnWake(stern.x, stern.z, 1.6);
    }
    for (let i = 0; i < this.wakeN; i++) {
      if (this.wakeLife[i] > 0) {
        this.wakeLife[i] -= dt / 3.2;
        this.wakeAge[i] = Math.max(0, this.wakeLife[i]);
      }
    }
    this.wake.geometry.attributes.position.needsUpdate = true;
    this.wake.geometry.attributes.aLife.needsUpdate = true;
  }
}
