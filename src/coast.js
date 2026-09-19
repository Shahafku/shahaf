// coast.js — fixed, low-detail offshore scenery built from packaged GIS data.
import * as THREE from '../vendor/three.module.min.js';
import { COAST_LOCATIONS } from './coast-data.js';

function coastlineXAt(location, z) {
  const points = location.coastline;
  if (z <= points[0][1]) return points[0][0];
  if (z >= points[points.length - 1][1]) return points[points.length - 1][0];
  for (let i = 1; i < points.length; i++) {
    if (z <= points[i][1]) {
      const a = points[i - 1], b = points[i];
      const t = (z - a[1]) / (b[1] - a[1] || 1);
      return a[0] + (b[0] - a[0]) * t;
    }
  }
  return points[points.length - 1][0];
}

export function sampleTerrainHeight(location, x, z) {
  const t = location.terrain;
  const gridX = Math.max(0, Math.min(t.cols - 1, (x - t.originX) / t.stepX));
  const gridZ = Math.max(0, Math.min(t.rows - 1, (z - t.originZ) / t.stepZ));
  const col = Math.min(t.cols - 2, Math.floor(gridX));
  const row = Math.min(t.rows - 2, Math.floor(gridZ));
  const fx = gridX - col;
  const fz = gridZ - row;
  const at = (r, c) => Math.max(0.35, t.heights[r * t.cols + c]);
  const h00 = at(row, col), h10 = at(row, col + 1);
  const h01 = at(row + 1, col), h11 = at(row + 1, col + 1);
  // Match BufferGeometry's two triangles so buildings meet the rendered slope.
  if (fx >= fz) return h00 + (h10 - h00) * fx + (h11 - h10) * fz;
  return h00 + (h11 - h01) * fx + (h01 - h00) * fz;
}

function terrainGeometry(location) {
  const t = location.terrain;
  const positions = [], indices = [];
  for (let row = 0; row < t.rows - 1; row++) {
    for (let col = 0; col < t.cols - 1; col++) {
      const x = t.originX + col * t.stepX;
      const z = t.originZ + row * t.stepZ;
      if (x + t.stepX * 0.5 < coastlineXAt(location, z + t.stepZ * 0.5)) continue;
      const base = positions.length / 3;
      const at = (r, c) => Math.max(0.35, t.heights[r * t.cols + c]);
      positions.push(
        x, at(row, col), z,
        x + t.stepX, at(row, col + 1), z,
        x + t.stepX, at(row + 1, col + 1), z + t.stepZ,
        x, at(row + 1, col), z + t.stepZ,
      );
      indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function shoreGeometry(location) {
  const points = location.coastline;
  const vertices = points.map(([x, z]) => new THREE.Vector2(x, z));
  vertices.push(new THREE.Vector2(7000, points[points.length - 1][1]));
  vertices.push(new THREE.Vector2(7000, points[0][1]));
  const faces = THREE.ShapeUtils.triangulateShape(vertices, []);
  const positions = vertices.flatMap((p) => [p.x, 0.2, p.y]);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(faces.flat());
  geometry.computeVertexNormals();
  return geometry;
}

function disposeTree(root) {
  root.traverse((object) => {
    object.geometry?.dispose();
    if (Array.isArray(object.material)) object.material.forEach((m) => m.dispose());
    else object.material?.dispose();
  });
}

export class CoastScene {
  constructor(scene) {
    this.scene = scene;
    this.group = null;
    this.locationId = null;
  }

  setLocation(id) {
    const location = COAST_LOCATIONS[id] ?? COAST_LOCATIONS['tel-aviv'];
    if (this.group && this.locationId === location.id) return this.group;
    this.dispose();
    this.locationId = location.id;
    const group = new THREE.Group();
    group.name = `Coast · ${location.name}`;
    group.userData.coastScene = true;
    // Packaged GIS assets use an east-positive working frame. The simulator's
    // compass convention maps east (090°) to world -X.
    group.scale.x = -1;

    const beach = new THREE.Mesh(
      shoreGeometry(location),
      new THREE.MeshLambertMaterial({ color: 0xd5c18d, side: THREE.DoubleSide, fog: false }),
    );
    beach.renderOrder = -1;
    group.add(beach);

    const terrain = new THREE.Mesh(
      terrainGeometry(location),
      new THREE.MeshBasicMaterial({ color: location.id === 'haifa' ? 0x718b66 : 0x91a275, side: THREE.DoubleSide, fog: false }),
    );
    group.add(terrain);

    const shorePoints = location.coastline.map(([x, z]) => new THREE.Vector3(x, 1.2, z));
    group.add(new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(shorePoints),
      new THREE.LineBasicMaterial({ color: 0xf1dfaa, transparent: true, opacity: 0.9, fog: false }),
    ));

    const buildingMaterial = new THREE.MeshBasicMaterial({ color: 0xaab4ba, fog: false });
    const towerMaterial = new THREE.MeshBasicMaterial({ color: 0xc2cbd0, fog: false });
    for (const building of location.buildings) {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(building.w, building.h, building.d),
        building.h >= 60 ? towerMaterial : buildingMaterial,
      );
      const ground = sampleTerrainHeight(location, building.x, building.z);
      mesh.position.set(building.x, ground + building.h / 2, building.z);
      mesh.userData.sourceBuilding = building;
      mesh.userData.groundElevation = ground;
      if (building.name) mesh.name = building.name;
      group.add(mesh);
    }

    this.group = group;
    this.scene.add(group);
    return group;
  }

  dispose() {
    if (!this.group) return;
    this.scene.remove(this.group);
    disposeTree(this.group);
    this.group = null;
    this.locationId = null;
  }
}
