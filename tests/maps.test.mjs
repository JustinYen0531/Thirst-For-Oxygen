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
import { MAP_OBJECT_SIZE } from '../src/map-object-settings.js';

const mapsDirectory = join(process.cwd(), 'maps', '下沉篇');
const mapNames = [
  '下沉篇-第1部分.json',
  '下沉篇-第2部分.json',
  '下沉篇-第3部分.json',
];
const ascentMapsDirectory = join(process.cwd(), 'maps', '上升篇');
const ascentMapNames = [
  '上升篇-第1部分.json',
  '上升篇-第2部分.json',
  '上升篇-第3部分.json',
];

function loadMap(name) {
  return JSON.parse(readFileSync(join(mapsDirectory, name), 'utf8'));
}

function loadAscentMap(name) {
  return JSON.parse(readFileSync(join(ascentMapsDirectory, name), 'utf8'));
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

test('all ordinary objects keep thirty pixels while Razor hazards use the enlarged three-blade profile', () => {
  [...mapNames.map(loadMap), ...ascentMapNames.map(loadAscentMap)].forEach((map) => {
    Object.values(map.cells).forEach((cell) => {
      [...(cell.objects ?? []), ...(cell.freeObjects ?? [])].forEach((object) => {
        if (object.kind === 'razor') {
          assert.equal(object.size, 60, 'Razor should use the enlarged 60px visual size');
          assert.equal(object.params?.count, 3, 'authored Razor hazards should use three blades');
        } else {
          assert.equal(object.size, MAP_OBJECT_SIZE, `${object.kind} should be ${MAP_OBJECT_SIZE}px`);
        }
      });
    });
    Object.values(map.edges).filter((edge) => edge?.type && edge.type !== 'none').forEach((edge) => {
      assert.equal(edge.size, MAP_OBJECT_SIZE, `${edge.type} Edge should be ${MAP_OBJECT_SIZE}px`);
    });
  });
});

test('every authored oxygen ore requires a high-speed 110 m/s impact', () => {
  [...mapNames.map(loadMap), ...ascentMapNames.map(loadAscentMap)].forEach((map) => {
    freeObjectsOf(map)
      .filter(({ object }) => object.kind === 'oxygen')
      .forEach(({ object }) => assert.equal(object.params?.activationSpeed, 110, 'oxygen ore should not activate from a light touch'));
  });
});

test('all authored photosynthesis bubbles restore the new half-tank oxygen amount', () => {
  [...mapNames.map(loadMap), ...ascentMapNames.map(loadAscentMap)].forEach((map) => {
    freeObjectsOf(map)
      .filter(({ object }) => object.kind === 'bubble')
      .forEach(({ object }) => assert.equal(object.params?.oxygenAmount, 50, 'photosynthesis bubbles should restore 50 O₂'));
  });
});

test('beginner-friendly coral and seaweed support edges are distributed at four times the old count', () => {
  const expected = [
    { coralCluster: 24, seaweed: 20 },
    { coralCluster: 12, seaweed: 8 },
    { coralCluster: 12, seaweed: 12 },
  ];
  [...mapNames.map(loadMap), ...ascentMapNames.map(loadAscentMap)].forEach((map, index) => {
    const part = index % 3;
    const counts = { coralCluster: 0, seaweed: 0 };
    Object.values(map.edges).forEach((edge) => {
      if (edge.type in counts) counts[edge.type] += 1;
    });
    assert.deepEqual(counts, expected[part], `${map.metadata.title} should keep a frequent beginner support rhythm`);
  });
});

test('wall-gill routes stay sparse, paired, and attached to one traversable wall cell', () => {
  const expectedGateCounts = [2, 4, 6];
  [...mapNames.map(loadMap), ...ascentMapNames.map(loadAscentMap)].forEach((map, index) => {
    const gates = Object.values(map.edges).filter((edge) => edge.type === 'wallGillGate');
    assert.equal(gates.length, expectedGateCounts[index % 3], `${map.metadata.title} should keep sparse wall-gill routes`);
    const routes = new Map();
    gates.forEach((edge) => routes.set(edge.wallGillRouteId, [...(routes.get(edge.wallGillRouteId) ?? []), edge]));
    routes.forEach((route, routeId) => {
      assert.equal(route.length, 2, `${routeId} should have one entrance and one exit`);
      assert.deepEqual(route.map((edge) => edge.wallGillSlot).sort(), [0, 1]);
      const blockedKeys = route.map((edge) => edge.cells.find((key) => map.cells[key]?.terrain === 'blocked'));
      assert.equal(new Set(blockedKeys).size, 1, `${routeId} should cross one connected wall cell`);
      route.forEach((edge) => {
        const terrains = edge.cells.map((key) => map.cells[key]?.terrain).sort();
        assert.deepEqual(terrains, ['blocked', 'water']);
      });
    });
  });
});

test('descent part 1 teaches the first wall-gill route near the opening', () => {
  const map = loadMap(mapNames[0]);
  const gates = Object.values(map.edges).filter((edge) => edge.type === 'wallGillGate');
  const blockedRows = gates.map((edge) => edge.cells
    .map((key) => map.cells[key])
    .find((cell) => cell?.terrain === 'blocked')?.r);
  assert.equal(gates.length, 2);
  assert.ok(blockedRows.every((row) => Number.isFinite(row) && row <= 24), 'the first route must appear soon enough to test during the opening');
});

test('ascent trilogy is a playable bottom-to-top vertical mirror of descent', () => {
  ascentMapNames.forEach((name, index) => {
    const ascent = loadAscentMap(name);
    const descent = loadMap(mapNames[index]);
    const errors = validateMap(ascent).filter((result) => result.level === 'error');
    const starts = actorsOf(ascent, 'playerStart');
    const { reachable, openedGates } = reachableKeysAfterAvailableButtons(ascent);
    assert.equal(errors.length, 0, `${name}: ${errors.map((result) => result.message).join('; ')}`);
    assert.equal(ascent.metadata.chapter, '上升篇');
    assert.equal(ascent.metadata.mirroredFrom, mapNames[index]);
    assert.equal(starts.length, 1, `${name} should contain exactly one player start`);
    assert.ok(starts[0].cell.r >= ascent.layout.height - 4, `${name} should begin at the mirrored bottom`);
    assert.ok(ascent.cells[ascent.metadata.exitCellKey].r <= 3, `${name} should finish at the mirrored top`);
    assert.equal(reachable.has(ascent.metadata.exitCellKey), true, `${name} top exit should be reachable from the bottom start`);
    Object.entries(ascent.cells).filter(([, cell]) => cell.conditionalGate).forEach(([gateKey]) => {
      assert.equal(openedGates.has(gateKey), true, `${name} gate ${gateKey} should retain a reachable mirrored button`);
    });
    Object.values(descent.cells).forEach((sourceCell) => {
      const mirroredRow = descent.layout.height - 1 - sourceCell.r;
      const sourceColumn = sourceCell.q + Math.floor(sourceCell.r / 2);
      const mirroredColumn = descent.layout.height % 2 === 0
        ? descent.layout.width - 1 - sourceColumn
        : sourceColumn;
      const mirroredKey = `${mirroredColumn - Math.floor(mirroredRow / 2)},${mirroredRow}`;
      const mirroredCell = ascent.cells[mirroredKey];
      assert.equal(mirroredCell?.terrain, sourceCell.terrain, `${name} should mirror terrain at ${mirroredKey}`);
      assert.equal(mirroredCell?.waterLayer, sourceCell.waterLayer, `${name} should mirror water layers at ${mirroredKey}`);
      assert.equal(mirroredCell?.gravityLevel, sourceCell.gravityLevel, `${name} should mirror gravity tiles at ${mirroredKey}`);
    });
  });
});

test('ascent difficulty rises through denser hazards and scarcer oxygen', () => {
  const ascentMaps = ascentMapNames.map(loadAscentMap);
  const descentMaps = mapNames.map(loadMap);
  const countObjects = (map, kind) => freeObjectsOf(map).filter(({ object }) => object.kind === kind).length;
  const countEdges = (map, type) => Object.values(map.edges).filter((edge) => edge.type === type).length;
  assert.deepEqual(ascentMaps.map((map) => map.metadata.enemyTargetCount), [24, 28, 32]);
  assert.deepEqual(ascentMaps.map((map) => countObjects(map, 'ink')), [2, 5, 8]);
  ascentMaps.forEach((map, index) => {
    const challenge = map.metadata.ascentChallenge;
    assert.ok(countObjects(map, 'oxygen') < countObjects(descentMaps[index], 'oxygen'), `Part ${index + 1} should reduce direct oxygen`);
    assert.ok(countObjects(map, 'checkpoint') < countObjects(descentMaps[index], 'checkpoint'), `Part ${index + 1} should reduce full refills`);
    assert.ok(countObjects(map, 'torricelli') <= countObjects(descentMaps[index], 'torricelli'), `Part ${index + 1} should not add hidden oxygen rooms`);
    assert.equal(countEdges(map, 'spike'), countEdges(descentMaps[index], 'spike') + challenge.addedSpikes);
    assert.equal(countEdges(map, 'current'), countEdges(descentMaps[index], 'current') + challenge.addedCurrents);
    assert.equal(countEdges(map, 'barrier'), countEdges(descentMaps[index], 'barrier') + challenge.addedBarriers);
    assert.equal(Object.values(map.edges).filter((edge) => edge.ascentDetour).length, challenge.forcedDetours);
  });
  assert.ok(countEdges(ascentMaps[0], 'spike') < countEdges(ascentMaps[1], 'spike'));
  assert.ok(countEdges(ascentMaps[1], 'spike') < countEdges(ascentMaps[2], 'spike'));
  assert.ok(countObjects(ascentMaps[0], 'oxygen') > countObjects(ascentMaps[1], 'oxygen'));
  assert.ok(countObjects(ascentMaps[1], 'oxygen') > countObjects(ascentMaps[2], 'oxygen'));
});

function canTraverse(map, fromKey, toKey, openedGates = new Set()) {
  const from = map.cells[fromKey];
  const to = map.cells[toKey];
  const destinationOpen = to?.terrain === 'water' || (to?.conditionalGate && openedGates.has(toKey));
  if (!from || !to || !destinationOpen) return false;
  const edge = map.edges[edgeKey(fromKey, toKey)];
  if (edge?.blocksPassage && edge.type !== 'layerPortal') return false;
  if (from.waterLayer !== to.waterLayer && edge?.type !== 'layerPortal') return false;
  return true;
}

function reachableKeys(map, { maxRow = Number.POSITIVE_INFINITY, portals = false, openedGates = new Set() } = {}) {
  const start = actorsOf(map, 'playerStart')[0]?.key;
  if (!start) return new Set();
  const portalDestinations = new Map();
  if (portals) {
    Object.entries(map.edges).forEach(([key, edge]) => {
      if (edge.type !== 'multiPortal' || !edge.portalTargetKey) return;
      const sourceCellKey = edge.cells.find((cellKey) => map.cells[cellKey]?.terrain === 'water');
      const target = map.edges[edge.portalTargetKey];
      const targetCellKey = target?.cells?.find((cellKey) => map.cells[cellKey]?.terrain === 'water');
      if (sourceCellKey && targetCellKey) portalDestinations.set(sourceCellKey, targetCellKey);
    });
  }
  const visited = new Set([start]);
  const queue = [start];
  while (queue.length) {
    const key = queue.shift();
    DIRECTIONS.forEach((_, direction) => {
      const next = neighborKey(key, direction);
      if (map.cells[next]?.r > maxRow || visited.has(next) || !canTraverse(map, key, next, openedGates)) return;
      visited.add(next);
      queue.push(next);
    });
    const portalDestination = portalDestinations.get(key);
    if (portalDestination && !visited.has(portalDestination) && map.cells[portalDestination].r <= maxRow) {
      visited.add(portalDestination);
      queue.push(portalDestination);
    }
  }
  return visited;
}

function reachableKeysAfterAvailableButtons(map, { maxRow = Number.POSITIVE_INFINITY, portals = true } = {}) {
  const openedGates = new Set();
  let reachable = new Set();
  let changed = true;
  while (changed) {
    changed = false;
    reachable = reachableKeys(map, { maxRow, portals, openedGates });
    reachable.forEach((key) => {
      const cell = map.cells[key];
      [...(cell.objects ?? []), ...(cell.freeObjects ?? [])].forEach((object) => {
        if (object.kind !== 'button') return;
        (object.targetGates ?? []).forEach((gateKey) => {
          if (openedGates.has(gateKey)) return;
          openedGates.add(gateKey);
          changed = true;
        });
      });
    });
  }
  return { reachable, openedGates };
}

function shortestDistanceToRow(map, targetRow) {
  const start = actorsOf(map, 'playerStart')[0]?.key;
  if (!start) return Number.POSITIVE_INFINITY;
  const distance = new Map([[start, 0]]);
  const queue = [start];
  while (queue.length) {
    const key = queue.shift();
    if (map.cells[key].r >= targetRow) return distance.get(key);
    DIRECTIONS.forEach((_, direction) => {
      const next = neighborKey(key, direction);
      if (distance.has(next) || !canTraverse(map, key, next)) return;
      distance.set(next, distance.get(key) + 1);
      queue.push(next);
    });
  }
  return Number.POSITIVE_INFINITY;
}

function contiguousWaterWidth(map, row, column) {
  let left = column;
  let right = column;
  const isWater = (candidate) => map.cells[`${candidate - Math.floor(row / 2)},${row}`]?.terrain === 'water';
  while (left > 0 && isWater(left - 1)) left -= 1;
  while (right < map.layout.width - 1 && isWater(right + 1)) right += 1;
  return right - left + 1;
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

test('all three maps expose a reachable late runtime exit', () => {
  mapNames.forEach((name) => {
    const map = loadMap(name);
    const { reachable, openedGates } = reachableKeysAfterAvailableButtons(map);
    assert.ok(map.metadata.exitCellKey, `${name} should declare a runtime exit cell`);
    assert.equal(map.cells[map.metadata.exitCellKey]?.terrain, 'water', `${name} exit should be a water cell`);
    assert.ok(map.cells[map.metadata.exitCellKey].r >= map.layout.height - 4, `${name} exit should sit in the closing section`);
    assert.equal(reachable.has(map.metadata.exitCellKey), true, `${name} exit should be reachable from playerStart`);
    Object.entries(map.cells).filter(([, cell]) => cell.conditionalGate && !cell.conditionalGate.opened).forEach(([gateKey]) => {
      assert.equal(openedGates.has(gateKey), true, `${name} gate ${gateKey} should only open from a reachable button`);
    });
  });
});

test('part 3 portal network reaches every authored special encounter and is reciprocal', () => {
  const part3 = loadMap('下沉篇-第3部分.json');
  const { reachable } = reachableKeysAfterAvailableButtons(part3);
  [...actorsOf(part3, 'miniBossSpawn'), ...actorsOf(part3, 'bossSpawn')].forEach(({ key, actor }) => {
    assert.equal(reachable.has(key), true, `${actor.enemyId} at ${key} should be reachable through the portal route`);
  });
  Object.entries(part3.edges).filter(([, edge]) => edge.type === 'multiPortal').forEach(([key, edge]) => {
    assert.ok(edge.portalTargetKey, `${key} should not advertise a portal without a destination`);
    assert.equal(part3.edges[edge.portalTargetKey]?.portalTargetKey, key, `${key} portal link should be reciprocal`);
  });
});

test('all authored objects and active Edges have a reachable gameplay side', () => {
  mapNames.forEach((name) => {
    const map = loadMap(name);
    const { reachable } = reachableKeysAfterAvailableButtons(map);
    freeObjectsOf(map).forEach(({ key, object }) => {
      assert.equal(reachable.has(key), true, `${name}: ${object.kind} at ${key} should be reachable`);
    });
    Object.entries(map.edges).filter(([, edge]) => edge.type !== 'none').forEach(([key, edge]) => {
      const hasReachableWaterSide = edge.cells.some((cellKey) => (
        map.cells[cellKey]?.terrain === 'water' && reachable.has(cellKey)
      ));
      assert.equal(hasReachableWaterSide, true, `${name}: ${edge.type} at ${key} should touch reachable water`);
    });
  });
});

test('descent maps form a deliberate difficulty ladder from teaching to final exam', () => {
  const maps = mapNames.map(loadMap);
  const advancedObjectKinds = new Set(['mine', 'button', 'weightStone', 'ink', 'razor']);
  const stats = maps.map((map) => ({
    advancedObjects: freeObjectsOf(map).filter(({ object }) => advancedObjectKinds.has(object.kind)).length,
    edgeTypes: new Set(Object.values(map.edges).map((edge) => edge.type)),
    gates: Object.values(map.cells).filter((cell) => cell.conditionalGate).length,
    l3: Object.values(map.cells).filter((cell) => cell.gravityLevel === 'L3').length,
    portals: Object.values(map.edges).filter((edge) => edge.type === 'multiPortal').length,
  }));
  assert.ok(stats[0].advancedObjects < stats[1].advancedObjects && stats[1].advancedObjects < stats[2].advancedObjects);
  assert.equal(stats[0].edgeTypes.has('multiPortal'), false);
  assert.ok(stats[1].gates > 0 && stats[1].l3 > 0 && stats[1].portals > 0);
  assert.ok(stats[2].portals > stats[1].portals);
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

test('part 1 doubles only its length and uses broad exploration routes', () => {
  const part1 = loadMap('下沉篇-第1部分.json');
  assert.equal(part1.layout.width, 18, 'Part 1 should keep its original horizontal scale');
  assert.ok(part1.layout.height >= part1.metadata.originalHeight * 2, 'Part 1 height should be at least twice the old 72-row length');
  assert.equal(part1.layout.height, 184);
  assert.ok(part1.metadata.explorationLoops.length >= 4, 'Part 1 should contain several split-and-rejoin exploration loops');
  assert.ok(new Set(Object.values(part1.cells).filter((cell) => cell.terrain === 'water').map((cell) => cell.region)).size >= 12);
  part1.metadata.broadRouteSamples.forEach(({ row, column }) => {
    assert.ok(
      contiguousWaterWidth(part1, row, column) >= part1.metadata.minimumRouteWidth,
      `row ${row} route should stay broad enough to avoid precision movement`,
    );
  });
  assert.ok(shortestDistanceToRow(part1, part1.layout.height - 2) >= 150, 'even the shortest completion route should remain a long journey');
});

test('part 1 Torricelli spaces require an off-axis upward backtrack', () => {
  const part1 = loadMap('下沉篇-第1部分.json');
  const torricelliObjects = freeObjectsOf(part1).filter(({ object }) => object.kind === 'torricelli');
  assert.equal(part1.metadata.torricelliDetours.length, 4);
  assert.equal(torricelliObjects.length, 4);
  part1.metadata.torricelliDetours.forEach((detour) => {
    const key = `${detour.objectColumn - Math.floor(detour.objectRow / 2)},${detour.objectRow}`;
    const cell = part1.cells[key];
    assert.equal(cell.freeObjects.some((object) => object.kind === 'torricelli'), true, `${key} should contain the Torricelli reward`);
    assert.equal(cell.gravityLevel, 'L1', `${key} should be the final naturally rising Torricelli rest room`);
    const detourRows = [...new Set(Object.values(part1.cells)
      .filter((candidate) => candidate.region === detour.region && candidate.r >= detour.objectRow && candidate.r <= detour.ascentEndRow)
      .map((candidate) => candidate.r))].sort((left, right) => left - right);
    const terminalRows = detourRows.slice(0, detour.terminalRestRows);
    const climbRows = detourRows.slice(detour.terminalRestRows);
    assert.equal(terminalRows.length, detour.terminalRestRows, `${key} should have a complete Torricelli rest room`);
    assert.ok(terminalRows.every((row) => Object.values(part1.cells)
      .filter((candidate) => candidate.region === detour.region && candidate.r === row)
      .every((candidate) => candidate.gravityLevel === 'L1')), `${key} terminal rows should use L1`);
    assert.ok(climbRows.length > 0 && climbRows.every((row) => Object.values(part1.cells)
      .filter((candidate) => candidate.region === detour.region && candidate.r === row)
      .every((candidate) => candidate.gravityLevel === 'L-1')), `${key} return climb should use L-1`);
    assert.ok(Math.abs(detour.objectColumn - part1.metadata.mainAxisColumn) >= 6, `${key} should be visibly off the main axis`);
    assert.ok(detour.junctionRow - detour.objectRow >= 7, `${key} should require a meaningful upward return`);
    assert.ok(detour.shaftWidth >= 4, `${key} should use a broad ascent cavern instead of a precision shaft`);
    assert.ok(detour.separationWallWidth >= 2, `${key} should be separated from the main route by a substantial wall`);
    assert.equal(
      Object.values(part1.cells).filter((candidate) => candidate.r === detour.objectRow && candidate.region === detour.region).length,
      detour.shaftWidth,
      `${key} reward row should match its authored cavern width instead of open water`,
    );
    assert.ok(
      DIRECTIONS.filter((_, direction) => part1.cells[neighborKey(key, direction)]?.terrain === 'blocked').length >= 3,
      `${key} should visibly sit against a sealed cap and side wall`,
    );
    assert.equal(reachableKeys(part1).has(key), true, `${key} should be reachable through its lower junction`);
    assert.equal(
      reachableKeys(part1, { maxRow: detour.junctionRow - 1 }).has(key),
      false,
      `${key} must not be reachable before descending to the lower junction`,
    );
  });
  assert.equal(Object.values(part1.edges).filter((edge) => edge.type === 'current').length, 4);
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
  assert.equal(part2.metadata.teachingSequence.length, 8);
});

test('part 2 provides four separated Torricelli return routes', () => {
  const part2 = loadMap('下沉篇-第2部分.json');
  const detours = part2.metadata.torricelliDetours;
  const torricelliObjects = freeObjectsOf(part2).filter(({ object }) => object.kind === 'torricelli');
  const { reachable } = reachableKeysAfterAvailableButtons(part2, { portals: false });
  assert.equal(detours.length, 4);
  assert.equal(torricelliObjects.length, 4);
  detours.forEach((detour) => {
    const key = `${detour.objectColumn - Math.floor(detour.objectRow / 2)},${detour.objectRow}`;
    const cell = part2.cells[key];
    assert.ok(cell, `${key} should exist`);
    assert.equal(cell.freeObjects.some((object) => object.kind === 'torricelli'), true, `${key} should contain the Torricelli reward`);
    assert.equal(cell.gravityLevel, 'L1', `${key} should be a natural floating rest room`);
    assert.equal(cell.waterLayer, detour.waterLayer, `${key} should stay on its thermal water layer`);
    assert.ok(detour.ascentRows >= 9, `${key} should require a meaningful return climb`);
    assert.ok(detour.shaftWidth >= 3, `${key} should remain broad enough to avoid precision movement`);
    assert.ok(detour.separationWallWidth >= 1, `${key} should be separated from the main route by a rock wall`);
    assert.ok(DIRECTIONS.filter((_, direction) => part2.cells[neighborKey(key, direction)]?.terrain === 'blocked').length >= 2, `${key} should sit against a cap and side wall`);
    assert.equal(reachable.has(key), true, `${key} should be reachable through its lower junction`);
    assert.equal(reachableKeysAfterAvailableButtons(part2, { maxRow: detour.junctionRow - 1, portals: false }).reachable.has(key), false, `${key} must stay hidden until the lower junction`);
  });
});

test('part 3 preserves the player-authored template geometry outside the final Boss room', () => {
  const source = JSON.parse(readFileSync(join(process.cwd(), '範本map.json'), 'utf8'));
  const part3 = loadMap('下沉篇-第3部分.json');
  const finalBossRoom = part3.metadata.bossRoom.room;
  assert.deepEqual(part3.layout, source.layout);
  Object.entries(source.cells).forEach(([key, sourceCell]) => {
    const generated = part3.cells[key];
    const sourceColumn = sourceCell.q + Math.floor(sourceCell.r / 2);
    const isFinalBossRoomCell = sourceCell.r >= finalBossRoom.rowStart
      && sourceCell.r <= finalBossRoom.rowEnd
      && sourceColumn >= finalBossRoom.columnStart
      && sourceColumn <= finalBossRoom.columnEnd;
    // The final Boss room is an intentional authored carve-out; all geometry outside it stays untouched.
    if (!isFinalBossRoomCell) assert.equal(generated.terrain, sourceCell.terrain, `${key} terrain should stay player-authored`);
    assert.equal(generated.gravityLevel, sourceCell.gravityLevel, `${key} gravity should stay player-authored`);
    assert.equal(generated.waterLayer, sourceCell.waterLayer, `${key} layer should stay player-authored`);
  });
  assert.equal(part3.metadata.source, '範本map.json（玩家原始第三部分）');
  assert.equal(Object.values(part3.edges).filter((edge) => edge.type === 'multiPortal').length, 38);
  assert.equal(freeObjectsOf(part3).filter(({ object }) => object.kind === 'torricelli').length,
    new Set(freeObjectsOf(part3).filter(({ object }) => object.kind === 'torricelli').map(({ key }) => key)).size,
    'Part 3 must not stack two Torricelli objects in one cell');
  assert.equal(actorsOf(part3, 'miniBossSpawn')[0].actor.enemyId, 'tideLawNautilus');
  assert.equal(actorsOf(part3, 'bossSpawn')[0].actor.enemyId, 'abyssalSpermWhale');
  assert.equal(actorsOf(part3, 'bossSpawn').length, 1);
  assert.ok(actorsOf(part3, 'bossSpawn')[0].cell.r >= part3.layout.height - 8);
});

test('part 3 keeps the direct water passage beside the Razor at 38 metres', () => {
  const part3 = loadMap('下沉篇-第3部分.json');
  const razorCell = part3.cells['-8,37'];
  const passageKeys = ['-8,38', '-10,39', '-9,39', '-8,39'];
  const razor = razorCell.freeObjects.find((object) => object.kind === 'razor');
  assert.equal(razorCell.terrain, 'water');
  passageKeys.forEach((key) => assert.equal(part3.cells[key].terrain, 'water', `${key} must stay open as the central route breach`));
  assert.equal(canTraverse(part3, '-8,37', '-8,38'), true);
  assert.equal(canTraverse(part3, '-8,38', '-9,39'), true);
  assert.equal(canTraverse(part3, '-9,39', '-9,40'), true);
  assert.equal(razor.size, 60);
  assert.equal(razor.params.count, 3);
});

test('part 1 ends in a dedicated sealed Prism Crab Mini Boss room', () => {
  const part1 = loadMap('下沉篇-第1部分.json');
  const part2 = loadMap('下沉篇-第2部分.json');
  const room = part1.metadata.bossRoom;
  const miniBosses = actorsOf(part1, 'miniBossSpawn');

  assert.equal(miniBosses.length, 1);
  assert.equal(miniBosses[0].actor.enemyId, 'prismCrabGuardian');
  assert.equal(miniBosses[0].key, room.miniBossCellKey);
  assert.equal(actorsOf(part2, 'miniBossSpawn').some(({ actor }) => actor.enemyId === 'prismCrabGuardian'), false);
  assert.ok(room.room.rowStart > 159, 'the fixed encounter room should extend below the former Part 1 ending');
  assert.ok(part1.cells[part1.metadata.exitCellKey].r > room.room.rowEnd, 'the runtime exit should sit beyond the lower seal');
  assert.equal(part1.cells[room.triggerCellKey].terrain, 'water');

  const entranceRows = new Set(room.entranceGateCellKeys.map((key) => part1.cells[key].r));
  const exitRows = new Set(room.exitGateCellKeys.map((key) => part1.cells[key].r));
  assert.equal(entranceRows.size, 1);
  assert.equal(exitRows.size, 1);
  assert.equal(room.entranceGateCellKeys.length, 3);
  assert.equal(room.exitGateCellKeys.length, 3);
  [...room.entranceGateCellKeys, ...room.exitGateCellKeys].forEach((key) => {
    assert.equal(part1.cells[key].terrain, 'water');
    assert.deepEqual(part1.cells[key].conditionalGate, {
      opened: true,
      bossRoomGate: true,
      role: room.entranceGateCellKeys.includes(key) ? 'entrance' : 'exit',
    });
  });

  for (let row = room.room.rowStart; row <= room.room.rowEnd; row += 1) {
    const waterColumns = Object.values(part1.cells)
      .filter((cell) => cell.r === row && cell.terrain === 'water')
      .map((cell) => cell.q + Math.floor(cell.r / 2));
    assert.ok(waterColumns.length >= 7, `Boss room row ${row} should remain broad instead of becoming a precision tunnel`);
    assert.equal(Math.min(...waterColumns) > 0, true);
    assert.equal(Math.max(...waterColumns) < part1.layout.width - 1, true);
  }
});

test('part 2 ends in a Tide-Law Nautilus room that advances directly to Part 3', () => {
  const part2 = loadMap('下沉篇-第2部分.json');
  const room = part2.metadata.bossRoom;
  const miniBosses = actorsOf(part2, 'miniBossSpawn');

  assert.equal(room.id, 'tide-law-sanctum');
  assert.equal(room.enemyId, 'tideLawNautilus');
  assert.equal(room.autoAdvancePart, 3);
  assert.equal(miniBosses.filter(({ actor }) => actor.enemyId === 'tideLawNautilus').length, 1);
  assert.equal(miniBosses.find(({ actor }) => actor.enemyId === 'tideLawNautilus').key, room.miniBossCellKey);
  assert.equal(part2.metadata.routeBeats.at(-1), '潮律鸚鵡螺封印房');
  assert.ok(part2.cells[part2.metadata.exitCellKey].r >= part2.layout.height - 4);

  [...room.entranceGateCellKeys, ...room.exitGateCellKeys].forEach((key) => {
    assert.equal(part2.cells[key].terrain, 'water');
    assert.deepEqual(part2.cells[key].conditionalGate, {
      opened: true,
      bossRoomGate: true,
      role: room.entranceGateCellKeys.includes(key) ? 'entrance' : 'exit',
    });
  });
  for (let row = room.room.rowStart; row <= room.room.rowEnd; row += 1) {
    const roomCells = Object.values(part2.cells).filter((cell) => cell.r === row && cell.region === 'tide-law-sanctum');
    assert.ok(roomCells.length >= 7, `Tide-Law room row ${row} should remain broad`);
    assert.ok(roomCells.every((cell) => cell.waterLayer === 'T2'), `Tide-Law room row ${row} must stay on the upstream layer`);
  }
});

test('part 3 ends in a dedicated Abyssal Throne room for the Final Boss', () => {
  const part3 = loadMap('下沉篇-第3部分.json');
  const room = part3.metadata.bossRoom;
  const bosses = actorsOf(part3, 'bossSpawn').filter(({ actor }) => actor.enemyId === 'abyssalSpermWhale');

  assert.equal(room.id, 'abyssal-throne');
  assert.equal(room.enemyId, 'abyssalSpermWhale');
  assert.equal(bosses.length, 1);
  assert.equal(bosses[0].key, room.bossCellKey);
  assert.ok(part3.cells[part3.metadata.exitCellKey].r > room.room.rowEnd, 'the runtime exit should sit beyond the final Boss room seal');
  assert.equal(part3.cells[room.triggerCellKey].terrain, 'water');

  [...room.entranceGateCellKeys, ...room.exitGateCellKeys].forEach((key) => {
    assert.equal(part3.cells[key].terrain, 'water');
    assert.deepEqual(part3.cells[key].conditionalGate, {
      opened: true,
      bossRoomGate: true,
      role: room.entranceGateCellKeys.includes(key) ? 'entrance' : 'exit',
    });
  });
  for (let row = room.room.rowStart; row <= room.room.rowEnd; row += 1) {
    const roomCells = Object.values(part3.cells).filter((cell) => cell.r === row && cell.region === 'abyssal-throne');
    assert.ok(roomCells.length >= 7, `Abyssal Throne row ${row} should remain broad`);
    assert.ok(roomCells.every((cell) => cell.waterLayer === 'T1'), `Abyssal Throne row ${row} must stay on the authored layer`);
  }
});


test('all generated multi-edge portals touch a blocked hex', () => {
  mapNames.forEach((name) => {
    const map = loadMap(name);
    Object.values(map.edges).filter((edge) => edge.type === 'multiPortal').forEach((edge) => {
      assert.equal(edge.cells.some((key) => map.cells[key]?.terrain === 'blocked'), true, `${name}: ${edge.cells.join('|')}`);
    });
  });
});
