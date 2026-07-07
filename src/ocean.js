// ocean.js — water, sky, sun and buoys for Sail Trainer 3D
import * as THREE from '../vendor/three.module.min.js';

// Shared wave set (world-space) so the CPU can replicate heights for the boat.
export const WAVES = [
  { dir: [1.0, 0.35], amp: 0.22, len: 23.0, speed: 1.15 },
  { dir: [0.55, 1.0], amp: 0.14, len: 11.0, speed: 1.6 },
  { dir: [-0.8, 0.6], amp: 0.07, len: 5.5, speed: 2.2 },
];

export function waveHeight(x, z, t) {
  let y = 0;
  for (const w of WAVES) {
    const k = (Math.PI * 2) / w.len;
    const d = (x * w.dir[0] + z * w.dir[1]) / Math.hypot(w.dir[0], w.dir[1]);
    y += w.amp * Math.sin(d * k + t * w.speed);
  }
  return y;
}

const WATER_VERT = /* glsl */ `
uniform float uTime;
varying vec3 vWorld;
varying vec3 vNormal;
varying float vCrest;

vec3 waveNDH(vec2 p, vec2 dir, float amp, float len, float speed, float t) {
  float k = 6.28318 / len;
  vec2 d = normalize(dir);
  float ph = dot(p, d) * k + t * speed;
  // returns (dh/dx, dh/dz, h)
  return vec3(-d.x * amp * k * cos(ph), -d.y * amp * k * cos(ph), amp * sin(ph));
}

void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vec2 p = wp.xz;
  vec3 acc = vec3(0.0);
  acc += waveNDH(p, vec2(1.0, 0.35), 0.22, 23.0, 1.15, uTime);
  acc += waveNDH(p, vec2(0.55, 1.0), 0.14, 11.0, 1.6, uTime);
  acc += waveNDH(p, vec2(-0.8, 0.6), 0.07, 5.5, 2.2, uTime);
  // fine ripples for sparkle
  acc += waveNDH(p, vec2(0.9, -0.4), 0.025, 2.1, 3.4, uTime);
  acc += waveNDH(p, vec2(-0.2, -1.0), 0.02, 1.3, 4.1, uTime);
  wp.y += acc.z;
  vCrest = acc.z;
  vNormal = normalize(vec3(acc.x, 1.0, acc.y));
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const WATER_FRAG = /* glsl */ `
uniform vec3 uSunDir;
uniform vec3 uDeep;
uniform vec3 uShallow;
uniform vec3 uSky;
uniform vec3 uCamPos;
uniform float uTime;
varying vec3 vWorld;
varying vec3 vNormal;
varying float vCrest;

void main() {
  vec3 N = normalize(vNormal);
  vec3 V = normalize(uCamPos - vWorld);
  float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
  fres = mix(0.06, 0.75, fres);

  vec3 base = mix(uDeep, uShallow, clamp(vCrest * 1.4 + 0.45, 0.0, 1.0));
  vec3 col = mix(base, uSky, fres);

  // sun glitter
  vec3 L = normalize(uSunDir);
  vec3 H = normalize(L + V);
  float spec = pow(max(dot(N, H), 0.0), 220.0) * 1.4;
  spec += pow(max(dot(N, H), 0.0), 40.0) * 0.18;
  col += vec3(1.0, 0.95, 0.82) * spec;

  // faint foam on crests
  float foam = smoothstep(0.30, 0.44, vCrest);
  col = mix(col, vec3(0.92, 0.97, 1.0), foam * 0.35);

  // distance haze toward sky color
  float dist = length(uCamPos - vWorld);
  col = mix(col, uSky, smoothstep(220.0, 850.0, dist));

  gl_FragColor = vec4(col, 1.0);
}
`;

const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww; // pin to far plane
}
`;

const SKY_FRAG = /* glsl */ `
uniform vec3 uSunDir;
varying vec3 vDir;
void main() {
  float h = clamp(vDir.y, -0.1, 1.0);
  vec3 zenith  = vec3(0.16, 0.42, 0.78);
  vec3 horizon = vec3(0.78, 0.88, 0.96);
  vec3 low     = vec3(0.93, 0.94, 0.96);
  vec3 col = mix(horizon, zenith, pow(max(h, 0.0), 0.62));
  col = mix(low, col, smoothstep(-0.08, 0.08, h));
  float s = max(dot(normalize(vDir), normalize(uSunDir)), 0.0);
  col += vec3(1.0, 0.9, 0.7) * pow(s, 350.0) * 1.6; // sun disc
  col += vec3(1.0, 0.85, 0.6) * pow(s, 18.0) * 0.22; // halo
  gl_FragColor = vec4(col, 1.0);
}
`;

export class Environment {
  constructor(scene) {
    this.time = 0;
    this.sunDir = new THREE.Vector3(-0.55, 0.42, 0.72).normalize();
    this.skyColor = new THREE.Color(0.62, 0.78, 0.92);

    // --- Sky dome
    this.sky = new THREE.Mesh(
      new THREE.SphereGeometry(900, 32, 16),
      new THREE.ShaderMaterial({
        vertexShader: SKY_VERT,
        fragmentShader: SKY_FRAG,
        uniforms: { uSunDir: { value: this.sunDir } },
        side: THREE.BackSide,
        depthWrite: false,
      })
    );
    scene.add(this.sky);

    // --- Water
    this.waterUniforms = {
      uTime: { value: 0 },
      uSunDir: { value: this.sunDir },
      uDeep: { value: new THREE.Color('#0b3d5c') },
      uShallow: { value: new THREE.Color('#14688f') },
      uSky: { value: this.skyColor },
      uCamPos: { value: new THREE.Vector3() },
    };
    this.water = new THREE.Mesh(
      new THREE.PlaneGeometry(1700, 1700, 196, 196),
      new THREE.ShaderMaterial({
        vertexShader: WATER_VERT,
        fragmentShader: WATER_FRAG,
        uniforms: this.waterUniforms,
      })
    );
    this.water.rotation.x = -Math.PI / 2;
    scene.add(this.water);

    // --- Lights
    const sun = new THREE.DirectionalLight(0xfff2df, 2.6);
    sun.position.copy(this.sunDir).multiplyScalar(300);
    scene.add(sun);
    scene.add(new THREE.HemisphereLight(0xbfd9ee, 0x0c3a55, 0.85));

    // --- Clouds: a few soft billboards
    this.clouds = new THREE.Group();
    const cloudTex = makeCloudTexture();
    for (let i = 0; i < 14; i++) {
      const m = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: cloudTex, transparent: true, opacity: 0.8, depthWrite: false })
      );
      const a = Math.random() * Math.PI * 2;
      const r = 380 + Math.random() * 320;
      m.position.set(Math.sin(a) * r, 60 + Math.random() * 90, Math.cos(a) * r);
      const s = 90 + Math.random() * 150;
      m.scale.set(s, s * (0.28 + Math.random() * 0.2), 1);
      this.clouds.add(m);
    }
    scene.add(this.clouds);

    scene.fog = new THREE.Fog(this.skyColor.getHex(), 350, 900);
  }

  update(dt, camera, focus) {
    this.time += dt;
    this.waterUniforms.uTime.value = this.time;
    this.waterUniforms.uCamPos.value.copy(camera.position);
    // Keep the ocean & sky centred on the action (procedural waves are
    // world-space so the plane can slide invisibly).
    this.water.position.set(focus.x, 0, focus.z);
    this.sky.position.set(camera.position.x, 0, camera.position.z);
    this.clouds.position.set(focus.x, 0, focus.z);
  }
}

function makeCloudTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const blob = (x, y, r, a) => {
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, `rgba(255,255,255,${a})`);
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 128, 128);
  };
  blob(64, 70, 46, 0.85);
  blob(40, 76, 30, 0.7);
  blob(90, 74, 32, 0.7);
  blob(58, 58, 26, 0.6);
  const tex = new THREE.CanvasTexture(c);
  return tex;
}

// ------------------------------------------------------- Wind streaks
// Faint streaks that drift with the true wind just above the water, so the
// player can SEE the breeze and its shifts.
export class WindStreaks {
  constructor(scene, count = 90) {
    this.count = count;
    this.range = 220; // box half-size around the focus point
    const pos = new Float32Array(count * 2 * 3);
    this.head = new Float32Array(count * 2); // per-streak x,z head position
    this.phase = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      this.head[i * 2] = (Math.random() * 2 - 1) * this.range;
      this.head[i * 2 + 1] = (Math.random() * 2 - 1) * this.range;
      this.phase[i] = Math.random() * Math.PI * 2;
    }
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.lines = new THREE.LineSegments(
      this.geo,
      new THREE.LineBasicMaterial({ color: 0xdfeefb, transparent: true, opacity: 0.34, depthWrite: false })
    );
    this.lines.frustumCulled = false;
    scene.add(this.lines);
  }

  update(dt, wind, focus, t) {
    const v = wind.vel();
    const len = Math.min(9, 1.2 + wind.speed * 0.55); // streak length ~ wind speed
    const nx = v.x / (wind.speed || 1), nz = v.z / (wind.speed || 1);
    const pos = this.geo.attributes.position.array;
    const R = this.range;
    for (let i = 0; i < this.count; i++) {
      let hx = this.head[i * 2] + v.x * dt * 1.35;
      let hz = this.head[i * 2 + 1] + v.z * dt * 1.35;
      // wrap inside the box around the focus
      if (hx > R) hx -= 2 * R; else if (hx < -R) hx += 2 * R;
      if (hz > R) hz -= 2 * R; else if (hz < -R) hz += 2 * R;
      this.head[i * 2] = hx;
      this.head[i * 2 + 1] = hz;
      const wx = focus.x + hx, wz = focus.z + hz;
      const y = waveHeight(wx, wz, t) + 0.32 + 0.1 * Math.sin(t * 2 + this.phase[i]);
      const j = i * 6;
      pos[j] = wx; pos[j + 1] = y; pos[j + 2] = wz;
      pos[j + 3] = wx - nx * len; pos[j + 4] = y + 0.05; pos[j + 5] = wz - nz * len;
    }
    this.geo.attributes.position.needsUpdate = true;
  }
}

// ------------------------------------------------------------------- Buoys
export function makeBuoy(color = 0xff5a1f) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.1 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.75, 1.5, 16), mat);
  body.position.y = 0.4;
  g.add(body);
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.9, 12), mat);
  cone.position.y = 1.55;
  g.add(cone);
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.4, 6), poleMat);
  pole.position.y = 2.6;
  g.add(pole);
  const flag = new THREE.Mesh(
    new THREE.PlaneGeometry(1.1, 0.65),
    new THREE.MeshStandardMaterial({ color: 0xffe14d, side: THREE.DoubleSide })
  );
  flag.position.set(0.55, 3.4, 0);
  g.add(flag);
  g.userData.flag = flag;

  // Target ring on the water
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(7.2, 8.8, 48),
    new THREE.MeshBasicMaterial({ color: 0x7dffb5, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.15;
  g.add(ring);
  g.userData.ring = ring;
  return g;
}

// A lifebuoy (גלגל הצלה) adrift for the man-overboard exercises: orange torus
// with white grab bands, a small strobe, and a pulsing marker ring like the
// course buoys (it stands in for a dan buoy's real-world visibility).
export function makeLifeRing() {
  const g = new THREE.Group();
  const orange = new THREE.MeshStandardMaterial({ color: 0xff5a1f, roughness: 0.55 });
  const torus = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.14, 10, 28), orange);
  torus.rotation.x = -Math.PI / 2;
  g.add(torus);
  const white = new THREE.MeshStandardMaterial({ color: 0xf4f6f8, roughness: 0.55 });
  for (let i = 0; i < 4; i++) {
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.3, 0.3), white);
    const a = i * Math.PI / 2 + Math.PI / 4;
    band.position.set(Math.cos(a) * 0.45, 0, Math.sin(a) * 0.45);
    band.rotation.y = -a;
    g.add(band);
  }
  const strobe = new THREE.Mesh(
    new THREE.SphereGeometry(0.09, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xaefcff })
  );
  strobe.position.y = 0.22;
  g.add(strobe);
  g.userData.strobe = strobe;

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(2.6, 3.4, 48),
    new THREE.MeshBasicMaterial({ color: 0xffb14f, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.1;
  g.add(ring);
  g.userData.ring = ring;
  return g;
}

export function bobLifeRing(ring, t) {
  const { x, z } = ring.position;
  ring.position.y = waveHeight(x, z, t) + 0.05;
  ring.rotation.x = 0.10 * Math.sin(t * 1.3 + x);
  ring.rotation.z = 0.10 * Math.cos(t * 1.05 + z);
  ring.userData.strobe.material.color.setHex(Math.sin(t * 7) > 0.4 ? 0xaefcff : 0x2a4a52);
  const m = ring.userData.ring;
  const s = 1 + 0.1 * Math.sin(t * 2.6);
  m.scale.set(s, s, 1);
  m.material.opacity = 0.35 + 0.2 * Math.sin(t * 2.6);
}

export function bobBuoy(buoy, t, windDirFrom) {
  const { x, z } = buoy.position;
  buoy.position.y = waveHeight(x, z, t) - 0.15;
  buoy.rotation.x = 0.06 * Math.sin(t * 1.1 + x);
  buoy.rotation.z = 0.06 * Math.cos(t * 0.9 + z);
  buoy.userData.flag.rotation.y = -windDirFrom - buoy.rotation.y + Math.PI / 2 + 0.25 * Math.sin(t * 6 + x);
  const ring = buoy.userData.ring;
  const s = 1 + 0.08 * Math.sin(t * 2.2);
  ring.scale.set(s, s, 1);
  ring.material.opacity = 0.35 + 0.2 * Math.sin(t * 2.2);
}
