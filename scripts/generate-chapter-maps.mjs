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

function addActor(map, kind, row, columnHint) {
  const cell = chooseWaterCell(map, row, columnHint);
  if (!cell) throw new Error(`無法在 row ${row} 放置 ${kind}`);
  cell.actors.push({ kind });
  return cellKey(cell);
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

function paintPart1Terrain(map) {
  Object.values(map.cells).forEach((cell) => {
    const column = columnOf(cell);
    const center = 8 + Math.round(1.7 * Math.sin(cell.r / 9));
    const halfWidth = cell.r < 16 ? 6 : 5;
    cell.region = cell.r < 16 ? 'entry-shelf'
      : cell.r < 34 ? 'kelp-corridor'
        : cell.r < 54 ? 'buoyancy-grove' : 'forest-threshold';
    cell.gravityLevel = cell.r < 14 ? 'L0'
      : (cell.r >= 35 && cell.r <= 43 && column < center ? 'L-1' : 'L1');
    cell.waterLayer = 'T1';
    const firstTorricelliSpur = (
      (cell.r >= 23 && cell.r <= 33 && column >= 14 && column <= 16)
      || (cell.r >= 31 && cell.r <= 34 && column >= 11 && column <= 16)
    );
    const secondTorricelliSpur = (
      (cell.r >= 55 && cell.r <= 66 && column >= 1 && column <= 3)
      || (cell.r >= 64 && cell.r <= 67 && column >= 2 && column <= 7)
    );
    const outsideRoute = column <= 0 || column >= map.layout.width - 1
      || (Math.abs(column - center) > halfWidth && !firstTorricelliSpur && !secondTorricelliSpur);
    const centralFork = cell.r >= 19 && cell.r <= 24 && column >= 7 && column <= 9;
    const leftRestWall = cell.r >= 37 && cell.r <= 41 && column >= 3 && column <= 5;
    const rightCanopy = cell.r >= 50 && cell.r <= 55 && column >= 11 && column <= 13;
    const finalNeedle = cell.r >= 62 && cell.r <= 65 && column === 8;
    const firstSpurDivider = cell.r >= 21 && cell.r <= 30 && column >= 12 && column <= 13;
    const firstSpurCap = cell.r >= 21 && cell.r <= 22 && column >= 14 && column <= 16;
    const secondSpurDivider = cell.r >= 53 && cell.r <= 63 && column >= 4 && column <= 5;
    const secondSpurCap = cell.r >= 53 && cell.r <= 54 && column >= 1 && column <= 3;
    if (outsideRoute || centralFork || leftRestWall || rightCanopy || finalNeedle
      || firstSpurDivider || firstSpurCap || secondSpurDivider || secondSpurCap) {
      makeRock(cell, (firstSpurDivider || firstSpurCap || secondSpurDivider || secondSpurCap)
        ? 'torricelli-spur-wall'
        : outsideRoute ? 'forest-wall' : 'forest-island');
      return;
    }
    if (firstTorricelliSpur) {
      cell.region = 'torricelli-ascent-right';
      cell.gravityLevel = cell.r <= 27 ? 'L-1' : 'L1';
    }
    if (secondTorricelliSpur) {
      cell.region = 'torricelli-ascent-left';
      cell.gravityLevel = cell.r <= 59 ? 'L-1' : 'L1';
    }
  });
}

function buildPart1() {
  const map = createAuthoredMap({
    width: 18,
    height: 72,
    metadata: {
      chapter: '下沉篇', part: 1, title: '下沉篇・第一部分｜深海森林入口', difficulty: 'light',
      designIntent: '寬闊的蛇行教學路線，以森林島礁自然分流；先讀懂彈射、氧氣、上浮水域與檢查點，再進入熱泉。',
      routeBeats: ['安全入口', '雙側繞行礁', '上浮林間', '補給林床', '熱泉門檻'],
      mainAxisColumn: 8,
      torricelliDetours: [
        { side: 'right', objectRow: 24, objectColumn: 15, junctionRow: 31, junctionColumn: 12, ascentRows: 7 },
        { side: 'left', objectRow: 56, objectColumn: 2, junctionRow: 64, junctionColumn: 6, ascentRows: 8 },
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
  addActor(map, 'playerStart', 3, 8);
  [[22, 4], [39, 11], [57, 5]].forEach(([row, column]) => addActor(map, 'enemySpawn', row, column));
  const used = new Set();
  [
    ['oxygen', 7, 7], ['bubble', 13, 11], ['checkpoint', 18, 4],
    ['torricelli', 24, 15], ['oxygen', 34, 7], ['bubble', 40, 12],
    ['checkpoint', 47, 5], ['oxygen', 55, 9], ['torricelli', 56, 2],
    ['checkpoint', 68, 10],
  ].forEach(([kind, row, column]) => addFreeObject(map, kind, row, column, used));
  addEdgeSet(map, 'springJelly', [17, 44]);
  addEdgeNear(map, 'current', 30, 15, { currentDirection: 5, currentStrength: 1.08 });
  addEdgeNear(map, 'current', 63, 2, { currentDirection: 4, currentStrength: 1.18 });
  addEdgeNear(map, 'spike', 61, 2);
  addEdgeSet(map, 'seaweed', [24, 52]);
  addEdgeSet(map, 'coralCluster', [10, 65]);
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
      endGoal: '開啟壓力閘門後抵達遺跡入口。',
    },
  });
  paintPart2Terrain(map);
  const gateKeys = addConditionalGateWall(map, 44, [9, 10]);
  addActor(map, 'playerStart', 3, 8);
  [[18, 13], [38, 5], [59, 14], [78, 6]].forEach(([row, column]) => addActor(map, 'enemySpawn', row, column));
  addActor(map, 'miniBossSpawn', 82, 11);
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
    endGoal: '完成玩家原始遺跡路線並抵達深淵 Boss。',
  });
  removeInvalidButtons(map);
  addActor(map, 'playerStart', 3, 12);
  [[20, 5], [35, 18], [52, 7], [70, 19], [88, 5], [104, 18]].forEach(([row, column]) => addActor(map, 'enemySpawn', row, column));
  addActor(map, 'miniBossSpawn', 92, 12);
  addActor(map, 'bossSpawn', 114, 12);
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
  return map;
}

const outputs = [
  ['下沉篇-第1部分.json', buildPart1()],
  ['下沉篇-第2部分.json', buildPart2()],
  ['下沉篇-第3部分.json', buildPart3(JSON.parse(readFileSync(sourcePath, 'utf8')))],
];
outputs.forEach(([name, map]) => writeFileSync(join(outputDir, name), `${JSON.stringify(map, null, 2)}\n`, 'utf8'));
console.log(`generated ${outputs.length} descent maps; part 3 preserves the player's original template`);
