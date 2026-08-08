import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { validateMap } from '../src/map-model.js';

const mapsDirectory = join(process.cwd(), 'maps', '下沉篇');
const mapNames = [
  '下沉篇-第1部分.json',
  '下沉篇-第2部分.json',
  '下沉篇-第3部分.json',
];

function loadMap(name) {
  return JSON.parse(readFileSync(join(mapsDirectory, name), 'utf8'));
}

test('generated descent maps are valid and intentionally omit spawn points', () => {
  mapNames.forEach((name) => {
    const map = loadMap(name);
    const errors = validateMap(map).filter((result) => result.level === 'error');
    assert.equal(errors.length, 0, `${name}: ${errors.map((result) => result.message).join('; ')}`);
    assert.equal(Object.values(map.cells).some((cell) => cell.actors.length > 0), false, `${name} should not contain a spawn point`);
  });
});

test('descent maps form a deliberate difficulty ladder from part 1 to part 3', () => {
  const maps = mapNames.map(loadMap);
  const stats = maps.map((map) => ({
    blocked: Object.values(map.cells).filter((cell) => cell.terrain === 'blocked').length,
    objects: Object.values(map.cells).reduce((sum, cell) => sum + cell.freeObjects.length, 0),
    edgeTypes: new Set(Object.values(map.edges).map((edge) => edge.type)),
  }));
  assert.ok(stats[0].blocked < stats[1].blocked && stats[1].blocked < stats[2].blocked);
  assert.ok(stats[0].objects < stats[1].objects && stats[1].objects < stats[2].objects);
  assert.equal(stats[0].edgeTypes.has('multiPortal'), false);
  assert.equal(stats[1].edgeTypes.has('multiPortal'), true);
  assert.equal(stats[2].edgeTypes.has('multiPortal'), true);
  ['springJelly', 'spike', 'barrier', 'current', 'seaweed', 'coralCluster'].forEach((type) => {
    assert.equal(stats[2].edgeTypes.has(type), true, `part 3 should use ${type}`);
  });
});

test('all generated multi-edge portals touch a blocked hex', () => {
  mapNames.forEach((name) => {
    const map = loadMap(name);
    Object.values(map.edges).filter((edge) => edge.type === 'multiPortal').forEach((edge) => {
      assert.equal(edge.cells.some((key) => map.cells[key]?.terrain === 'blocked'), true, `${name}: ${edge.cells.join('|')}`);
    });
  });
});

test('part 2 is independently authored as a hot-spring route', () => {
  const part2 = loadMap('下沉篇-第2部分.json');
  const part3 = loadMap('下沉篇-第3部分.json');
  assert.notDeepEqual(part2.layout, part3.layout);
  assert.match(part2.metadata.designIntent, /獨立設計的熱泉脈衝路線/);
  assert.equal(part2.metadata.source, '獨立生成（scripts/generate-chapter-maps.mjs）');
  assert.equal(part2.metadata.difficulty, 'medium');
  assert.ok(Object.values(part2.cells).some((cell) => cell.region === 'thermal-vent-rock'));
  assert.ok(Object.values(part2.cells).some((cell) => cell.region === 'thermal-bank'));
});
