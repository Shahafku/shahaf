import test from 'node:test';
import assert from 'node:assert/strict';

import { LESSONS, TESTS } from '../src/curriculum.js';
import {
  SEA_STATES,
  getSeaState,
  sampleWaveHeight,
  sampleWaveSlope,
} from '../src/sea-state.js';
import {
  COAST_LOCATIONS,
  geoToLocalMetres,
  locationSummary,
} from '../src/coast-data.js';
import * as THREE from '../vendor/three.module.min.js';
import { CoastScene, sampleTerrainHeight } from '../src/coast.js';
import {
  MIN_DISPLACED_WAVELENGTH,
  NEAR_WATER_SEGMENTS,
  NEAR_WATER_SIZE,
  WindStreaks,
} from '../src/ocean.js';

test('every lesson and test names a valid coast and sea state', () => {
  for (const item of [...LESSONS, ...TESTS]) {
    assert.ok(item.environment, `${item.id} is missing environment`);
    assert.ok(COAST_LOCATIONS[item.environment.locationId], `${item.id} has unknown coast`);
    assert.ok(SEA_STATES[item.environment.seaState], `${item.id} has unknown sea state`);
  }
});

test('curriculum uses the approved environment assignments', () => {
  const expected = {
    course: ['tel-aviv', 'calm'], upwind: ['haifa', 'small'], tack: ['haifa', 'small'],
    gybe: ['bat-yam', 'small'], 'mob-easy': ['tel-aviv', 'calm'],
    'mob-med': ['netanya', 'small'], 'mob-hard': ['netanya', 'choppy'],
    free: ['tel-aviv', 'small'], 't-course': ['tel-aviv', 'calm'],
    't-tack': ['haifa', 'small'], 't-gybe': ['bat-yam', 'small'],
    't-mob': ['netanya', 'small'], 't-beat': ['haifa', 'small'],
    't-triangle': ['bat-yam', 'choppy'],
  };
  for (const item of [...LESSONS, ...TESTS]) {
    assert.deepEqual(
      [item.environment.locationId, item.environment.seaState],
      expected[item.id],
      item.id,
    );
  }
});

test('sea presets share wave math while increasing surface motion', () => {
  assert.equal(getSeaState('missing').id, 'small');
  const sample = (id) => {
    let total = 0;
    for (let i = 0; i < 40; i++) total += Math.abs(sampleWaveHeight(id, 17, -9, i * 0.17));
    return total;
  };
  assert.ok(sample('calm') < sample('small'));
  assert.ok(sample('small') < sample('choppy'));
  const slope = sampleWaveSlope('choppy', 12, 23, 4);
  assert.ok(Number.isFinite(slope.x) && Number.isFinite(slope.z));
});

test('geographic conversion follows the simulator compass axes', () => {
  const origin = { lat: 32, lon: 34 };
  const east = geoToLocalMetres(32, 34.01, origin);
  const north = geoToLocalMetres(32.01, 34, origin);
  assert.ok(east.x < -900 && Math.abs(east.z) < 1);
  assert.ok(north.z > 1100 && Math.abs(north.x) < 1);
});

test('packaged coast assets contain sourced geometry and useful labels', () => {
  for (const id of ['tel-aviv', 'haifa', 'bat-yam', 'netanya']) {
    const location = COAST_LOCATIONS[id];
    assert.ok(location.coastline.length >= 8, `${id} coastline`);
    assert.ok(location.terrain.heights.length >= 25, `${id} terrain`);
    assert.ok(location.buildings.length >= 5, `${id} buildings`);
    assert.match(locationSummary(id, 'small'), new RegExp(location.name));
    assert.match(locationSummary(id, 'small'), /Small waves/);
  }
});

test('coast scene reuses the active setting and replaces old scenery cleanly', () => {
  const scene = new THREE.Scene();
  const coast = new CoastScene(scene);
  const telAviv = coast.setLocation('tel-aviv');
  assert.equal(coast.locationId, 'tel-aviv');
  assert.ok(telAviv.children.length > 2);
  assert.equal(coast.setLocation('tel-aviv'), telAviv);
  const haifa = coast.setLocation('haifa');
  assert.notEqual(haifa, telAviv);
  assert.equal(scene.children.includes(telAviv), false);
  assert.equal(scene.children.filter((child) => child.userData.coastScene).length, 1);
  coast.dispose();
  assert.equal(scene.children.filter((child) => child.userData.coastScene).length, 0);
});

test('coastal buildings sit on the packaged terrain surface', () => {
  const scene = new THREE.Scene();
  const coast = new CoastScene(scene);
  const group = coast.setLocation('haifa');
  const panorama = group.getObjectByName('Panorama Tower');
  assert.ok(panorama, 'named Haifa landmark is rendered');
  const building = panorama.userData.sourceBuilding;
  const ground = sampleTerrainHeight(COAST_LOCATIONS.haifa, building.x, building.z);
  assert.ok(ground > 100, 'landmark is on Haifa hillside terrain');
  assert.equal(panorama.position.y, ground + building.h / 2);
  assert.ok(panorama.position.y + building.h / 2 > ground);
});

test('near water geometry resolves every displaced wave', () => {
  assert.ok(
    NEAR_WATER_SIZE / NEAR_WATER_SEGMENTS <= MIN_DISPLACED_WAVELENGTH / 2,
    'vertex spacing must meet the Nyquist limit for displaced waves',
  );
});

test('wind streaks use the increased density in every activity', () => {
  const streaks = new WindStreaks(new THREE.Scene());
  assert.equal(streaks.count, 138);
  assert.equal(streaks.geo.attributes.position.array.length, 138 * 6);
});
