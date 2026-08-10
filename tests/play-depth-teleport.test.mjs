import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  findPlayDepthTeleportTarget,
  getPlayDepthMeters,
  getPlayDepthRange,
} from '../src/play-depth-teleport.js';
import { createEmptyMap, getHexCenter } from '../src/map-model.js';

const ROUTE_MAPS = Object.freeze([
  ['descent', '../maps/下沉篇/下沉篇-第1部分.json'],
  ['descent', '../maps/下沉篇/下沉篇-第2部分.json'],
  ['descent', '../maps/下沉篇/下沉篇-第3部分.json'],
  ['ascent', '../maps/上升篇/上升篇-第1部分.json'],
  ['ascent', '../maps/上升篇/上升篇-第2部分.json'],
  ['ascent', '../maps/上升篇/上升篇-第3部分.json'],
]);

function readMap(relativePath) {
  return JSON.parse(readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8'));
}

test('descent depth maps directly to a traversable water row near the current horizontal position', () => {
  const map = createEmptyMap({ width: 9, height: 9 });
  const origin = { x: 36, y: 36 };
  const current = getHexCenter(map.cells['4,4'], origin);
  const target = findPlayDepthTeleportTarget(map, {
    mapArc: 'descent',
    requestedDepth: 6,
    currentX: current.x,
    origin,
  });

  assert.equal(target.ok, true);
  assert.equal(target.depth, 6);
  assert.equal(target.clamped, false);
  assert.equal(map.cells[target.key].terrain, 'water');
  assert.equal(getPlayDepthMeters({ map, mapArc: 'descent', actorY: target.y, origin }), 6);
});

test('ascent depth measures upward from the final row and keeps the same safe-cell contract', () => {
  const map = createEmptyMap({ width: 9, height: 9 });
  const origin = { x: 36, y: 36 };
  const target = findPlayDepthTeleportTarget(map, {
    mapArc: 'ascent',
    requestedDepth: 3,
    currentX: getHexCenter(map.cells['4,4'], origin).x,
    origin,
  });

  assert.equal(target.ok, true);
  assert.equal(target.depth, 3);
  assert.equal(getPlayDepthMeters({ map, mapArc: 'ascent', actorY: target.y, origin }), 3);
});

test('blocked cells are never selected and out-of-range input clamps to the map maximum', () => {
  const map = createEmptyMap({ width: 7, height: 7 });
  const origin = { x: 36, y: 36 };
  const range = getPlayDepthRange(map, origin);
  const preferred = map.cells['3,6'];
  preferred.terrain = 'blocked';
  const preferredCenter = getHexCenter(preferred, origin);
  const target = findPlayDepthTeleportTarget(map, {
    requestedDepth: 9999,
    currentX: preferredCenter.x,
    origin,
  });

  assert.equal(target.ok, true);
  assert.equal(target.depth, range.max);
  assert.equal(target.maxDepth, range.max);
  assert.equal(target.clamped, true);
  assert.notEqual(target.key, '3,6');
  assert.equal(map.cells[target.key].terrain, 'water');
});

test('invalid depth and maps without water return explicit failures', () => {
  const map = createEmptyMap({ width: 5, height: 5 });
  assert.deepEqual(findPlayDepthTeleportTarget(map, { requestedDepth: 'abc' }), { ok: false, error: 'depthMustBeNumber' });
  Object.values(map.cells).forEach((cell) => { cell.terrain = 'blocked'; });
  const result = findPlayDepthTeleportTarget(map, { requestedDepth: 2 });
  assert.equal(result.ok, false);
  assert.equal(result.error, 'noTraversableWater');
});

test('all six formal route maps resolve shallow, middle, and deepest requests to water', () => {
  const origin = { x: 36, y: 36 };
  ROUTE_MAPS.forEach(([mapArc, relativePath]) => {
    const map = readMap(relativePath);
    const range = getPlayDepthRange(map, origin);
    [0, Math.round(range.max / 2), range.max].forEach((requestedDepth) => {
      const target = findPlayDepthTeleportTarget(map, {
        mapArc,
        requestedDepth,
        currentX: origin.x,
        origin,
      });
      assert.equal(target.ok, true, `${relativePath} should resolve ${requestedDepth} m`);
      assert.equal(map.cells[target.key].terrain, 'water', `${relativePath} must never place the player in rock`);
      assert.equal(target.depth, getPlayDepthMeters({ map, mapArc, actorY: target.y, origin }));
    });
  });
});
