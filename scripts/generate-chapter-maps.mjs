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
} from '../src/map-object-settings.js';

const root = resolve('.');
const sourcePath = join(root, '範本map.json');
const outputDir = join(root, 'maps', '下沉篇');
mkdirSync(outputDir, { recursive: true });

const cellKey = (cell) => `${cell.q},${cell.r}`;
const columnOf = (cell) => cell.q + Math.floor(cell.r / 2);
const clone = (value) => JSON.parse(JSON.stringify(value));

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

function carveWaterCell(map, row, column, region, gravityLevel = 'L1') {
  if (row < 0 || row >= map.layout.height || column <= 0 || column >= map.layout.width - 1) return;
  const cell = map.cells[cellKeyFromColumn(column, row)];
  if (!cell) return;
  cell.terrain = 'water';
  cell.gravityLevel = gravityLevel;
  cell.waterLayer = 'T1';
  cell.region = region;
  cell.conditionalGate = null;
}

function carveRoom(map, { rowStart, rowEnd, columnStart, columnEnd, region, gravityLevel = 'L1' }) {
  for (let row = rowStart; row <= rowEnd; row += 1) {
    for (let column = columnStart; column <= columnEnd; column += 1) {
      carveWaterCell(map, row, column, region, gravityLevel);
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
  });
  if (terminalEndRow < safeAscentEndRow) {
    carveRoom(map, {
      rowStart: terminalEndRow + 1,
      rowEnd: safeAscentEndRow,
      columnStart,
      columnEnd,
      region,
      gravityLevel: 'L-1',
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
    { column: 8, row: 8 }, { column: 4, row: 16 }, { column: 4, row: 29 }, { column: 9, row: 36 },
  ], 'monolith-west-route');
  carveBroadRoute(map, [
    { column: 10, row: 8 }, { column: 13, row: 16 }, { column: 14, row: 29 }, { column: 9, row: 36 },
  ], 'monolith-east-route');
  carveBroadRoute(map, [
    { column: 4, row: 20 }, { column: 1, row: 20 }, { column: 1, row: 14 },
  ], 'upper-oxygen-grotto', 'L0');

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
}

function buildPart1() {
  const map = createAuthoredMap({
    width: 18,
    height: 160,
    metadata: {
      chapter: '下沉篇', part: 1, title: '下沉篇・第一部分｜深海森林入口', difficulty: 'light',
      designIntent: '超過原長度兩倍的宏觀探索地圖：以大型森林岩體、寬闊環路與長距離橫越製造繞路判斷，不使用微小操作當作難度。',
      routeBeats: ['安全入口', '雙路巨礁', '橫向倒木棚', '沉沒花園', '托里切利回返洞', '下層教堂', '雙路熱泉門檻'],
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
        { row: 8, column: 9 }, { row: 18, column: 4 }, { row: 18, column: 13 },
        { row: 44, column: 4 }, { row: 60, column: 9 }, { row: 80, column: 9 },
        { row: 82, column: 14 }, { row: 112, column: 7 }, { row: 120, column: 14 },
        { row: 128, column: 4 }, { row: 144, column: 4 }, { row: 144, column: 13 },
      ],
      torricelliDetours: [
        { side: 'right', region: 'torricelli-ascent-right', objectRow: 39, objectColumn: 16, ascentEndRow: 57, junctionRow: 57, junctionColumn: 12, ascentRows: 19, terminalRestRows: TORRICELLI_TERMINAL_REST_ROWS, shaftWidth: 4, separationWallWidth: 3 },
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
      endGoal: '抵達森林底部的熱泉門檻。',
    },
  });
  paintPart1Terrain(map);
  addActor(map, 'playerStart', 3, 9);
  [[18, 4], [24, 14], [45, 4], [65, 13], [84, 9], [92, 14], [120, 4], [128, 13], [146, 4]].forEach(([row, column]) => addActor(map, 'enemySpawn', row, column));
  const used = new Set();
  [
    ['oxygen', 6, 9], ['bubble', 17, 4], ['oxygen', 25, 14],
    ['checkpoint', 35, 9], ['torricelli', 39, 16], ['oxygen', 50, 3],
    ['bubble', 60, 9], ['checkpoint', 72, 9], ['oxygen', 84, 9],
    ['torricelli', 87, 1], ['bubble', 90, 14], ['oxygen', 96, 9],
    ['checkpoint', 103, 9], ['oxygen', 118, 14], ['bubble', 126, 4],
    ['checkpoint', 136, 9], ['oxygen', 146, 13], ['checkpoint', 157, 9],
  ].forEach(([kind, row, column]) => addFreeObject(map, kind, row, column, used));
  addEdgeSet(map, 'springJelly', [15, 42, 78, 118, 144]);
  addEdgeNear(map, 'current', 57, 15, { currentDirection: 5, currentStrength: 1.08 });
  addEdgeNear(map, 'current', 109, 2, { currentDirection: 4, currentStrength: 1.18 });
  addEdgeNear(map, 'current', 65, 9, { currentDirection: 5, currentStrength: 0.92 });
  addEdgeNear(map, 'current', 128, 13, { currentDirection: 4, currentStrength: 0.98 });
  addEdgeNear(map, 'spike', 105, 2);
  addEdgeSet(map, 'seaweed', [26, 55, 90, 126, 150]);
  addEdgeSet(map, 'coralCluster', [12, 34, 68, 98, 134, 156]);
  setRuntimeExit(map, 157, 9);
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
}

function buildPart2() {
  const map = createAuthoredMap({
    width: 20,
    height: 88,
    metadata: {
      chapter: '下沉篇', part: 2, title: '下沉篇・第二部分｜穿越熱泉', difficulty: 'medium',
      designIntent: '完全獨立的熱泉路線：左右熱泉室交替，先探索支路啟動閘門，再穿越 L3 脈衝與可選傳送捷徑。',
      routeBeats: ['暖流入口', '左右熱泉分流', '開門支路', '壓力閘門', '傳送捷徑', '熱泉出口'],
      teachingSequence: [
        '層間轉接門：第一次從 T1 進入 T2，入口沒有其他危險。',
        '珊瑚＋地雷：先在保護範圍理解反彈，再遇到無保護地雷。',
        '墨水＋潮流：視野縮小後，用既有的潮流判讀維持方向。',
        '重石＋彈簧水母：借助反彈速度擊碎擋路重石。',
        '支路按鈕＋封印閘門：離開主路取得開門權，再回到中軸。',
        '氣泡＋L3 脈衝＋剃刀：最後把重力免疫、路線控制與傷害迴避合併考核。',
        '多邊傳送捷徑：高手可冒險跳過閘門後半，失敗則走穩定主路。',
      ],
      endGoal: '開啟壓力閘門，或承擔風險使用傳送捷徑，抵達遺跡入口。',
    },
  });
  paintPart2Terrain(map);
  const gateKeys = addConditionalGateWall(map, 44, [9, 10]);
  addActor(map, 'playerStart', 3, 8);
  [[18, 13], [38, 5], [59, 14], [78, 6]].forEach(([row, column]) => addActor(map, 'enemySpawn', row, column));
  addActor(map, 'miniBossSpawn', 82, 11, { enemyId: 'prismCrabGuardian' });
  const used = new Set();
  [
    ['oxygen', 6, 7], ['bubble', 11, 12], ['torricelli', 17, 4],
    ['checkpoint', 22, 11], ['mine', 27, 15], ['button', 31, 4],
    ['mine', 35, 14], ['oxygen', 40, 7], ['weightStone', 42, 13],
    ['checkpoint', 48, 5], ['ink', 52, 14], ['bubble', 58, 7],
    ['razor', 63, 13], ['oxygen', 68, 5], ['weightStone', 71, 14],
    ['ink', 74, 4], ['razor', 78, 14], ['checkpoint', 82, 8],
    ['torricelli', 85, 12],
  ].forEach(([kind, row, column]) => addFreeObject(map, kind, row, column, used, kind === 'button' ? { targetGates: gateKeys } : {}));
  addEdgeSet(map, 'current', [8, 28, 52, 73]);
  addEdgeSet(map, 'springJelly', [14, 37, 60, 80]);
  addEdgeSet(map, 'spike', [33, 67]);
  addEdgeSet(map, 'barrier', [41, 76]);
  addEdgeSet(map, 'seaweed', [20, 56]);
  addEdgeSet(map, 'coralCluster', [27, 63, 83]);
  addLayerPortal(map, 21);
  addLinkedPortal(map, 16, 70, 'part2-thermal-shortcut', new Set());
  setRuntimeExit(map, 85, 12);
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
  addActor(map, 'playerStart', 3, 12);
  [[20, 5], [35, 18], [52, 7], [70, 19], [88, 5], [104, 18]].forEach(([row, column]) => addActor(map, 'enemySpawn', row, column));
  addActor(map, 'miniBossSpawn', 92, 12, { enemyId: 'tideLawNautilus' });
  addActor(map, 'bossSpawn', 114, 12, { enemyId: 'abyssalSpermWhale' });
  const used = new Set(Object.entries(map.cells).filter(([, cell]) => cell.freeObjects.length).map(([key]) => key));
  [
    ['oxygen', 15, 3], ['bubble', 24, 18], ['mine', 33, 8],
    ['checkpoint', 43, 21], ['weightStone', 55, 4], ['ink', 61, 17],
    ['oxygen', 69, 7], ['bubble', 76, 20], ['mine', 88, 4],
    ['checkpoint', 97, 18], ['weightStone', 103, 9], ['ink', 109, 21],
    ['oxygen', 113, 3], ['bubble', 116, 14], ['razor', 100, 20],
  ].forEach(([kind, row, column]) => addFreeObject(map, kind, row, column, used));
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
  setRuntimeExit(map, 116, 12);
  return map;
}

const outputs = [
  ['下沉篇-第1部分.json', buildPart1()],
  ['下沉篇-第2部分.json', buildPart2()],
  ['下沉篇-第3部分.json', buildPart3(JSON.parse(readFileSync(sourcePath, 'utf8')))],
];
outputs.forEach(([name, map]) => writeFileSync(join(outputDir, name), `${JSON.stringify(map, null, 2)}\n`, 'utf8'));
console.log(`generated ${outputs.length} descent maps; part 3 preserves the player's original template`);
