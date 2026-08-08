import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
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
const sourceName = readdirSync(root).find((name) => name.endsWith('map.json'));
if (!sourceName) throw new Error('找不到範本 map.json');
const sourcePath = join(root, sourceName);
const outputDir = join(root, 'maps', '下沉篇');
mkdirSync(outputDir, { recursive: true });

const clone = (value) => JSON.parse(JSON.stringify(value));
const hash = (q, r) => Math.abs((q * 92821 + r * 68917 + 17) % 1000);
const cellKey = (cell) => `${cell.q},${cell.r}`;
const rowOf = (cell) => Number(cell.r);

function prepareMap(source, metadata) {
  const map = clone(source);
  map.version = Math.max(2, Number(map.version) || 1);
  map.metadata = { ...metadata, source: sourceName, spawnPoints: '未放置' };
  map.chapterStates = {
    chapter1: { cells: {}, edges: {} },
    chapter2: { cells: {}, edges: {} },
  };
  Object.values(map.cells).forEach((cell) => {
    cell.overlays = Array.isArray(cell.overlays) ? cell.overlays : [];
    cell.objects = Array.isArray(cell.objects) ? cell.objects : [];
    cell.freeObjects = Array.isArray(cell.freeObjects) ? cell.freeObjects : [];
    cell.actors = [];
  });
  return map;
}

function clearCellContent(map) {
  Object.values(map.cells).forEach((cell) => {
    cell.overlays = [];
    cell.objects = [];
    cell.freeObjects = [];
    cell.actors = [];
    cell.conditionalGate = null;
  });
}

function simplifyTerrain(map, blockedToWaterThreshold, gravityMode) {
  Object.values(map.cells).forEach((cell) => {
    if (cell.terrain === 'blocked' && hash(cell.q, cell.r) % 100 < blockedToWaterThreshold) {
      cell.terrain = 'water';
      cell.conditionalGate = null;
    }
    if (gravityMode === 'light') {
      if (cell.gravityLevel === 'L2' || cell.gravityLevel === 'L3') cell.gravityLevel = 'L1';
      if (cell.gravityLevel === 'L1' && hash(cell.q + 3, cell.r - 4) % 5 === 0) cell.gravityLevel = 'L0';
      if (cell.waterLayer === 'T2') cell.waterLayer = 'T1';
    } else if (gravityMode === 'moderate') {
      if (cell.gravityLevel === 'L3' && hash(cell.q - 8, cell.r + 9) % 5 !== 0) cell.gravityLevel = 'L2';
      if (cell.gravityLevel === 'L2' && hash(cell.q + 11, cell.r) % 7 === 0) cell.gravityLevel = 'L1';
      if (cell.waterLayer === 'T2' && hash(cell.q, cell.r) % 4 !== 0) cell.waterLayer = 'T1';
    }
    if (cell.terrain === 'blocked') {
      cell.conditionalGate = null;
      cell.freeObjects = [];
      cell.objects = [];
      cell.overlays = [];
    }
  });
}

function chooseWaterCell(map, row, columnHint, used) {
  const width = Number(map.layout.width) || 24;
  const height = Number(map.layout.height) || 1;
  const safeRow = Math.max(0, Math.min(height - 1, row));
  for (let distance = 0; distance < width; distance += 1) {
    const candidates = [columnHint + distance, columnHint - distance];
    for (const rawColumn of candidates) {
      const column = ((rawColumn % width) + width) % width;
      const key = cellKeyFromColumn(column, safeRow);
      const cell = map.cells[key];
      if (!cell || cell.terrain !== 'water' || cell.conditionalGate || used.has(key)) continue;
      return cell;
    }
  }
  return null;
}

function addFreeObject(map, kind, row, columnHint, used, extra = {}) {
  const cell = chooseWaterCell(map, row, columnHint, used);
  if (!cell) return false;
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
  return true;
}

function addConditionalGatePair(map, row, firstColumn, secondColumn) {
  const keys = [firstColumn, secondColumn].map((column) => cellKeyFromColumn(column, row));
  keys.forEach((key) => {
    const cell = map.cells[key];
    if (!cell) return;
    cell.terrain = 'blocked';
    cell.gravityLevel = 'L1';
    cell.waterLayer = 'T1';
    cell.conditionalGate = { opened: false };
    cell.freeObjects = [];
  });
  return keys;
}

function freeObjectKeys(map) {
  return new Set(Object.entries(map.cells).filter(([, cell]) => cell.freeObjects.length).map(([key]) => key));
}

function boundaryEdges(map, rowHint, usedEdges = new Set()) {
  return allMapEdges(map)
    .filter(({ key, a, b }) => {
      if (usedEdges.has(key)) return false;
      const edge = map.edges[key];
      if (edge && edge.type && edge.type !== 'none') return false;
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
  const blocking = ['springJelly', 'spike', 'barrier'].includes(type);
  map.edges[entry.key] = {
    cells: [entry.a, entry.b],
    type,
    blocksPassage: blocking,
    currentDirection: extra.currentDirection ?? 0,
    currentStrength: type === 'current' ? (extra.currentStrength ?? 1) : 0,
    ...official,
    ...extra,
  };
  return entry.key;
}

function addEdgeSet(map, type, rows, count) {
  const used = new Set(Object.entries(map.edges).filter(([, edge]) => edge.type !== 'none').map(([key]) => key));
  let added = 0;
  rows.forEach((row) => {
    for (const entry of boundaryEdges(map, row, used)) {
      addEdge(map, entry, type, type === 'current' ? { currentDirection: added % 6, currentStrength: 0.72 + (added % 3) * 0.18 } : {});
      used.add(entry.key);
      added += 1;
      break;
    }
  });
  while (added < count) {
    const entry = boundaryEdges(map, Math.round((added / Math.max(count, 1)) * map.layout.height), used)[0];
    if (!entry) break;
    addEdge(map, entry, type, type === 'current' ? { currentDirection: added % 6, currentStrength: 0.9 } : {});
    used.add(entry.key);
    added += 1;
  }
}

function blockedCellWithWaterEdges(map, rowHint, usedCenters = new Set()) {
  return Object.values(map.cells)
    .filter((cell) => cell.terrain === 'blocked' && !usedCenters.has(cellKey(cell)))
    .map((cell) => {
      const edges = DIRECTIONS.map((_, direction) => {
        const neighbour = neighborKey(cellKey(cell), direction);
        if (map.cells[neighbour]?.terrain !== 'water') return null;
        const key = edgeKey(cellKey(cell), neighbour);
        const existing = map.edges[key];
        if (existing?.type && existing.type !== 'none') return null;
        return { key, a: cellKey(cell), b: neighbour };
      }).filter(Boolean);
      return { cell, edges, distance: Math.abs(cell.r - rowHint) };
    })
    .filter((candidate) => candidate.edges.length >= 3)
    .sort((left, right) => left.distance - right.distance || cellKey(left.cell).localeCompare(cellKey(right.cell)))[0] ?? null;
}

function addLinkedPortal(map, firstRow, secondRow, prefix, usedCenters) {
  const firstCenter = blockedCellWithWaterEdges(map, firstRow, usedCenters);
  if (!firstCenter) return false;
  usedCenters.add(cellKey(firstCenter.cell));
  const secondCenter = blockedCellWithWaterEdges(map, secondRow, usedCenters);
  if (!secondCenter) return false;
  usedCenters.add(cellKey(secondCenter.cell));
  const count = Math.min(3, firstCenter.edges.length, secondCenter.edges.length);
  const firstGroup = `${prefix}-a`;
  const secondGroup = `${prefix}-b`;
  for (let index = 0; index < count; index += 1) {
    const firstKey = addEdge(map, firstCenter.edges[index], 'multiPortal', { portalGroupId: firstGroup, portalSlot: index, portalTargetKey: secondCenter.edges[index].key });
    const secondKey = addEdge(map, secondCenter.edges[index], 'multiPortal', { portalGroupId: secondGroup, portalSlot: index, portalTargetKey: firstKey });
    map.edges[firstKey].portalTargetKey = secondKey;
  }
  return true;
}

function removeInvalidButtons(map) {
  Object.values(map.cells).forEach((cell) => {
    cell.freeObjects = cell.freeObjects.filter((object) => (
      object.kind !== 'button' || (object.targetGates ?? []).some((key) => map.cells[key]?.conditionalGate)
    ));
  });
}

function buildPart1(source) {
  const map = prepareMap(source, {
    chapter: '下沉篇',
    part: 1,
    title: '下沉篇・第一部分｜進入深海',
    difficulty: 'light',
    designIntent: '以 L0、L-1、L1 為主，保留寬闊水域與少量邊緣互動，先教玩家讀懂彈射與氧氣。',
  });
  clearCellContent(map);
  simplifyTerrain(map, 58, 'light');
  map.edges = {};
  const used = new Set();
  [
    ['oxygen', 9, 3], ['bubble', 19, 17], ['checkpoint', 32, 7],
    ['torricelli', 47, 20], ['oxygen', 62, 5], ['checkpoint', 77, 18],
    ['torricelli', 94, 4], ['bubble', 106, 15], ['oxygen', 114, 9],
  ].forEach(([kind, row, column]) => addFreeObject(map, kind, row, column, used));
  addEdgeSet(map, 'springJelly', [18, 46], 2);
  addEdgeSet(map, 'current', [30, 70], 2);
  addEdgeSet(map, 'seaweed', [57, 91], 2);
  addEdgeSet(map, 'coralCluster', [80, 104], 2);
  return map;
}

function buildPart2(source) {
  // Part 2 is authored as its own hot-spring route. It intentionally does not
  // clone or simplify the Part 3 template: the chamber rhythm, terrain mask,
  // gravity bands, and interaction placement are all generated independently.
  const width = 20;
  const height = 96;
  const map = createEmptyMap({ width, height });
  map.version = 2;
  map.chapterStates = {
    chapter1: { cells: {}, edges: {} },
    chapter2: { cells: {}, edges: {} },
  };
  map.metadata = {
    chapter: '下沉篇',
    part: 2,
    title: '下沉篇・第二部分｜穿越熱泉',
    difficulty: 'medium',
    designIntent: '獨立設計的熱泉脈衝路線：以分段熱泉室、交錯重力帶與回流通道改變節奏，不沿用第三部分遺跡範本。',
    source: '獨立生成（scripts/generate-chapter-maps.mjs）',
    spawnPoints: '未放置',
  };

  const vents = [
    { row: 12, column: 6 },
    { row: 31, column: 14 },
    { row: 51, column: 7 },
    { row: 71, column: 13 },
  ];
  const chamberStarts = [0, 24, 45, 68];
  Object.values(map.cells).forEach((cell) => {
    const column = cell.q + Math.floor(cell.r / 2);
    const chamber = chamberStarts.reduce((closest, start, index) => (
      Math.abs(cell.r - start) < Math.abs(cell.r - chamberStarts[closest]) ? index : closest
    ), 0);
    cell.gravityLevel = chamber % 2 === 0 ? 'L1' : 'L2';
    cell.waterLayer = chamber === 1 || chamber === 3 ? 'T2' : 'T1';
    cell.region = `hot-spring-chamber-${chamber + 1}`;

    // A solid outer crust frames the route, while the interior stays open for
    // a readable thermal-channel silhouette rather than copied ruins.
    if (column <= 0 || column >= width - 1) {
      cell.terrain = 'blocked';
      cell.gravityLevel = 'L0';
      cell.waterLayer = 'T1';
      cell.region = 'outer-crust';
      return;
    }

    const vent = vents.reduce((closest, candidate) => (
      Math.abs(cell.r - candidate.row) < Math.abs(cell.r - vents[closest].row) ? vents.indexOf(candidate) : closest
    ), 0);
    const activeVent = vents[vent];
    const rowDistance = Math.abs(cell.r - activeVent.row);
    const columnDistance = Math.abs(column - activeVent.column);
    if ((rowDistance <= 2 && columnDistance <= 2 && rowDistance + columnDistance <= 3)
      || (rowDistance === 3 && columnDistance <= 1)) {
      cell.terrain = 'blocked';
      cell.gravityLevel = 'L0';
      cell.waterLayer = 'T1';
      cell.region = 'thermal-vent-rock';
    }

    const bankPhase = Math.floor(cell.r / 12);
    const bankSide = bankPhase % 2 === 0 ? column <= 5 : column >= width - 6;
    if (bankSide && cell.r % 12 >= 6 && cell.r % 12 <= 10) {
      cell.terrain = 'blocked';
      cell.gravityLevel = 'L0';
      cell.waterLayer = 'T1';
      cell.region = 'thermal-bank';
    }

    // Each chamber bends its safe lane to the opposite side. The changing
    // lane is the main Part 2 identity, not a lower-resolution Part 3 map.
    const laneCenter = chamber % 2 === 0 ? 5 + (chamber * 2) : 14 - (chamber * 2);
    if (cell.terrain === 'water' && cell.r % 16 >= 12 && Math.abs(column - laneCenter) >= 6) {
      cell.gravityLevel = 'L2';
      cell.waterLayer = 'T2';
    }
    if (cell.terrain === 'water' && cell.r % 16 <= 2 && Math.abs(column - laneCenter) <= 2) {
      cell.gravityLevel = 'L3';
      cell.waterLayer = 'T2';
    }
  });

  map.edges = {};
  const gates = addConditionalGatePair(map, 47, 9, 10);
  const used = new Set();
  [
    ['oxygen', 5, 4], ['bubble', 10, 14], ['button', 18, 7],
    ['torricelli', 25, 15], ['checkpoint', 32, 4], ['mine', 39, 12],
    ['weightStone', 46, 5], ['ink', 54, 15], ['oxygen', 61, 7],
    ['razor', 68, 13], ['bubble', 76, 4], ['checkpoint', 84, 15],
    ['torricelli', 92, 8],
  ].forEach(([kind, row, column]) => addFreeObject(map, kind, row, column, used, kind === 'button' ? { targetGates: gates } : {}));
  addEdgeSet(map, 'current', [9, 28, 50, 73, 90], 5);
  addEdgeSet(map, 'springJelly', [16, 36, 59, 82], 4);
  addEdgeSet(map, 'spike', [23, 63], 2);
  addEdgeSet(map, 'barrier', [43, 78], 2);
  addEdgeSet(map, 'seaweed', [30, 69], 2);
  addEdgeSet(map, 'coralCluster', [14, 56, 87], 3);
  addLinkedPortal(map, 27, 70, 'descent-part2-thermal-loop', new Set());
  return map;
}

function buildPart3(source) {
  const map = prepareMap(source, {
    chapter: '下沉篇',
    part: 3,
    title: '下沉篇・第三部分｜深淵遺跡（複雜範本）',
    difficulty: 'hard',
    designIntent: '保留設計者提供的複雜水域、障礙、T2、層間門與多邊傳送門，再補齊尚未大量使用的環境物件。',
  });
  removeInvalidButtons(map);
  const used = freeObjectKeys(map);
  [
    ['oxygen', 15, 3], ['bubble', 24, 18], ['mine', 33, 8],
    ['checkpoint', 43, 21], ['weightStone', 55, 4], ['ink', 61, 17],
    ['oxygen', 69, 7], ['bubble', 76, 20], ['mine', 88, 4],
    ['checkpoint', 97, 18], ['weightStone', 103, 9], ['ink', 109, 21],
    ['oxygen', 113, 3], ['bubble', 116, 14], ['razor', 100, 20],
  ].forEach(([kind, row, column]) => addFreeObject(map, kind, row, column, used));
  addEdgeSet(map, 'springJelly', [18, 46, 78, 108], 4);
  addEdgeSet(map, 'spike', [23, 57, 91, 104], 4);
  addEdgeSet(map, 'barrier', [37, 73, 99], 3);
  addEdgeSet(map, 'current', [12, 52, 82, 112], 4);
  addEdgeSet(map, 'seaweed', [27, 68, 96], 3);
  addEdgeSet(map, 'coralCluster', [42, 76, 106], 3);
  return map;
}

const source = JSON.parse(readFileSync(sourcePath, 'utf8'));
const outputs = [
  ['下沉篇-第1部分.json', buildPart1(source)],
  ['下沉篇-第2部分.json', buildPart2(source)],
  ['下沉篇-第3部分.json', buildPart3(source)],
];
outputs.forEach(([name, map]) => writeFileSync(join(outputDir, name), `${JSON.stringify(map, null, 2)}\n`, 'utf8'));
console.log(`generated ${outputs.length} maps from ${sourceName}`);
