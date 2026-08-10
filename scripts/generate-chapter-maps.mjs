import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import {
  DIRECTIONS,
  allMapEdges,
  cellKeyFromColumn,
  createEmptyMap,
  edgeKey,
  neighborKey,
} from '../src/map-model.js';
import {
  getOfficialEdgeState,
  getOfficialFreeObjectState,
  normalizeMapObjectSizes,
} from '../src/map-object-settings.js';

const root = resolve('.');
const sourcePath = join(root, '範本map.json');
const descentOutputDir = join(root, 'maps', '下沉篇');
const ascentOutputDir = join(root, 'maps', '上升篇');
mkdirSync(descentOutputDir, { recursive: true });
mkdirSync(ascentOutputDir, { recursive: true });

const cellKey = (cell) => `${cell.q},${cell.r}`;
const columnOf = (cell) => cell.q + Math.floor(cell.r / 2);
const clone = (value) => JSON.parse(JSON.stringify(value));

function migratePhotosynthesisBubbleDefault(map) {
  const oxygenAmount = getOfficialFreeObjectState('bubble').params.oxygenAmount;
  Object.values(map.cells).forEach((cell) => {
    (cell.freeObjects ?? []).forEach((object) => {
      // Preserve intentional inspector overrides while upgrading the old
      // authored default from 20 O₂ to the new half-tank 50 O₂ contract.
      if (object.kind === 'bubble' && object.params?.oxygenAmount === 20) {
        object.params = { ...object.params, oxygenAmount };
      }
    });
  });
  return map;
}

function createAuthoredMap({ width, height, metadata }) {
  const map = createEmptyMap({ width, height });
  map.version = 2;
  map.chapterStates = {
    chapter1: { cells: {}, edges: {} },
    chapter2: { cells: {}, edges: {} },
  };
  map.metadata = {
    ...metadata,
    source: '獨立路線設計（scripts/generate-chapter-maps.mjs）',
    spawnPoints: '已配置',
  };
  return map;
}

function preparePlayerFinaleMap(source, metadata) {
  const map = clone(source);
  map.version = Math.max(2, Number(map.version) || 1);
  map.chapterStates = {
    chapter1: { cells: {}, edges: {} },
    chapter2: { cells: {}, edges: {} },
  };
  map.metadata = {
    ...metadata,
    source: '範本map.json（玩家原始第三部分）',
    spawnPoints: '已配置',
  };
  Object.values(map.cells).forEach((cell) => {
    cell.overlays = Array.isArray(cell.overlays) ? cell.overlays : [];
    cell.objects = Array.isArray(cell.objects) ? cell.objects : [];
    cell.freeObjects = Array.isArray(cell.freeObjects) ? cell.freeObjects : [];
    cell.actors = [];
    cell.conditionalGate = cell.conditionalGate ?? null;
    cell.region = cell.region ?? 'deep-ruins';
  });
  return map;
}

function makeRock(cell, region = 'rock') {
  cell.terrain = 'blocked';
  cell.gravityLevel = 'L0';
  cell.waterLayer = 'T1';
  cell.region = region;
  cell.conditionalGate = null;
  cell.overlays = [];
  cell.objects = [];
  cell.freeObjects = [];
  cell.actors = [];
}

function chooseWaterCell(map, row, columnHint, used = new Set()) {
  const width = Number(map.layout.width) || 1;
  const height = Number(map.layout.height) || 1;
  const safeRow = Math.max(0, Math.min(height - 1, row));
  for (let distance = 0; distance < width; distance += 1) {
    for (const column of [columnHint + distance, columnHint - distance]) {
      if (column < 0 || column >= width) continue;
      const key = cellKeyFromColumn(column, safeRow);
      const cell = map.cells[key];
      if (!cell || cell.terrain !== 'water' || cell.conditionalGate || used.has(key)) continue;
      return cell;
    }
  }
  return null;
}

function addActor(map, kind, row, columnHint, extra = {}) {
  const cell = chooseWaterCell(map, row, columnHint);
  if (!cell) throw new Error(`無法在 row ${row} 放置 ${kind}`);
  cell.actors.push({ kind, ...extra });
  return cellKey(cell);
}

function setRuntimeExit(map, row, columnHint) {
  const cell = chooseWaterCell(map, row, columnHint);
  if (!cell) throw new Error(`無法在 row ${row} 配置 runtime 終點`);
  map.metadata.exitCellKey = cellKey(cell);
  return map.metadata.exitCellKey;
}

function addFreeObject(map, kind, row, columnHint, used, extra = {}) {
  const cell = chooseWaterCell(map, row, columnHint, used);
  if (!cell) throw new Error(`無法在 row ${row} 放置 ${kind}`);
  const defaults = getOfficialFreeObjectState(kind);
  const object = {
    kind,
    offset: extra.offset ?? { x: 0, y: 0 },
    size: extra.size ?? defaults.size,
    params: { ...defaults.params, ...(extra.params ?? {}) },
  };
  if (kind === 'button') {
    object.targetGates = [...(extra.targetGates ?? [])];
    object.mode = 'once';
  }
  cell.freeObjects.push(object);
  used.add(cellKey(cell));
  return cellKey(cell);
}

function addConditionalGateWall(map, row, doorColumns) {
  const width = Number(map.layout.width);
  const corridorCells = Object.values(map.cells).filter((cell) => cell.r === row && cell.terrain === 'water');
  const gateLayer = corridorCells[0]?.waterLayer ?? 'T1';
  corridorCells.forEach((cell) => makeRock(cell, 'sealed-threshold'));
  const keys = doorColumns.map((column) => cellKeyFromColumn(column, row));
  keys.forEach((key) => {
    const cell = map.cells[key];
    if (!cell || columnOf(cell) <= 0 || columnOf(cell) >= width - 1) throw new Error(`無效的門位置：${key}`);
    cell.terrain = 'blocked';
    cell.gravityLevel = 'L1';
    cell.waterLayer = gateLayer;
    cell.region = 'conditional-gate';
    cell.conditionalGate = { opened: false };
    cell.freeObjects = [];
    cell.actors = [];
  });
  return keys;
}

function addBossRoomGateWall(map, row, doorColumns, role) {
  const width = Number(map.layout.width);
  const keys = doorColumns.map((column) => cellKeyFromColumn(column, row));
  keys.forEach((key) => {
    const cell = map.cells[key];
    if (!cell || cell.terrain !== 'water' || columnOf(cell) <= 0 || columnOf(cell) >= width - 1) {
      throw new Error(`無效的 Boss 房閘門位置：${key}`);
    }
    cell.gravityLevel = 'L1';
    cell.region = `boss-room-${role}-gate`;
    cell.conditionalGate = { opened: true, bossRoomGate: true, role };
  });
  return keys;
}

function boundaryEdges(map, rowHint, usedEdges = new Set()) {
  return allMapEdges(map)
    .filter(({ key, a, b }) => {
      if (usedEdges.has(key)) return false;
      const edge = map.edges[key];
      if (edge?.type && edge.type !== 'none') return false;
      const terrains = [map.cells[a]?.terrain, map.cells[b]?.terrain];
      return terrains.includes('water') && terrains.includes('blocked');
    })
    .sort((left, right) => {
      const leftRow = Math.min(map.cells[left.a].r, map.cells[left.b].r);
      const rightRow = Math.min(map.cells[right.a].r, map.cells[right.b].r);
      return Math.abs(leftRow - rowHint) - Math.abs(rightRow - rowHint) || left.key.localeCompare(right.key);
    });
}

function addEdge(map, entry, type, extra = {}) {
  const official = getOfficialEdgeState(type);
  map.edges[entry.key] = {
    cells: [entry.a, entry.b],
    type,
    blocksPassage: ['springJelly', 'spike', 'barrier'].includes(type),
    currentDirection: extra.currentDirection ?? 0,
    currentStrength: type === 'current' ? (extra.currentStrength ?? 1) : 0,
    ...official,
    ...extra,
  };
  return entry.key;
}

function addEdgeSet(map, type, rows) {
  const used = new Set(Object.entries(map.edges).filter(([, edge]) => edge.type !== 'none').map(([key]) => key));
  rows.forEach((row, index) => {
    const entry = boundaryEdges(map, row, used)[0];
    if (!entry) throw new Error(`row ${row} 找不到可放置 ${type} 的邊界`);
    addEdge(map, entry, type, type === 'current'
      ? { currentDirection: index % 6, currentStrength: 0.78 + (index % 3) * 0.16 }
      : {});
    used.add(entry.key);
  });
}

function addWallGillRoutes(map, rowHints, prefix) {
  const usedCenters = new Set();
  const reachable = reachableWaterKeys(map);
  rowHints.forEach((rowHint, routeIndex) => {
    const candidate = Object.values(map.cells)
      .filter((cell) => cell.terrain === 'blocked' && !cell.conditionalGate && !usedCenters.has(cellKey(cell)))
      .map((cell) => {
        const centerKey = cellKey(cell);
        const edges = DIRECTIONS.map((_, direction) => {
          const neighbour = neighborKey(centerKey, direction);
          if (map.cells[neighbour]?.terrain !== 'water' || !reachable.has(neighbour)) return null;
          const key = edgeKey(centerKey, neighbour);
          if (map.edges[key]?.type && map.edges[key].type !== 'none') return null;
          return { key, a: centerKey, b: neighbour, direction };
        }).filter(Boolean);
        return { cell, edges, distance: Math.abs(cell.r - rowHint) };
      })
      .filter((entry) => entry.edges.length >= 2)
      .sort((left, right) => left.distance - right.distance || cellKey(left.cell).localeCompare(cellKey(right.cell)))[0];
    if (!candidate) throw new Error(`${prefix}-${routeIndex + 1} 找不到可配置潛壁鰓門的牆體`);
    usedCenters.add(cellKey(candidate.cell));

    let pair = [candidate.edges[0], candidate.edges[1]];
    let separation = -1;
    for (let first = 0; first < candidate.edges.length; first += 1) {
      for (let second = first + 1; second < candidate.edges.length; second += 1) {
        const difference = Math.abs(candidate.edges[first].direction - candidate.edges[second].direction);
        const circularSeparation = Math.min(difference, DIRECTIONS.length - difference);
        if (circularSeparation > separation) {
          separation = circularSeparation;
          pair = [candidate.edges[first], candidate.edges[second]];
        }
      }
    }
    pair.forEach((entry, slot) => addEdge(map, entry, 'wallGillGate', {
      wallGillRouteId: `${prefix}-${routeIndex + 1}`,
      wallGillSlot: slot,
    }));
  });
}

function reachableWaterKeys(map) {
  const start = Object.entries(map.cells).find(([, cell]) => (
    cell.actors?.some((actor) => actor.kind === 'playerStart')
  ))?.[0];
  if (!start) return new Set();

  const openedGates = new Set();
  Object.values(map.cells).forEach((cell) => {
    [...(cell.objects ?? []), ...(cell.freeObjects ?? [])].forEach((object) => {
      if (object.kind !== 'button') return;
      (object.targetGates ?? []).forEach((gateKey) => openedGates.add(gateKey));
    });
  });

  const portalDestinations = new Map();
  Object.entries(map.edges).forEach(([key, edge]) => {
    if (edge.type !== 'multiPortal' || !edge.portalTargetKey) return;
    const sourceCellKey = edge.cells.find((cellKey) => map.cells[cellKey]?.terrain === 'water');
    const targetEdge = map.edges[edge.portalTargetKey];
    const targetCellKey = targetEdge?.cells?.find((cellKey) => map.cells[cellKey]?.terrain === 'water');
    if (sourceCellKey && targetCellKey) portalDestinations.set(sourceCellKey, targetCellKey);
  });

  const canTraverse = (fromKey, toKey) => {
    const from = map.cells[fromKey];
    const to = map.cells[toKey];
    const destinationOpen = to?.terrain === 'water' || (to?.conditionalGate && openedGates.has(toKey));
    if (!from || !to || !destinationOpen) return false;
    const edge = map.edges[edgeKey(fromKey, toKey)];
    if (edge?.blocksPassage && edge.type !== 'layerPortal') return false;
    if (from.waterLayer !== to.waterLayer && edge?.type !== 'layerPortal') return false;
    return true;
  };

  const reachable = new Set([start]);
  const queue = [start];
  while (queue.length) {
    const key = queue.shift();
    DIRECTIONS.forEach((_, direction) => {
      const next = neighborKey(key, direction);
      if (reachable.has(next) || !canTraverse(key, next)) return;
      reachable.add(next);
      queue.push(next);
    });
    const portalDestination = portalDestinations.get(key);
    if (portalDestination && !reachable.has(portalDestination)) {
      reachable.add(portalDestination);
      queue.push(portalDestination);
    }
  }
  return reachable;
}

function addReachableSupportSet(map, type, rows) {
  const used = new Set(Object.entries(map.edges).filter(([, edge]) => edge.type !== 'none').map(([key]) => key));
  const reachable = reachableWaterKeys(map);
  rows.forEach((row, index) => {
    const entry = boundaryEdges(map, row, used).find(({ a, b }) => (
      [a, b].some((cellKey) => map.cells[cellKey]?.terrain === 'water' && reachable.has(cellKey))
    ));
    if (!entry) throw new Error(`row ${row} 找不到可抵達水側的 ${type} 邊界`);
    addEdge(map, entry, type, type === 'current'
      ? { currentDirection: index % 6, currentStrength: 0.78 + (index % 3) * 0.16 }
      : {});
    used.add(entry.key);
  });
}

function addPassageBarrierSet(map, rows) {
  const used = new Set(Object.entries(map.edges).filter(([, edge]) => edge.type !== 'none').map(([key]) => key));
  const openNeighbourCount = (key) => DIRECTIONS.filter((_, direction) => {
    const neighbour = neighborKey(key, direction);
    return map.cells[neighbour]?.terrain === 'water';
  }).length;
  rows.forEach((row) => {
    const entry = allMapEdges(map)
      .filter(({ key, a, b }) => (
        !used.has(key)
        && map.cells[a]?.terrain === 'water'
        && map.cells[b]?.terrain === 'water'
        && map.cells[a]?.waterLayer === map.cells[b]?.waterLayer
        && !map.cells[a]?.conditionalGate
        && !map.cells[b]?.conditionalGate
        && openNeighbourCount(a) >= 4
        && openNeighbourCount(b) >= 4
      ))
      .sort((left, right) => {
        const leftDistance = Math.abs((map.cells[left.a].r + map.cells[left.b].r) / 2 - row);
        const rightDistance = Math.abs((map.cells[right.a].r + map.cells[right.b].r) / 2 - row);
        return leftDistance - rightDistance || left.key.localeCompare(right.key);
      })[0];
    if (!entry) throw new Error(`row ${row} 找不到可形成繞路的水域通行邊`);
    addEdge(map, entry, 'barrier', { ascentDetour: true });
    used.add(entry.key);
  });
}

function addEdgeNear(map, type, rowHint, columnHint, extra = {}) {
  const used = new Set(Object.entries(map.edges).filter(([, edge]) => edge.type !== 'none').map(([key]) => key));
  const entry = boundaryEdges(map, rowHint, used)
    .sort((left, right) => {
      const distance = (candidate) => {
        const cells = [map.cells[candidate.a], map.cells[candidate.b]];
        const row = Math.min(...cells.map((cell) => cell.r));
        const column = Math.min(...cells.map(columnOf));
        return Math.abs(row - rowHint) * 10 + Math.abs(column - columnHint);
      };
      return distance(left) - distance(right) || left.key.localeCompare(right.key);
    })[0];
  if (!entry) throw new Error(`row ${rowHint} column ${columnHint} 找不到可放置 ${type} 的邊界`);
  addEdge(map, entry, type, extra);
  return entry.key;
}

function addLayerPortal(map, rowHint) {
  const entry = allMapEdges(map)
    .filter(({ key, a, b }) => {
      if (map.edges[key]?.type && map.edges[key].type !== 'none') return false;
      const first = map.cells[a];
      const second = map.cells[b];
      return first?.terrain === 'water' && second?.terrain === 'water' && first.waterLayer !== second.waterLayer;
    })
    .sort((left, right) => {
      const leftRow = Math.min(map.cells[left.a].r, map.cells[left.b].r);
      const rightRow = Math.min(map.cells[right.a].r, map.cells[right.b].r);
      return Math.abs(leftRow - rowHint) - Math.abs(rightRow - rowHint) || left.key.localeCompare(right.key);
    })[0];
  if (!entry) throw new Error(`row ${rowHint} 找不到 T1/T2 層間邊界`);
  addEdge(map, entry, 'layerPortal');
}

function blockedCellWithWaterEdges(map, rowHint, usedCenters = new Set()) {
  return Object.values(map.cells)
    .filter((cell) => cell.terrain === 'blocked' && !cell.conditionalGate && !usedCenters.has(cellKey(cell)))
    .map((cell) => {
      const edges = DIRECTIONS.map((_, direction) => {
        const neighbour = neighborKey(cellKey(cell), direction);
        if (map.cells[neighbour]?.terrain !== 'water') return null;
        const key = edgeKey(cellKey(cell), neighbour);
        if (map.edges[key]?.type && map.edges[key].type !== 'none') return null;
        return { key, a: cellKey(cell), b: neighbour };
      }).filter(Boolean);
      return { cell, edges, distance: Math.abs(cell.r - rowHint) };
    })
    .filter((candidate) => candidate.edges.length >= 3)
    .sort((left, right) => left.distance - right.distance || cellKey(left.cell).localeCompare(cellKey(right.cell)))[0] ?? null;
}

function addLinkedPortal(map, firstRow, secondRow, prefix, usedCenters) {
  const firstCenter = blockedCellWithWaterEdges(map, firstRow, usedCenters);
  if (!firstCenter) throw new Error(`${prefix} 找不到第一個傳送門中心`);
  usedCenters.add(cellKey(firstCenter.cell));
  const secondCenter = blockedCellWithWaterEdges(map, secondRow, usedCenters);
  if (!secondCenter) throw new Error(`${prefix} 找不到第二個傳送門中心`);
  usedCenters.add(cellKey(secondCenter.cell));
  const count = Math.min(3, firstCenter.edges.length, secondCenter.edges.length);
  for (let index = 0; index < count; index += 1) {
    const firstKey = addEdge(map, firstCenter.edges[index], 'multiPortal', {
      portalGroupId: `${prefix}-a`, portalSlot: index, portalTargetKey: secondCenter.edges[index].key,
    });
    const secondKey = addEdge(map, secondCenter.edges[index], 'multiPortal', {
      portalGroupId: `${prefix}-b`, portalSlot: index, portalTargetKey: firstKey,
    });
    map.edges[firstKey].portalTargetKey = secondKey;
  }
}

function requireExistingEdge(map, key, expectedType = null) {
  const entry = allMapEdges(map).find((candidate) => candidate.key === key);
  const edge = map.edges[key];
  if (!entry || !edge || (expectedType && edge.type !== expectedType)) {
    throw new Error(`找不到預期的 ${expectedType ?? 'Edge'}：${key}`);
  }
  return { entry, edge };
}

function connectExistingPortalEdges(map, firstKeys, secondKeys, prefix) {
  if (firstKeys.length !== secondKeys.length) throw new Error(`${prefix} 傳送門邊數不一致`);
  firstKeys.forEach((firstKey, index) => {
    const secondKey = secondKeys[index];
    const first = requireExistingEdge(map, firstKey, 'multiPortal').edge;
    const second = requireExistingEdge(map, secondKey, 'multiPortal').edge;
    Object.assign(first, {
      portalGroupId: `${prefix}-a`,
      portalSlot: index,
      portalTargetKey: secondKey,
    });
    Object.assign(second, {
      portalGroupId: `${prefix}-b`,
      portalSlot: index,
      portalTargetKey: firstKey,
    });
  });
}

function clearInvalidPortalEdge(map, key) {
  const edge = requireExistingEdge(map, key, 'multiPortal').edge;
  Object.assign(edge, {
    type: 'none',
    blocksPassage: false,
    currentDirection: 0,
    currentStrength: 0,
  });
  delete edge.portalGroupId;
  delete edge.portalSlot;
  delete edge.portalTargetKey;
}

function moveFreeObject(map, fromKey, toKey, kind) {
  const from = map.cells[fromKey];
  const to = map.cells[toKey];
  if (!from || !to || to.terrain !== 'water') throw new Error(`無法移動 ${kind}：${fromKey} → ${toKey}`);
  const index = (from.freeObjects ?? []).findIndex((object) => object.kind === kind);
  if (index < 0) throw new Error(`${fromKey} 找不到 ${kind}`);
  const [object] = from.freeObjects.splice(index, 1);
  to.freeObjects.push(object);
}

function moveExistingEdge(map, fromKey, toKey) {
  const edge = requireExistingEdge(map, fromKey).edge;
  const target = allMapEdges(map).find((candidate) => candidate.key === toKey);
  if (!target) throw new Error(`找不到 Edge 移動目標：${toKey}`);
  if (map.edges[toKey]?.type && map.edges[toKey].type !== 'none') throw new Error(`Edge 移動目標已使用：${toKey}`);
  map.edges = Object.fromEntries(Object.entries(map.edges).flatMap(([key, value]) => {
    if (key === toKey) return [];
    if (key === fromKey) return [[toKey, { ...edge, cells: [target.a, target.b] }]];
    return [[key, value]];
  }));
}

function repairPart3PortalRoute(map) {
  // The player-authored ruin uses three visible portal rings. The template
  // preserved their geometry, but most individual Edge targets were null.
  // Pair every matching side explicitly so runtime traversal is deterministic.
  connectExistingPortalEdges(map, [
    '-4,29|-5,29',
    '-5,29|-5,30',
    '-5,30|-6,30',
    '-5,30|-6,31',
    '-5,31|-6,31',
  ], [
    '1,29|2,29',
    '1,30|2,29',
    '1,30|2,30',
    '1,30|1,31',
    '0,31|1,31',
  ], 'part3-upper-ring');

  connectExistingPortalEdges(map, [
    '5,30|6,30',
    '5,30|5,31',
    '4,31|5,31',
    '4,31|4,32',
    '3,32|4,32',
    '3,32|3,33',
    '2,33|3,33',
  ], [
    '1,38|2,38',
    '2,37|2,38',
    '2,37|3,37',
    '3,36|3,37',
    '3,36|4,36',
    '4,35|4,36',
    '4,35|5,35',
  ], 'part3-lower-ring');

  // Leave the visible middle ring intact, but use its remaining portal as the
  // actual route into the late-game ruin. This is the missing link that makes
  // the authored Mini Boss and Boss chambers reachable from playerStart.
  connectExistingPortalEdges(map, [
    '2,33|2,34',
  ], [
    '-24,66|-25,67',
  ], 'part3-late-route');

  connectExistingPortalEdges(map, [
    '-24,67|-25,67',
    '-24,67|-25,68',
    '-24,68|-25,68',
    '-24,68|-25,69',
    '-24,69|-25,69',
    '-22,64|-23,65',
  ], [
    '-22,65|-23,65',
    '-22,65|-23,66',
    '-22,66|-23,66',
    '-22,66|-23,67',
    '-22,67|-23,67',
    '-22,67|-23,68',
  ], 'part3-deep-ring');

  // One unmatched decorative segment claimed to be a portal without an exit.
  // Keep the authored wall geometry, but stop presenting it as a usable portal.
  clearInvalidPortalEdge(map, '5,34|5,35');
}

function deduplicateCellObjectKind(map, kind) {
  Object.values(map.cells).forEach((cell) => {
    const matches = (cell.freeObjects ?? []).filter((object) => object.kind === kind);
    if (matches.length <= 1) return;
    const keep = [...matches].sort((left, right) => (Number(right.size) || 0) - (Number(left.size) || 0))[0];
    let kept = false;
    cell.freeObjects = cell.freeObjects.filter((object) => {
      if (object.kind !== kind) return true;
      if (!kept && object === keep) {
        kept = true;
        return true;
      }
      return false;
    });
  });
}

function carveWaterCell(map, row, column, region, gravityLevel = 'L1', waterLayer = 'T1') {
  if (row < 0 || row >= map.layout.height || column <= 0 || column >= map.layout.width - 1) return;
  const cell = map.cells[cellKeyFromColumn(column, row)];
  if (!cell) return;
  cell.terrain = 'water';
  cell.gravityLevel = gravityLevel;
  cell.waterLayer = waterLayer;
  cell.region = region;
  cell.conditionalGate = null;
}

function carveRoom(map, {
  rowStart,
  rowEnd,
  columnStart,
  columnEnd,
  region,
  gravityLevel = 'L1',
  waterLayer = 'T1',
}) {
  for (let row = rowStart; row <= rowEnd; row += 1) {
    for (let column = columnStart; column <= columnEnd; column += 1) {
      carveWaterCell(map, row, column, region, gravityLevel, waterLayer);
    }
  }
}

function carveRoomKeepingSourcePhysics(map, options) {
  const {
    rowStart,
    rowEnd,
    columnStart,
    columnEnd,
    region,
    gravityLevel = 'L1',
    waterLayer = 'T1',
  } = options;
  for (let row = rowStart; row <= rowEnd; row += 1) {
    for (let column = columnStart; column <= columnEnd; column += 1) {
      const key = cellKeyFromColumn(column, row);
      const sourceCell = map.cells[key];
      carveWaterCell(map, row, column, region, sourceCell?.gravityLevel ?? gravityLevel, sourceCell?.waterLayer ?? waterLayer);
    }
  }
}

// Torricelli detours are intentionally split into two readable gravity beats:
// the long return climb is L-1 (hard against the descent arc), while the small
// terminal room around the oxygen space is L1 so the player can naturally
// float up while resting and refilling oxygen.
const TORRICELLI_TERMINAL_REST_ROWS = 6;

function carveTorricelliDetour(map, {
  objectRow,
  ascentEndRow,
  columnStart,
  columnEnd,
  region,
  terminalRestRows = TORRICELLI_TERMINAL_REST_ROWS,
  waterLayer = 'T1',
}) {
  const safeAscentEndRow = Math.max(objectRow, ascentEndRow);
  const terminalEndRow = Math.min(safeAscentEndRow, objectRow + Math.max(1, terminalRestRows) - 1);
  carveRoom(map, {
    rowStart: objectRow,
    rowEnd: terminalEndRow,
    columnStart,
    columnEnd,
    region,
    gravityLevel: 'L1',
    waterLayer,
  });
  if (terminalEndRow < safeAscentEndRow) {
    carveRoom(map, {
      rowStart: terminalEndRow + 1,
      rowEnd: safeAscentEndRow,
      columnStart,
      columnEnd,
      region,
      gravityLevel: 'L-1',
      waterLayer,
    });
  }
}

function carveBroadRoute(map, points, region, gravityLevel = 'L1', radius = 2) {
  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index];
    const end = points[index + 1];
    const steps = Math.max(Math.abs(end.row - start.row), Math.abs(end.column - start.column), 1);
    for (let step = 0; step <= steps; step += 1) {
      const progress = step / steps;
      const row = Math.round(start.row + (end.row - start.row) * progress);
      const column = Math.round(start.column + (end.column - start.column) * progress);
      carveRoom(map, {
        rowStart: row - radius,
        rowEnd: row + radius,
        columnStart: column - radius,
        columnEnd: column + radius,
        region,
        gravityLevel,
      });
    }
  }
}

function paintPart1Terrain(map) {
  Object.values(map.cells).forEach((cell) => makeRock(cell, 'deep-forest-mass'));

  carveRoom(map, { rowStart: 0, rowEnd: 10, columnStart: 6, columnEnd: 11, region: 'entry-basin', gravityLevel: 'L0' });

  // Loop 1: two broad routes around the first forest monolith. Both are easy
  // to steer through, but they contain different optional rewards.
  carveBroadRoute(map, [
    { column: 9, row: 8 }, { column: 9, row: 23 }, { column: 4, row: 29 }, { column: 9, row: 36 },
  ], 'monolith-west-route');
  carveBroadRoute(map, [
    { column: 10, row: 8 }, { column: 13, row: 16 }, { column: 14, row: 29 }, { column: 9, row: 36 },
  ], 'monolith-east-route');
  // The first Torricelli cavern replaces the old shallow upper grotto. Its
  // sealed cap is separated from the entry route by two rock columns, so the
  // player must first descend to the row-23 junction and then swim back up.
  carveTorricelliDetour(map, {
    objectRow: 12,
    ascentEndRow: 22,
    columnStart: 1,
    columnEnd: 4,
    region: 'torricelli-ascent-early-left',
  });
  carveRoom(map, { rowStart: 23, rowEnd: 27, columnStart: 1, columnEnd: 9, region: 'torricelli-junction-early-left' });

  // A long west-to-east canopy traverse forces macro navigation around a
  // horizontal rock shelf without reducing the route to a precision tunnel.
  carveBroadRoute(map, [
    { column: 9, row: 36 }, { column: 4, row: 44 }, { column: 3, row: 57 },
    { column: 14, row: 60 }, { column: 13, row: 68 }, { column: 9, row: 72 },
  ], 'fallen-canopy-traverse');

  // Right Torricelli cavern: four cells wide, separated from all upper paths,
  // and connected only beneath the reward through the row-58 junction.
  carveTorricelliDetour(map, {
    objectRow: 39,
    ascentEndRow: 57,
    columnStart: 13,
    columnEnd: 16,
    region: 'torricelli-ascent-right',
  });
  carveRoom(map, { rowStart: 58, rowEnd: 63, columnStart: 11, columnEnd: 16, region: 'torricelli-junction-right' });

  // A second new cavern uses the sealed western rock mass beneath the canopy.
  // Its only opening is the broad row-79 junction into the sunken garden.
  carveTorricelliDetour(map, {
    objectRow: 62,
    ascentEndRow: 78,
    columnStart: 1,
    columnEnd: 4,
    region: 'torricelli-ascent-mid-left',
  });
  carveRoom(map, { rowStart: 79, rowEnd: 84, columnStart: 1, columnEnd: 9, region: 'torricelli-junction-mid-left' });

  // Loop 2: a large central reef offers two readable routes that rejoin much
  // later, giving exploration without any one-cell squeezes.
  carveBroadRoute(map, [
    { column: 9, row: 72 }, { column: 9, row: 80 }, { column: 9, row: 94 }, { column: 9, row: 100 },
  ], 'sunken-garden-west');
  carveBroadRoute(map, [
    { column: 9, row: 72 }, { column: 14, row: 80 }, { column: 14, row: 94 }, { column: 9, row: 100 },
  ], 'sunken-garden-east');

  // Left Torricelli cavern: an even longer return climb. Two solid columns
  // remain between this four-cell shaft and the western garden route.
  carveTorricelliDetour(map, {
    objectRow: 87,
    ascentEndRow: 109,
    columnStart: 1,
    columnEnd: 4,
    region: 'torricelli-ascent-left',
  });
  carveRoom(map, { rowStart: 110, rowEnd: 115, columnStart: 1, columnEnd: 10, region: 'torricelli-junction-left' });

  // Loop 3: the lower cathedral asks for a long side commitment, then returns
  // both paths to the same safe checkpoint room.
  carveBroadRoute(map, [
    { column: 9, row: 100 }, { column: 9, row: 114 }, { column: 4, row: 122 },
    { column: 4, row: 132 }, { column: 9, row: 136 },
  ], 'cathedral-west-route');
  carveBroadRoute(map, [
    { column: 9, row: 100 }, { column: 12, row: 110 }, { column: 14, row: 120 },
    { column: 13, row: 131 }, { column: 9, row: 136 },
  ], 'cathedral-east-route');

  // Loop 4 and the final threshold keep the closing stretch exploratory
  // instead of collapsing into a straight victory chute.
  carveBroadRoute(map, [
    { column: 9, row: 136 }, { column: 4, row: 143 }, { column: 4, row: 152 }, { column: 9, row: 158 },
  ], 'threshold-west-route');
  carveBroadRoute(map, [
    { column: 9, row: 136 }, { column: 13, row: 143 }, { column: 13, row: 152 }, { column: 9, row: 158 },
  ], 'threshold-east-route');
  carveRoom(map, { rowStart: 155, rowEnd: 159, columnStart: 6, columnEnd: 12, region: 'hot-spring-threshold', gravityLevel: 'L0' });

  // The first descent now ends in a dedicated Prism Crab sanctuary. The
  // three-cell throats are broad enough to enter without precision steering,
  // but become full-width seals once the encounter is triggered.
  carveRoom(map, { rowStart: 160, rowEnd: 164, columnStart: 8, columnEnd: 10, region: 'prism-sanctum-entry', gravityLevel: 'L0' });
  carveRoom(map, { rowStart: 165, rowEnd: 165, columnStart: 6, columnEnd: 12, region: 'prism-sanctum', gravityLevel: 'L0' });
  carveRoom(map, { rowStart: 166, rowEnd: 167, columnStart: 4, columnEnd: 14, region: 'prism-sanctum', gravityLevel: 'L0' });
  carveRoom(map, { rowStart: 168, rowEnd: 178, columnStart: 2, columnEnd: 15, region: 'prism-sanctum', gravityLevel: 'L0' });
  carveRoom(map, { rowStart: 179, rowEnd: 180, columnStart: 5, columnEnd: 12, region: 'prism-sanctum', gravityLevel: 'L0' });
  carveRoom(map, { rowStart: 181, rowEnd: 183, columnStart: 8, columnEnd: 10, region: 'prism-sanctum-exit', gravityLevel: 'L0' });
}

function buildPart1() {
  const map = createAuthoredMap({
    width: 18,
    height: 184,
    metadata: {
      chapter: '下沉篇', part: 1, title: '下沉篇・第一部分｜深海森林入口', difficulty: 'light',
      designIntent: '超過原長度兩倍的宏觀探索地圖：以大型森林岩體、寬闊環路與長距離橫越製造繞路判斷，不使用微小操作當作難度。',
      routeBeats: ['安全入口', '雙路巨礁', '橫向倒木棚', '沉沒花園', '托里切利回返洞', '下層教堂', '雙路熱泉門檻', '稜鏡巨蟹封印房'],
      mainAxisColumn: 9,
      minimumRouteWidth: 5,
      originalHeight: 72,
      explorationLoops: [
        { id: 'forest-monolith', splitRow: 8, mergeRow: 36, routes: ['west', 'east'] },
        { id: 'sunken-garden', splitRow: 72, mergeRow: 100, routes: ['west', 'east'] },
        { id: 'lower-cathedral', splitRow: 100, mergeRow: 136, routes: ['west', 'east'] },
        { id: 'hot-spring-threshold', splitRow: 136, mergeRow: 158, routes: ['west', 'east'] },
      ],
      broadRouteSamples: [
        { row: 8, column: 9 }, { row: 18, column: 9 }, { row: 18, column: 13 },
        { row: 44, column: 4 }, { row: 60, column: 9 }, { row: 80, column: 9 },
        { row: 82, column: 14 }, { row: 112, column: 7 }, { row: 120, column: 14 },
        { row: 128, column: 4 }, { row: 144, column: 4 }, { row: 144, column: 13 },
      ],
      torricelliDetours: [
        { side: 'left', region: 'torricelli-ascent-early-left', objectRow: 12, objectColumn: 1, ascentEndRow: 22, junctionRow: 23, junctionColumn: 8, ascentRows: 11, terminalRestRows: TORRICELLI_TERMINAL_REST_ROWS, shaftWidth: 4, separationWallWidth: 2 },
        { side: 'right', region: 'torricelli-ascent-right', objectRow: 39, objectColumn: 16, ascentEndRow: 57, junctionRow: 57, junctionColumn: 12, ascentRows: 19, terminalRestRows: TORRICELLI_TERMINAL_REST_ROWS, shaftWidth: 4, separationWallWidth: 3 },
        { side: 'left', region: 'torricelli-ascent-mid-left', objectRow: 62, objectColumn: 1, ascentEndRow: 78, junctionRow: 79, junctionColumn: 8, ascentRows: 17, terminalRestRows: TORRICELLI_TERMINAL_REST_ROWS, shaftWidth: 4, separationWallWidth: 2 },
        { side: 'left', region: 'torricelli-ascent-left', objectRow: 87, objectColumn: 1, ascentEndRow: 109, junctionRow: 110, junctionColumn: 8, ascentRows: 23, terminalRestRows: TORRICELLI_TERMINAL_REST_ROWS, shaftWidth: 4, separationWallWidth: 2 },
      ],
      teachingSequence: [
        '氧氣礦石：先在安全直道練習以足夠速度撞開。',
        '彈簧水母＋氧氣：利用反彈取得偏離主路的補給。',
        '光合作用氣泡＋上浮水域：看懂暫時免疫重力的用途。',
        '海草＋潮流：練習先固定、觀察，再選擇發射時機。',
        '托里切利空間：先越過偏軸岔口，再逆著下沉方向向上折返取得持續氧氣。',
        '珊瑚群落：先認得保護範圍，第二部分才加入傷害物。',
      ],
      endGoal: '穿過熱泉門檻，在不可逃離的封印房擊敗稜鏡巨蟹。',
    },
  });
  paintPart1Terrain(map);
  addActor(map, 'playerStart', 3, 9);
  [[18, 4], [24, 14], [45, 4], [65, 13], [84, 9], [92, 14], [120, 4], [128, 13], [146, 4]].forEach(([row, column]) => addActor(map, 'enemySpawn', row, column));
  const used = new Set();
  [
    ['oxygen', 6, 9], ['torricelli', 12, 1], ['bubble', 17, 4], ['oxygen', 25, 14],
    ['checkpoint', 35, 9], ['torricelli', 39, 16], ['oxygen', 50, 3],
    ['bubble', 60, 9], ['torricelli', 62, 1], ['checkpoint', 72, 9], ['oxygen', 84, 9],
    ['torricelli', 87, 1], ['bubble', 90, 14], ['oxygen', 96, 9],
    ['checkpoint', 103, 9], ['oxygen', 118, 14], ['bubble', 126, 4],
    ['checkpoint', 136, 9], ['oxygen', 146, 13], ['checkpoint', 157, 9],
  ].forEach(([kind, row, column]) => addFreeObject(map, kind, row, column, used));
  addFreeObject(map, 'oxygen', 171, 4, used);
  addFreeObject(map, 'bubble', 176, 13, used);
  const miniBossCellKey = addActor(map, 'miniBossSpawn', 173, 9, { enemyId: 'prismCrabGuardian' });
  const triggerCellKey = cellKeyFromColumn(9, 167);
  const entranceGateCellKeys = addBossRoomGateWall(map, 164, [8, 9, 10], 'entrance');
  const exitGateCellKeys = addBossRoomGateWall(map, 181, [8, 9, 10], 'exit');
  map.metadata.bossRoom = {
    id: 'prism-crab-sanctum',
    enemyId: 'prismCrabGuardian',
    miniBossCellKey,
    triggerCellKey,
    entranceGateCellKeys,
    exitGateCellKeys,
    room: { rowStart: 165, rowEnd: 180, columnStart: 2, columnEnd: 15 },
  };
  addEdgeSet(map, 'springJelly', [15, 42, 78, 118, 144]);
  addEdgeNear(map, 'current', 57, 15, { currentDirection: 5, currentStrength: 1.08 });
  addEdgeNear(map, 'current', 109, 2, { currentDirection: 4, currentStrength: 1.18 });
  addEdgeNear(map, 'current', 65, 9, { currentDirection: 5, currentStrength: 0.92 });
  addEdgeNear(map, 'current', 128, 13, { currentDirection: 4, currentStrength: 0.98 });
  addEdgeNear(map, 'spike', 105, 2);
  addEdgeSet(map, 'seaweed', [14, 22, 26, 34, 42, 50, 55, 64, 72, 82, 90, 100, 110, 120, 126, 136, 144, 150, 156, 158]);
  addEdgeSet(map, 'coralCluster', [8, 12, 18, 20, 28, 34, 42, 50, 58, 64, 68, 76, 84, 92, 98, 106, 114, 122, 134, 140, 146, 152, 156, 158]);
  addWallGillRoutes(map, [18], 'descent-part1-wall-gill');
  setRuntimeExit(map, 183, 9);
  return map;
}

function paintPart2Terrain(map) {
  const vents = [
    { row: 15, column: 6 }, { row: 34, column: 13 },
    { row: 57, column: 6 }, { row: 77, column: 13 },
  ];
  Object.values(map.cells).forEach((cell) => {
    const column = columnOf(cell);
    const section = Math.min(3, Math.floor(cell.r / 22));
    const center = section % 2 === 0 ? 8 : 11;
    cell.region = ['warm-current-mouth', 'split-spring-basin', 'pressure-lock', 'thermal-rise'][section];
    cell.gravityLevel = section === 0 ? 'L1' : section === 1 ? 'L2' : section === 2 ? 'L1' : 'L2';
    cell.waterLayer = section === 0 ? 'T1' : 'T2';
    if (cell.r % 22 >= 16 && cell.r % 22 <= 19 && Math.abs(column - center) <= 2) cell.gravityLevel = 'L3';
    const outsideRoute = column <= 0 || column >= map.layout.width - 1 || Math.abs(column - center) > 6;
    const ventRock = vents.some((vent) => {
      const rowDistance = Math.abs(cell.r - vent.row);
      const columnDistance = Math.abs(column - vent.column);
      return rowDistance + columnDistance <= 2;
    });
    const switchBank = cell.r >= 25 && cell.r <= 30 && column >= 14 && column <= 16;
    const pressureBank = cell.r >= 50 && cell.r <= 54 && column >= 3 && column <= 5;
    if (outsideRoute || ventRock || switchBank || pressureBank) {
      makeRock(cell, outsideRoute ? 'thermal-crust' : ventRock ? 'thermal-vent-rock' : 'thermal-bank');
    }
  });

  // Part 2 needs four reliable oxygen decisions, not four objects placed on
  // the center line. Each shaft is separated from the main thermal route by
  // a rock column and only reconnects through a lower junction, so the player
  // must descend farther before turning back upward for the refill.
  PART2_TORRICELLI_DETOURS.forEach((detour) => {
    carveTorricelliDetour(map, detour);
    carveRoom(map, {
      rowStart: detour.junctionRow,
      rowEnd: detour.junctionEndRow,
      columnStart: detour.junctionColumnStart,
      columnEnd: detour.junctionColumnEnd,
      region: detour.junctionRegion,
      gravityLevel: 'L1',
      waterLayer: detour.waterLayer,
    });
  });
}

const PART2_TORRICELLI_DETOURS = Object.freeze([
  Object.freeze({
    side: 'right',
    region: 'torricelli-ascent-part2-early-east',
    junctionRegion: 'torricelli-junction-part2-early-east',
    objectRow: 8,
    objectColumn: 16,
    ascentEndRow: 16,
    junctionRow: 17,
    junctionEndRow: 21,
    columnStart: 16,
    columnEnd: 18,
    junctionColumn: 12,
    junctionColumnStart: 11,
    junctionColumnEnd: 18,
    waterLayer: 'T1',
    shaftWidth: 3,
    separationWallWidth: 1,
  }),
  Object.freeze({
    side: 'left',
    region: 'torricelli-ascent-part2-mid-west',
    junctionRegion: 'torricelli-junction-part2-mid-west',
    objectRow: 24,
    objectColumn: 1,
    ascentEndRow: 33,
    junctionRow: 34,
    junctionEndRow: 38,
    columnStart: 1,
    columnEnd: 3,
    junctionColumn: 8,
    junctionColumnStart: 1,
    junctionColumnEnd: 10,
    waterLayer: 'T2',
    shaftWidth: 3,
    separationWallWidth: 1,
  }),
  Object.freeze({
    side: 'right',
    region: 'torricelli-ascent-part2-pressure-east',
    junctionRegion: 'torricelli-junction-part2-pressure-east',
    objectRow: 46,
    objectColumn: 16,
    ascentEndRow: 55,
    junctionRow: 56,
    junctionEndRow: 60,
    columnStart: 16,
    columnEnd: 18,
    junctionColumn: 12,
    junctionColumnStart: 11,
    junctionColumnEnd: 18,
    waterLayer: 'T2',
    shaftWidth: 3,
    separationWallWidth: 1,
  }),
  Object.freeze({
    side: 'left',
    region: 'torricelli-ascent-part2-thermal-west',
    junctionRegion: 'torricelli-junction-part2-thermal-west',
    objectRow: 68,
    objectColumn: 1,
    ascentEndRow: 78,
    junctionRow: 79,
    junctionEndRow: 83,
    columnStart: 1,
    columnEnd: 3,
    junctionColumn: 8,
    junctionColumnStart: 1,
    junctionColumnEnd: 10,
    waterLayer: 'T2',
    shaftWidth: 3,
    separationWallWidth: 1,
  }),
]);

function buildPart2() {
  const map = createAuthoredMap({
    width: 20,
    height: 106,
    metadata: {
      chapter: '下沉篇', part: 2, title: '下沉篇・第二部分｜穿越熱泉', difficulty: 'medium',
      designIntent: '完全獨立的熱泉路線：左右熱泉室交替，以四條偏軸托里切利回返洞提供高風險但穩定的氧氣，再穿越 L3 脈衝與可選傳送捷徑。',
      routeBeats: ['暖流入口', '左右熱泉分流', '四條托里切利回返洞', '開門支路', '壓力閘門', '傳送捷徑', '潮律鸚鵡螺封印房'],
      torricelliDetours: PART2_TORRICELLI_DETOURS.map((detour) => ({
        side: detour.side,
        region: detour.region,
        objectRow: detour.objectRow,
        objectColumn: detour.objectColumn,
        ascentEndRow: detour.ascentEndRow,
        junctionRow: detour.junctionRow,
        junctionColumn: detour.junctionColumn,
        ascentRows: detour.ascentEndRow - detour.objectRow + 1,
        terminalRestRows: TORRICELLI_TERMINAL_REST_ROWS,
        shaftWidth: detour.shaftWidth,
        separationWallWidth: detour.separationWallWidth,
        waterLayer: detour.waterLayer,
      })),
      teachingSequence: [
        '層間轉接門：第一次從 T1 進入 T2，入口沒有其他危險。',
        '珊瑚＋地雷：先在保護範圍理解反彈，再遇到無保護地雷。',
        '墨水＋潮流：視野縮小後，用既有的潮流判讀維持方向。',
        '重石＋彈簧水母：借助反彈速度擊碎擋路重石。',
        '支路按鈕＋封印閘門：離開主路取得開門權，再回到中軸。',
        '四條托里切利回返洞：先走偏軸高風險支路，下沉到接點後逆著重力回返，換取穩定氧氣。',
        '氣泡＋L3 脈衝＋剃刀：最後把重力免疫、路線控制與傷害迴避合併考核。',
        '多邊傳送捷徑：高手可冒險跳過閘門後半，失敗則走穩定主路。',
      ],
      endGoal: '穿越熱泉後直接進入潮律鸚鵡螺封印房，解除封印後前往下沉篇第三部分。',
    },
  });
  paintPart2Terrain(map);
  const gateKeys = addConditionalGateWall(map, 44, [9, 10]);
  addActor(map, 'playerStart', 3, 8);
  [[18, 13], [38, 5], [59, 14], [78, 6]].forEach(([row, column]) => addActor(map, 'enemySpawn', row, column));
  const used = new Set();
  [
    ['oxygen', 6, 7], ['bubble', 11, 12],
    ...PART2_TORRICELLI_DETOURS.map((detour) => ['torricelli', detour.objectRow, detour.objectColumn]),
    ['checkpoint', 22, 11], ['mine', 27, 15], ['button', 31, 4],
    ['mine', 35, 14], ['oxygen', 40, 7], ['weightStone', 42, 13],
    ['checkpoint', 48, 5], ['ink', 52, 14], ['bubble', 58, 7],
    ['razor', 63, 13], ['oxygen', 68, 5], ['weightStone', 71, 14],
    ['ink', 74, 4], ['razor', 78, 14], ['checkpoint', 82, 8],
  ].forEach(([kind, row, column]) => addFreeObject(map, kind, row, column, used, kind === 'button' ? { targetGates: gateKeys } : {}));
  addEdgeSet(map, 'current', [8, 28, 52, 73]);
  addEdgeSet(map, 'springJelly', [14, 37, 60, 80]);
  addEdgeSet(map, 'spike', [33, 67]);
  addEdgeSet(map, 'barrier', [41, 76]);
  addEdgeSet(map, 'seaweed', [14, 20, 32, 44, 56, 68, 76, 84]);
  addEdgeSet(map, 'coralCluster', [9, 18, 27, 36, 45, 54, 63, 72, 78, 81, 83, 86]);
  addLayerPortal(map, 21);
  addLinkedPortal(map, 16, 70, 'part2-thermal-shortcut', new Set());
  addWallGillRoutes(map, [29, 64], 'descent-part2-wall-gill');
  // Part 2 ends at a dedicated Tide-Law Nautilus room. There is no visible
  // EXIT marker at the approach: entering the room seals its three-cell
  // throat, and clearing the encounter advances directly to Part 3.
  carveRoom(map, { rowStart: 88, rowEnd: 100, columnStart: 5, columnEnd: 15, region: 'tide-law-sanctum', gravityLevel: 'L0', waterLayer: 'T2' });
  carveRoom(map, { rowStart: 101, rowEnd: 101, columnStart: 8, columnEnd: 12, region: 'tide-law-sanctum-exit', gravityLevel: 'L0', waterLayer: 'T2' });
  carveRoom(map, { rowStart: 102, rowEnd: 105, columnStart: 8, columnEnd: 12, region: 'tide-law-sanctum-transition', gravityLevel: 'L0', waterLayer: 'T2' });
  const miniBossCellKey = addActor(map, 'miniBossSpawn', 95, 10, { enemyId: 'tideLawNautilus' });
  const triggerCellKey = cellKeyFromColumn(10, 89);
  const entranceGateCellKeys = addBossRoomGateWall(map, 87, [9, 10, 11], 'entrance');
  const exitGateCellKeys = addBossRoomGateWall(map, 101, [9, 10, 11], 'exit');
  const torricelliCellKey = addFreeObject(map, 'torricelli', 89, 14, used);
  map.metadata.bossRoom = {
    id: 'tide-law-sanctum',
    enemyId: 'tideLawNautilus',
    miniBossCellKey,
    triggerCellKey,
    entranceGateCellKeys,
    exitGateCellKeys,
    torricelliCellKey,
    autoAdvancePart: 3,
    room: { rowStart: 88, rowEnd: 100, columnStart: 5, columnEnd: 15 },
  };
  setRuntimeExit(map, 104, 10);
  return map;
}

function removeInvalidButtons(map) {
  Object.values(map.cells).forEach((cell) => {
    cell.freeObjects = cell.freeObjects.filter((object) => (
      object.kind !== 'button' || (object.targetGates ?? []).some((key) => map.cells[key]?.conditionalGate)
    ));
  });
}

function buildPart3(source) {
  const map = preparePlayerFinaleMap(source, {
    chapter: '下沉篇', part: 3, title: '下沉篇・第三部分｜深淵遺跡', difficulty: 'hard',
    designIntent: '完整保留玩家設計的第三部分地形與傳送結構，把前兩部分教過的所有物件改成不提示的複合考題。',
    routeBeats: ['原始遺跡入口', '重力與層間門考題', '環境傷害混合區', '多邊傳送迷陣', 'Boss 前補給', '深淵收束'],
    teachingSequence: [
      '不再逐項教學：氧氣、氣泡、珊瑚保護與傷害物開始交錯出現。',
      '重石、潮流與彈簧水母形成速度題，要求玩家自己創造足夠撞擊力。',
      '墨水遮蔽層間門與多邊傳送線索，考驗前兩部分建立的路線記憶。',
      '最後一個檢查點補滿資源，之後才進入 Boss 出生區。',
    ],
    endGoal: '完成玩家原始遺跡路線、擊敗深淵抹香鯨，並抵達末段出口。',
  });
  removeInvalidButtons(map);
  repairPart3PortalRoute(map);
  deduplicateCellObjectKind(map, 'torricelli');
  // Part 3 ends with its own Abyssal Throne room. Keep the authored Final
  // Boss spawn, but give the last encounter the same broad room and two-sided
  // seal contract already used by the first two descent parts.
  carveRoomKeepingSourcePhysics(map, { rowStart: 108, rowEnd: 114, columnStart: 6, columnEnd: 18, region: 'abyssal-throne' });
  carveRoomKeepingSourcePhysics(map, { rowStart: 115, rowEnd: 115, columnStart: 9, columnEnd: 15, region: 'abyssal-throne-exit' });
  addActor(map, 'playerStart', 3, 12);
  [[20, 5], [35, 18], [52, 7], [70, 19], [88, 5], [104, 18]].forEach(([row, column]) => addActor(map, 'enemySpawn', row, column));
  addActor(map, 'miniBossSpawn', 92, 12, { enemyId: 'tideLawNautilus' });
  const bossCellKey = addActor(map, 'bossSpawn', 114, 12, { enemyId: 'abyssalSpermWhale' });
  const triggerCellKey = cellKeyFromColumn(12, 109);
  const entranceGateCellKeys = addBossRoomGateWall(map, 107, [9, 10, 11], 'entrance');
  const exitGateCellKeys = addBossRoomGateWall(map, 115, [10, 11, 12], 'exit');
  const used = new Set(Object.entries(map.cells).filter(([, cell]) => cell.freeObjects.length).map(([key]) => key));
  [
    ['oxygen', 15, 3], ['bubble', 24, 18], ['mine', 33, 8],
    ['checkpoint', 43, 21], ['weightStone', 55, 4], ['ink', 61, 17],
    ['oxygen', 69, 7], ['bubble', 76, 20], ['mine', 88, 4],
    ['checkpoint', 97, 18], ['weightStone', 103, 9], ['ink', 109, 21],
    ['oxygen', 113, 3], ['bubble', 116, 14], ['razor', 100, 20],
    // The bright L-1 side pockets need readable oxygen-rest stops, not a
    // single isolated pickup every few dozen rows.
    ['torricelli', 28, 22], ['torricelli', 61, 21],
  ].forEach(([kind, row, column]) => addFreeObject(map, kind, row, column, used));
  const torricelliCellKey = addFreeObject(map, 'torricelli', 109, 17, used);
  addEdgeSet(map, 'springJelly', [18, 46, 78, 108]);
  addEdgeSet(map, 'spike', [23, 57, 91, 104]);
  addEdgeSet(map, 'barrier', [37, 73, 99]);
  addEdgeSet(map, 'current', [12, 52, 82, 112]);
  addEdgeSet(map, 'seaweed', [27, 68, 96]);
  addEdgeSet(map, 'coralCluster', [42, 76, 106]);
  // Keep every authored object on the portal/gate-aware playable route. These
  // relocations preserve the original object mix without leaving dead content
  // inside sealed water pockets copied from the player's Part 3 template.
  moveFreeObject(map, '-7,38', '-8,37', 'razor');
  moveFreeObject(map, '2,43', '3,40', 'checkpoint');
  [
    ['-16,78|-16,79', '-18,78|-19,78'],
    ['-22,91|-23,91', '-23,91|-24,92'],
    ['-13,73|-14,73', '-15,72|-16,72'],
    ['-26,99|-27,100', '-27,98|-27,99'],
    ['-11,68|-11,69', '-13,66|-13,67'],
    ['-25,96|-25,97', '-25,96|-26,96'],
    ['-15,76|-15,77', '-17,76|-18,76'],
    ['-30,106|-30,107', '-32,104|-32,105'],
  ].forEach(([fromKey, toKey]) => moveExistingEdge(map, fromKey, toKey));
  addReachableSupportSet(map, 'seaweed', [10, 18, 36, 45, 55, 70, 82, 100, 114]);
  addReachableSupportSet(map, 'coralCluster', [14, 24, 34, 52, 62, 86, 104, 112, 116]);
  addWallGillRoutes(map, [28, 70, 106], 'descent-part3-wall-gill');
  map.metadata.bossRoom = {
    id: 'abyssal-throne',
    enemyId: 'abyssalSpermWhale',
    bossCellKey,
    triggerCellKey,
    entranceGateCellKeys,
    exitGateCellKeys,
    torricelliCellKey,
    room: { rowStart: 108, rowEnd: 114, columnStart: 6, columnEnd: 18 },
  };
  setRuntimeExit(map, 116, 12);
  return map;
}

const ASCENT_CHALLENGE = Object.freeze({
  1: Object.freeze({ enemyTargetCount: 24, oxygen: 4, torricelli: 3, checkpoints: 3, ink: 2, spikeRows: [18, 39, 61, 83, 105, 127, 149], currentRows: [52, 118], barrierRows: [73, 139], extraEnemyAnchors: 3 }),
  2: Object.freeze({ enemyTargetCount: 28, oxygen: 2, torricelli: 1, checkpoints: 2, ink: 5, spikeRows: [9, 19, 29, 39, 49, 59, 69, 79], currentRows: [15, 36, 57, 78], barrierRows: [25, 65], extraEnemyAnchors: 4 }),
  3: Object.freeze({ enemyTargetCount: 32, oxygen: 1, torricelli: 1, checkpoints: 1, ink: 8, spikeRows: [8, 18, 28, 38, 48, 58, 68, 78, 88, 98], currentRows: [14, 34, 54, 74, 94, 112], barrierRows: [24, 64, 104], extraEnemyAnchors: 5 }),
});

function mirroredCellKey(map, sourceKey) {
  const sourceCell = map.cells[sourceKey];
  if (!sourceCell) return sourceKey;
  const mirroredRow = map.layout.height - 1 - sourceCell.r;
  // An even-height odd-r rectangle needs a 180-degree inversion to preserve
  // every hex adjacency. An odd-height rectangle preserves parity under a
  // direct vertical reflection, so its columns remain unchanged.
  const mirroredColumn = map.layout.height % 2 === 0
    ? map.layout.width - 1 - columnOf(sourceCell)
    : columnOf(sourceCell);
  return cellKeyFromColumn(mirroredColumn, mirroredRow);
}

function mirrorMapVertically(source, part) {
  const map = createEmptyMap({ width: source.layout.width, height: source.layout.height });
  map.version = Math.max(2, Number(source.version) || 1);
  map.chapterStates = {
    chapter1: { cells: {}, edges: {} },
    chapter2: { cells: {}, edges: {} },
  };
  const keyMap = new Map(Object.keys(source.cells).map((key) => [key, mirroredCellKey(source, key)]));
  Object.entries(source.cells).forEach(([sourceKey, sourceCell]) => {
    const targetKey = keyMap.get(sourceKey);
    const mirroredRow = source.layout.height - 1 - sourceCell.r;
    const mirroredCell = clone(sourceCell);
    mirroredCell.q = Number(targetKey.split(',')[0]);
    mirroredCell.r = mirroredRow;
    mirroredCell.freeObjects = (mirroredCell.freeObjects ?? []).map((object) => ({
      ...object,
      ...(Array.isArray(object.targetGates)
        ? { targetGates: object.targetGates.map((key) => keyMap.get(key) ?? key) }
        : {}),
    }));
    map.cells[targetKey] = mirroredCell;
  });
  Object.values(map.cells).forEach((cell) => {
    if (!cell.conditionalGate?.bossRoomGate) return;
    cell.terrain = 'water';
    cell.conditionalGate = null;
  });

  const edgeKeyMap = new Map();
  Object.entries(source.edges).forEach(([sourceEdgeKey, sourceEdge]) => {
    const cells = (sourceEdge.cells ?? []).map((key) => keyMap.get(key) ?? key);
    if (cells.length !== 2) return;
    edgeKeyMap.set(sourceEdgeKey, edgeKey(cells[0], cells[1]));
  });
  Object.entries(source.edges).forEach(([sourceEdgeKey, sourceEdge]) => {
    const targetEdgeKey = edgeKeyMap.get(sourceEdgeKey);
    if (!targetEdgeKey) return;
    const mirroredEdge = clone(sourceEdge);
    mirroredEdge.cells = (sourceEdge.cells ?? []).map((key) => keyMap.get(key) ?? key);
    if (mirroredEdge.type === 'current') {
      const directionMap = source.layout.height % 2 === 0
        ? [3, 4, 5, 0, 1, 2]
        : [0, 5, 4, 3, 2, 1];
      mirroredEdge.currentDirection = directionMap[Number(mirroredEdge.currentDirection) || 0];
    }
    if (mirroredEdge.portalTargetKey) {
      mirroredEdge.portalTargetKey = edgeKeyMap.get(mirroredEdge.portalTargetKey) ?? mirroredEdge.portalTargetKey;
    }
    map.edges[targetEdgeKey] = mirroredEdge;
  });

  const challenge = ASCENT_CHALLENGE[part];
  const ascentTitles = {
    1: '上升篇・第一部分｜逆游深海遺跡',
    2: '上升篇・第二部分｜逆穿熱泉',
    3: '上升篇・第三部分｜重返森林出口',
  };
  map.metadata = {
    ...clone(source.metadata),
    chapter: '上升篇',
    arc: 'ascent',
    part,
    title: ascentTitles[part],
    difficulty: ['hard', 'very-hard', 'extreme'][part - 1],
    source: `下沉篇第${part}部分垂直鏡像＋上升篇強化（scripts/generate-chapter-maps.mjs）`,
    mirroredFrom: `下沉篇-第${part}部分.json`,
    mirrorAxis: source.layout.height % 2 === 0 ? 'hex-safe-180' : 'vertical',
    exitCellKey: keyMap.get(source.metadata.exitCellKey) ?? source.metadata.exitCellKey,
    enemyTargetCount: challenge.enemyTargetCount,
    routeBeats: [...(source.metadata.routeBeats ?? [])].reverse(),
    designIntent: '保留下沉篇同部位的完整地形與機關體驗，垂直鏡像為由底向上的逆重力返航，再以更密集敵群、尖刺、迷霧與更少補氧形成強化版。',
    ascentChallenge: {
      enemyTargetCount: challenge.enemyTargetCount,
      oxygenSupply: challenge.oxygen,
      torricelliSupply: challenge.torricelli,
      checkpoints: challenge.checkpoints,
      inkZones: challenge.ink,
      addedSpikes: challenge.spikeRows.length,
      addedCurrents: challenge.currentRows.length,
      addedBarriers: challenge.barrierRows.length,
      forcedDetours: challenge.barrierRows.length,
    },
  };
  delete map.metadata.torricelliDetours;
  delete map.metadata.broadRouteSamples;
  delete map.metadata.explorationLoops;
  // The sealed Prism Crab room is a one-way descent encounter. The mirrored
  // ascent keeps the geometry and enemy but must not inherit downward trigger
  // keys or the descent-only progression lock.
  delete map.metadata.bossRoom;
  return map;
}

function retainDistributedFreeObjects(map, kind, keepCount) {
  const entries = Object.entries(map.cells)
    .flatMap(([key, cell]) => (cell.freeObjects ?? []).map((object, index) => ({ key, cell, object, index })))
    .filter((entry) => entry.object.kind === kind)
    .sort((left, right) => right.cell.r - left.cell.r || columnOf(left.cell) - columnOf(right.cell));
  if (entries.length <= keepCount) return entries.length;
  const selected = new Set();
  if (keepCount === 1) selected.add(`${entries[Math.floor(entries.length / 2)].key}:${entries[Math.floor(entries.length / 2)].index}`);
  for (let index = 0; index < keepCount && keepCount > 1; index += 1) {
    const position = Math.round(index * (entries.length - 1) / (keepCount - 1));
    selected.add(`${entries[position].key}:${entries[position].index}`);
  }
  Object.entries(map.cells).forEach(([key, cell]) => {
    cell.freeObjects = (cell.freeObjects ?? []).filter((object, index) => (
      object.kind !== kind || selected.has(`${key}:${index}`)
    ));
  });
  return selected.size;
}

function occupiedFreeObjectCells(map) {
  return new Set(Object.entries(map.cells)
    .filter(([, cell]) => (cell.freeObjects ?? []).length > 0)
    .map(([key]) => key));
}

function addFreeObjectNearRow(map, kind, targetRow, columnHint, used) {
  for (let distance = 0; distance < map.layout.height; distance += 1) {
    for (const row of [targetRow + distance, targetRow - distance]) {
      if (row < 0 || row >= map.layout.height) continue;
      const cell = chooseWaterCell(map, row, columnHint, used);
      if (!cell) continue;
      return addFreeObject(map, kind, row, columnOf(cell), used);
    }
  }
  throw new Error(`找不到可放置 ${kind} 的上升篇水域`);
}

function addAscentChallengeObjects(map, part) {
  const challenge = ASCENT_CHALLENGE[part];
  retainDistributedFreeObjects(map, 'oxygen', challenge.oxygen);
  retainDistributedFreeObjects(map, 'torricelli', challenge.torricelli);
  retainDistributedFreeObjects(map, 'checkpoint', challenge.checkpoints);
  const used = occupiedFreeObjectCells(map);
  const existingInk = Object.values(map.cells).flatMap((cell) => cell.freeObjects ?? []).filter((object) => object.kind === 'ink').length;
  for (let index = existingInk; index < challenge.ink; index += 1) {
    const progress = (index + 1) / (challenge.ink + 1);
    const row = Math.round((map.layout.height - 1) * (1 - progress));
    const column = index % 2 === 0 ? Math.max(2, Math.floor(map.layout.width * 0.28)) : Math.min(map.layout.width - 3, Math.ceil(map.layout.width * 0.72));
    addFreeObjectNearRow(map, 'ink', row, column, used);
  }
}

function addAscentEnemyAnchors(map, part) {
  const challenge = ASCENT_CHALLENGE[part];
  const used = new Set(Object.entries(map.cells)
    .filter(([, cell]) => (cell.actors ?? []).some((actor) => actor.kind === 'enemySpawn'))
    .map(([key]) => key));
  for (let index = 0; index < challenge.extraEnemyAnchors; index += 1) {
    const progress = (index + 1) / (challenge.extraEnemyAnchors + 1);
    const row = Math.round((map.layout.height - 1) * (1 - progress));
    for (let distance = 0; distance < map.layout.height; distance += 1) {
      const candidateRow = row + (index % 2 === 0 ? distance : -distance);
      if (candidateRow < 0 || candidateRow >= map.layout.height) continue;
      const cell = chooseWaterCell(map, candidateRow, index % 2 === 0 ? 4 : map.layout.width - 5, used);
      if (!cell) continue;
      cell.actors.push({ kind: 'enemySpawn' });
      used.add(cellKey(cell));
      break;
    }
  }
}

function buildAscentPart(source, part) {
  const map = mirrorMapVertically(source, part);
  const challenge = ASCENT_CHALLENGE[part];
  addAscentChallengeObjects(map, part);
  addAscentEnemyAnchors(map, part);
  addEdgeSet(map, 'spike', challenge.spikeRows);
  addEdgeSet(map, 'current', challenge.currentRows);
  addPassageBarrierSet(map, challenge.barrierRows);
  return normalizeMapObjectSizes(map);
}

const descentOutputs = [
  ['下沉篇-第1部分.json', buildPart1()],
  ['下沉篇-第2部分.json', buildPart2()],
  ['下沉篇-第3部分.json', buildPart3(JSON.parse(readFileSync(sourcePath, 'utf8')))],
].map(([name, map]) => [name, migratePhotosynthesisBubbleDefault(normalizeMapObjectSizes(map))]);
const ascentOutputs = descentOutputs.map(([name, map], index) => [
  name.replace('下沉篇', '上升篇'),
  migratePhotosynthesisBubbleDefault(buildAscentPart(map, index + 1)),
]);
descentOutputs.forEach(([name, map]) => writeFileSync(join(descentOutputDir, name), `${JSON.stringify(map, null, 2)}\n`, 'utf8'));
ascentOutputs.forEach(([name, map]) => writeFileSync(join(ascentOutputDir, name), `${JSON.stringify(map, null, 2)}\n`, 'utf8'));
console.log(`generated ${descentOutputs.length} descent maps and ${ascentOutputs.length} mirrored ascent maps; part 3 preserves the player's original template`);
