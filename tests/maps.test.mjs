import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  DIRECTIONS,
  edgeKey,
  neighborKey,
  validateMap,
} from '../src/map-model.js';

const mapsDirectory = join(process.cwd(), 'maps', '下沉篇');
const mapNames = [
  '下沉篇-第1部分.json',
  '下沉篇-第2部分.json',
  '下沉篇-第3部分.json',
];

function loadMap(name) {
  return JSON.parse(readFileSync(join(mapsDirectory, name), 'utf8'));
}

function actorsOf(map, kind) {
  return Object.entries(map.cells).flatMap(([key, cell]) => (
    cell.actors.filter((actor) => actor.kind === kind).map((actor) => ({ key, cell, actor }))
  ));
}

function freeObjectsOf(map) {
  return Object.entries(map.cells).flatMap(([key, cell]) => (
    (cell.freeObjects ?? []).map((object) => ({ key, row: cell.r, object }))
  ));
}

function canTraverse(map, fromKey, toKey) {
  const from = map.cells[fromKey];
  const to = map.cells[toKey];
  if (!from || !to || (!to.conditionalGate && to.terrain !== 'water')) return false;
  const edge = map.edges[edgeKey(fromKey, toKey)];
  if (edge?.blocksPassage && edge.type !== 'layerPortal') return false;
  if (from.waterLayer !== to.waterLayer && edge?.type !== 'layerPortal') return false;
  return true;
}

function reachableKeysWithOpenedGates(map, { maxRow = Number.POSITIVE_INFINITY } = {}) {
  const start = actorsOf(map, 'playerStart')[0]?.key;
  if (!start) return new Set();
  const visited = new Set([start]);
  const queue = [start];
  while (queue.length) {
    const key = queue.shift();
    DIRECTIONS.forEach((_, direction) => {
      const next = neighborKey(key, direction);
      if (map.cells[next]?.r > maxRow || visited.has(next) || !canTraverse(map, key, next)) return;
      visited.add(next);
      queue.push(next);
    });
  }
  return visited;
}

test('generated descent maps are valid and have one authored player start', () => {
  mapNames.forEach((name) => {
    const map = loadMap(name);
    const errors = validateMap(map).filter((result) => result.level === 'error');
    assert.equal(errors.length, 0, `${name}: ${errors.map((result) => result.message).join('; ')}`);
    assert.equal(actorsOf(map, 'playerStart').length, 1, `${name} should contain exactly one player start`);
    assert.ok(actorsOf(map, 'enemySpawn').length >= 3, `${name} should visibly author enemy encounter beats`);
  });
});

test('part 1 and part 2 have a connected authored route after gates open', () => {
  mapNames.slice(0, 2).forEach((name) => {
    const map = loadMap(name);
    const reachable = reachableKeysWithOpenedGates(map);
    const targetRow = map.layout.height - 4;
    assert.ok([...reachable].some((key) => map.cells[key].r >= targetRow), `${name} should connect its start to its closing room`);
  });
});

test('descent maps form a deliberate difficulty ladder from teaching to final exam', () => {
  const maps = mapNames.map(loadMap);
  const stats = maps.map((map) => ({
    blocked: Object.values(map.cells).filter((cell) => cell.terrain === 'blocked').length,
    objects: freeObjectsOf(map).length,
    edgeTypes: new Set(Object.values(map.edges).map((edge) => edge.type)),
  }));
  assert.ok(stats[0].blocked < stats[1].blocked && stats[1].blocked < stats[2].blocked);
  assert.ok(stats[0].objects < stats[1].objects && stats[1].objects < stats[2].objects);
  assert.equal(stats[0].edgeTypes.has('multiPortal'), false);
  assert.equal(stats[1].edgeTypes.has('multiPortal'), true);
  assert.equal(stats[2].edgeTypes.has('multiPortal'), true);
});

test('the trilogy uses every implemented free object and edge interaction', () => {
  const maps = mapNames.map(loadMap);
  const freeObjectKinds = new Set(maps.flatMap((map) => freeObjectsOf(map).map(({ object }) => object.kind)));
  const edgeKinds = new Set(maps.flatMap((map) => Object.values(map.edges).map((edge) => edge.type)));
  ['oxygen', 'bubble', 'torricelli', 'checkpoint', 'mine', 'weightStone', 'ink', 'razor', 'button'].forEach((kind) => {
    assert.equal(freeObjectKinds.has(kind), true, `trilogy should use ${kind}`);
  });
  ['springJelly', 'spike', 'barrier', 'current', 'seaweed', 'coralCluster', 'layerPortal', 'multiPortal'].forEach((type) => {
    assert.equal(edgeKinds.has(type), true, `trilogy should use ${type}`);
  });
});

test('part 1 teaches recovery and movement before advanced free-object traps', () => {
  const part1 = loadMap('下沉篇-第1部分.json');
  const kinds = new Set(freeObjectsOf(part1).map(({ object }) => object.kind));
  ['oxygen', 'bubble', 'torricelli', 'checkpoint'].forEach((kind) => assert.equal(kinds.has(kind), true));
  ['mine', 'weightStone', 'ink', 'razor', 'button'].forEach((kind) => assert.equal(kinds.has(kind), false));
  assert.equal(part1.metadata.teachingSequence.length, 6);
  assert.ok(freeObjectsOf(part1).filter(({ object }) => object.kind === 'checkpoint').length >= 3);
});

test('part 1 Torricelli spaces require an off-axis upward backtrack', () => {
  const part1 = loadMap('下沉篇-第1部分.json');
  const torricelliObjects = freeObjectsOf(part1).filter(({ object }) => object.kind === 'torricelli');
  assert.equal(part1.metadata.torricelliDetours.length, 2);
  assert.equal(torricelliObjects.length, 2);
  part1.metadata.torricelliDetours.forEach((detour) => {
    const key = `${detour.objectColumn - Math.floor(detour.objectRow / 2)},${detour.objectRow}`;
    const cell = part1.cells[key];
    assert.equal(cell.freeObjects.some((object) => object.kind === 'torricelli'), true, `${key} should contain the Torricelli reward`);
    assert.equal(cell.gravityLevel, 'L-1', `${key} should be an upward Torricelli pocket`);
    assert.ok(Math.abs(detour.objectColumn - part1.metadata.mainAxisColumn) >= 6, `${key} should be visibly off the main axis`);
    assert.ok(detour.junctionRow - detour.objectRow >= 7, `${key} should require a meaningful upward return`);
    assert.equal(detour.shaftWidth, 2, `${key} should sit in a narrow two-column ascent shaft`);
    assert.ok(detour.separationWallWidth >= 2, `${key} should be separated from the main route by a substantial wall`);
    assert.equal(
      Object.values(part1.cells).filter((candidate) => candidate.r === detour.objectRow && candidate.region === detour.region).length,
      2,
      `${key} reward row should read as a narrow room instead of open water`,
    );
    assert.ok(
      DIRECTIONS.filter((_, direction) => part1.cells[neighborKey(key, direction)]?.terrain === 'blocked').length >= 3,
      `${key} should visibly sit against a sealed cap and side wall`,
    );
    assert.equal(reachableKeysWithOpenedGates(part1).has(key), true, `${key} should be reachable through its lower junction`);
    assert.equal(
      reachableKeysWithOpenedGates(part1, { maxRow: detour.junctionRow - 1 }).has(key),
      false,
      `${key} must not be reachable before descending to the lower junction`,
    );
  });
  assert.equal(Object.values(part1.edges).filter((edge) => edge.type === 'current').length, 2);
  assert.equal(Object.values(part1.edges).filter((edge) => edge.type === 'spike').length, 1);
});

test('part 2 combines every advanced object and places its button before its gate', () => {
  const part2 = loadMap('下沉篇-第2部分.json');
  const objects = freeObjectsOf(part2);
  const kinds = new Set(objects.map(({ object }) => object.kind));
  ['mine', 'weightStone', 'ink', 'razor', 'button'].forEach((kind) => assert.equal(kinds.has(kind), true));
  const button = objects.find(({ object }) => object.kind === 'button');
  const gateRows = button.object.targetGates.map((key) => part2.cells[key].r);
  assert.ok(gateRows.every((row) => button.row < row), 'the player must find the side-route button before reaching the sealed threshold');
  assert.equal(Object.values(part2.edges).filter((edge) => edge.type === 'layerPortal').length, 1);
  assert.equal(Object.values(part2.edges).filter((edge) => edge.type === 'multiPortal').length, 6);
  assert.equal(part2.metadata.teachingSequence.length, 7);
});

test('part 3 preserves the player-authored template geometry as the final exam', () => {
  const source = JSON.parse(readFileSync(join(process.cwd(), '範本map.json'), 'utf8'));
  const part3 = loadMap('下沉篇-第3部分.json');
  assert.deepEqual(part3.layout, source.layout);
  Object.entries(source.cells).forEach(([key, sourceCell]) => {
    const generated = part3.cells[key];
    assert.equal(generated.terrain, sourceCell.terrain, `${key} terrain should stay player-authored`);
    assert.equal(generated.gravityLevel, sourceCell.gravityLevel, `${key} gravity should stay player-authored`);
    assert.equal(generated.waterLayer, sourceCell.waterLayer, `${key} layer should stay player-authored`);
  });
  assert.equal(part3.metadata.source, '範本map.json（玩家原始第三部分）');
  assert.ok(Object.values(part3.edges).filter((edge) => edge.type === 'multiPortal').length >= 39);
  assert.equal(actorsOf(part3, 'bossSpawn').length, 1);
  assert.ok(actorsOf(part3, 'bossSpawn')[0].cell.r >= part3.layout.height - 8);
});

test('all generated multi-edge portals touch a blocked hex', () => {
  mapNames.forEach((name) => {
    const map = loadMap(name);
    Object.values(map.edges).filter((edge) => edge.type === 'multiPortal').forEach((edge) => {
      assert.equal(edge.cells.some((key) => map.cells[key]?.terrain === 'blocked'), true, `${name}: ${edge.cells.join('|')}`);
    });
  });
});
