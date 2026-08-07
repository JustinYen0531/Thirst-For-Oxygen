// A Cell is intentionally tiny: its point-to-point size is 24 px while the
// playtest player is 72 px across. This gives authors the requested 1:3
// tile-to-player editing precision.
export const HEX_SIZE = 12;

export const DIRECTIONS = Object.freeze([
  { name: 'E', q: 1, r: 0 },
  { name: 'NE', q: 1, r: -1 },
  { name: 'NW', q: 0, r: -1 },
  { name: 'W', q: -1, r: 0 },
  { name: 'SW', q: -1, r: 1 },
  { name: 'SE', q: 0, r: 1 },
]);

export const GRAVITY_LEVELS = Object.freeze({
  'L-1': -1,
  L0: 0,
  L1: 1,
  L2: 1.5,
  L3: 2,
});

export const GRAVITY_ORDER = Object.freeze(['L-1', 'L0', 'L1', 'L2', 'L3']);
export const TERRAIN_TYPES = Object.freeze(['water', 'blocked']);
export const OVERLAY_TYPES = Object.freeze(['coral', 'ink']);
export const CELL_OBJECT_TYPES = Object.freeze([
  'mine',
  'weightStone',
  'seaweed',
  'oxygen',
  'checkpoint',
  'bubble',
  'torricelli',
]);
export const EDGE_TYPES = Object.freeze(['none', 'springJelly', 'spike', 'barrier', 'current']);
export const ACTOR_TYPES = Object.freeze(['playerStart', 'enemySpawn', 'miniBossSpawn', 'bossSpawn']);

export function cellKey(q, r) {
  return `${q},${r}`;
}

export function parseCellKey(key) {
  const [q, r] = key.split(',').map(Number);
  return { q, r };
}

export function neighborKey(key, directionIndex) {
  const { q, r } = parseCellKey(key);
  const direction = DIRECTIONS[directionIndex];
  return cellKey(q + direction.q, r + direction.r);
}

export function areNeighbors(a, b) {
  return DIRECTIONS.some((direction) => neighborKey(a, DIRECTIONS.indexOf(direction)) === b);
}

export function edgeKey(a, b) {
  return [a, b].sort().join('|');
}

export function parseEdgeKey(key) {
  const [a, b] = key.split('|');
  return { a, b };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function makeCell(q, r) {
  return {
    q,
    r,
    terrain: 'water',
    gravityLevel: 'L1',
    overlays: [],
    objects: [],
    actors: [],
    region: 'default',
  };
}

export function createEmptyMap({ width = 36, height = 25 } = {}) {
  const cells = {};
  for (let r = 0; r < height; r += 1) {
    for (let q = 0; q < width; q += 1) {
      const key = cellKey(q, r);
      cells[key] = makeCell(q, r);
    }
  }

  return {
    version: 1,
    layout: { orientation: 'pointy', coordinateSystem: 'axial', width, height },
    cells,
    edges: {},
    chapterStates: {
      chapter1: { cells: {}, edges: {} },
      chapter2: { cells: {}, edges: {} },
    },
  };
}

export function getActiveCell(map, key, chapter = 'chapter1') {
  const base = map.cells[key];
  if (!base) return null;
  if (chapter === 'chapter1') return base;
  const override = map.chapterStates?.[chapter]?.cells?.[key];
  return override ? { ...base, ...clone(override) } : base;
}

export function getEditableCell(map, key, chapter = 'chapter1') {
  if (!map.cells[key]) return null;
  if (chapter === 'chapter1') return map.cells[key];
  const state = map.chapterStates[chapter];
  if (!state.cells[key]) state.cells[key] = clone(map.cells[key]);
  return state.cells[key];
}

export function patchCell(map, key, patch, chapter = 'chapter1') {
  const target = getEditableCell(map, key, chapter);
  if (!target) return false;
  Object.assign(target, clone(patch));
  return true;
}

export function getOrCreateEdge(map, a, b) {
  const key = edgeKey(a, b);
  if (!map.edges[key]) {
    map.edges[key] = {
      cells: [a, b],
      type: 'none',
      blocksPassage: false,
      currentDirection: 0,
      currentStrength: 0,
    };
  }
  return map.edges[key];
}

export function getActiveEdge(map, key, chapter = 'chapter1') {
  const base = map.edges[key];
  if (!base) return null;
  if (chapter === 'chapter1') return base;
  const override = map.chapterStates?.[chapter]?.edges?.[key];
  return override ? { ...base, ...clone(override) } : base;
}

export function getEditableEdge(map, a, b, chapter = 'chapter1') {
  const key = edgeKey(a, b);
  const base = getOrCreateEdge(map, a, b);
  if (chapter === 'chapter1') return base;
  const state = map.chapterStates[chapter];
  if (!state.edges[key]) state.edges[key] = clone(base);
  return state.edges[key];
}

export function patchEdge(map, a, b, patch, chapter = 'chapter1') {
  const target = getEditableEdge(map, a, b, chapter);
  Object.assign(target, clone(patch));
  return target;
}

export function getHexCenter(cell, origin = { x: 78, y: 86 }) {
  return {
    x: origin.x + HEX_SIZE * Math.sqrt(3) * (cell.q + cell.r / 2),
    y: origin.y + HEX_SIZE * 1.5 * cell.r,
  };
}

export function getHexVertices(cell, origin) {
  const center = getHexCenter(cell, origin);
  return Array.from({ length: 6 }, (_, index) => {
    const angle = ((60 * index - 30) * Math.PI) / 180;
    return { x: center.x + HEX_SIZE * Math.cos(angle), y: center.y + HEX_SIZE * Math.sin(angle) };
  });
}

export function getDirectionVector(directionIndex) {
  const origin = { q: 0, r: 0 };
  const target = DIRECTIONS[directionIndex];
  const from = getHexCenter(origin, { x: 0, y: 0 });
  const to = getHexCenter(target, { x: 0, y: 0 });
  const x = to.x - from.x;
  const y = to.y - from.y;
  const length = Math.hypot(x, y) || 1;
  return { x: x / length, y: y / length };
}

export function allMapEdges(map) {
  const result = new Map();
  Object.keys(map.cells).forEach((key) => {
    DIRECTIONS.forEach((_, directionIndex) => {
      const other = neighborKey(key, directionIndex);
      if (!map.cells[other]) return;
      const keyForEdge = edgeKey(key, other);
      if (!result.has(keyForEdge)) result.set(keyForEdge, { key: keyForEdge, a: key, b: other });
    });
  });
  return [...result.values()];
}

export function getEdgeBetween(map, a, b, chapter = 'chapter1') {
  const key = edgeKey(a, b);
  return getActiveEdge(map, key, chapter) ?? {
    cells: [a, b],
    type: 'none',
    blocksPassage: false,
    currentDirection: 0,
    currentStrength: 0,
  };
}

export function findCellContainingPoint(map, point, chapter = 'chapter1', origin) {
  for (const key of Object.keys(map.cells)) {
    const cell = getActiveCell(map, key, chapter);
    if (!cell) continue;
    const center = getHexCenter(cell, origin);
    const dx = Math.abs(point.x - center.x) / (Math.sqrt(3) * HEX_SIZE / 2);
    const dy = Math.abs(point.y - center.y) / HEX_SIZE;
    if (dy <= 1 && Math.sqrt(3) * dx + dy <= 2) return { key, cell };
  }
  return null;
}

export function validateMap(map) {
  const results = [];
  const seenCoordinates = new Set();
  let playerStarts = 0;

  Object.entries(map.cells).forEach(([key, cell]) => {
    const coordinate = `${cell.q},${cell.r}`;
    if (seenCoordinates.has(coordinate)) results.push({ level: 'error', message: `重複 Cell 座標：${coordinate}` });
    seenCoordinates.add(coordinate);
    if (key !== coordinate) results.push({ level: 'error', message: `Cell key 與座標不一致：${key}` });
    if (!TERRAIN_TYPES.includes(cell.terrain)) results.push({ level: 'error', message: `${key} 的地形無效：${cell.terrain}` });
    if (!Object.hasOwn(GRAVITY_LEVELS, cell.gravityLevel)) results.push({ level: 'error', message: `${key} 的 gravityLevel 無效：${cell.gravityLevel}` });
    if (cell.terrain === 'blocked' && cell.actors.some((actor) => actor.kind === 'playerStart')) {
      results.push({ level: 'error', message: `${key} 不可通行，不能放置玩家起點。` });
    }
    cell.actors.forEach((actor) => {
      if (!ACTOR_TYPES.includes(actor.kind)) results.push({ level: 'error', message: `${key} 有未知 Actor：${actor.kind}` });
      if (actor.kind === 'playerStart') playerStarts += 1;
    });
    cell.objects.forEach((object) => {
      if (!CELL_OBJECT_TYPES.includes(object.kind)) results.push({ level: 'error', message: `${key} 有未知物件：${object.kind}` });
    });
  });

  Object.entries(map.edges).forEach(([key, edge]) => {
    const { a, b } = parseEdgeKey(key);
    if (!map.cells[a] || !map.cells[b]) results.push({ level: 'error', message: `孤立 Edge：${key}` });
    else if (!areNeighbors(a, b)) results.push({ level: 'error', message: `Edge 並非相鄰 Cell：${key}` });
    if (!EDGE_TYPES.includes(edge.type)) results.push({ level: 'error', message: `${key} 的 Edge 類型無效：${edge.type}` });
  });

  if (playerStarts === 0) results.push({ level: 'warning', message: '尚未放置玩家起點；物理測試會使用預設位置。' });
  if (playerStarts > 1) results.push({ level: 'warning', message: `玩家起點有 ${playerStarts} 個；物理測試會使用第一個。` });
  if (results.length === 0) results.push({ level: 'ok', message: '地圖結構有效。' });
  return results;
}

export function createDemoMap() {
  const map = createEmptyMap();
  const levels = ['L-1', 'L0', 'L1', 'L2', 'L3'];
  const { width, height } = map.layout;
  Object.values(map.cells).forEach((cell) => {
    const levelIndex = Math.min(levels.length - 1, Math.floor((cell.r / Math.max(height - 1, 1)) * levels.length));
    cell.gravityLevel = levels[levelIndex];
  });

  const addOverlay = (key, kind) => map.cells[key].overlays.push(kind);
  const addObject = (key, kind) => map.cells[key].objects.push({ kind });
  const addActor = (key, kind) => map.cells[key].actors.push({ kind });
  addActor(cellKey(4, 5), 'playerStart');
  addActor(cellKey(22, 8), 'enemySpawn');
  addActor(cellKey(27, 15), 'miniBossSpawn');
  addActor(cellKey(width - 3, height - 3), 'bossSpawn');
  addOverlay(cellKey(8, 3), 'coral');
  addOverlay(cellKey(25, 5), 'ink');
  addObject(cellKey(15, 8), 'mine');
  addObject(cellKey(18, 8), 'weightStone');
  addObject(cellKey(7, 11), 'seaweed');
  addObject(cellKey(12, 15), 'oxygen');
  addObject(cellKey(19, 18), 'checkpoint');
  addObject(cellKey(28, 4), 'bubble');
  addObject(cellKey(4, 17), 'torricelli');
  patchEdge(map, cellKey(14, 8), cellKey(15, 8), { type: 'springJelly', blocksPassage: true });
  patchEdge(map, cellKey(14, 15), cellKey(15, 15), { type: 'spike', blocksPassage: true });
  patchEdge(map, cellKey(23, 15), cellKey(24, 15), { type: 'barrier', blocksPassage: true });
  patchEdge(map, cellKey(9, 10), cellKey(10, 10), { type: 'current', currentDirection: 0, currentStrength: 1.5 });
  return map;
}
