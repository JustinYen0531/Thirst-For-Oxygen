// A Cell is 24 px point-to-point. The current compact test player matches one
// Cell across, so individual Cell placement remains easy to inspect.
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
export const OVERLAY_TYPES = Object.freeze(['ink']);
export const CELL_OBJECT_TYPES = Object.freeze([
  'coralCluster',
  'mine',
  'weightStone',
  'seaweed',
  'oxygen',
  'checkpoint',
  'bubble',
  'torricelli',
]);
// seaweed/coralCluster remain accepted in CELL_OBJECT_TYPES for existing saved
// maps, but new authoring always places them as Edge attachments.
export const EDGE_TYPES = Object.freeze(['none', 'springJelly', 'spike', 'barrier', 'current', 'seaweed', 'coralCluster']);
export const ACTOR_TYPES = Object.freeze(['playerStart', 'enemySpawn', 'miniBossSpawn', 'bossSpawn']);

export function cellKey(q, r) {
  return `${q},${r}`;
}

// Store a visually rectangular, odd-r offset grid as axial coordinates. Each
// screen row has the same column count; only its left/right hex tips alternate.
export function cellKeyFromColumn(column, row) {
  return cellKey(column - Math.floor(row / 2), row);
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
    // Free-snap water objects are owned by the nearest Cell for persistence,
    // but their offset keeps their actual world position independent of the
    // Cell grid.
    freeObjects: [],
    actors: [],
    region: 'default',
  };
}

export function createEmptyMap({ width = 24, height = 17 } = {}) {
  const cells = {};
  for (let r = 0; r < height; r += 1) {
    for (let column = 0; column < width; column += 1) {
      const q = column - Math.floor(r / 2);
      const key = cellKey(q, r);
      cells[key] = makeCell(q, r);
    }
  }

  return {
    version: 1,
    layout: { orientation: 'pointy', coordinateSystem: 'axial', rowLayout: 'odd-r rectangle', width, height },
    cells,
    edges: {},
    chapterStates: {
      chapter1: { cells: {}, edges: {} },
      chapter2: { cells: {}, edges: {} },
    },
  };
}

export function migrateMapToOddR(map) {
  if (map.layout?.rowLayout === 'odd-r rectangle') return map;
  const migrated = clone(map);
  const keyMap = new Map();
  Object.entries(migrated.cells).forEach(([oldKey, cell]) => {
    // Legacy maps used q directly as the visual column. Preserve that column
    // while rewriting only the underlying axial coordinate.
    keyMap.set(oldKey, cellKeyFromColumn(cell.q, cell.r));
  });
  const remapCells = (cells) => Object.fromEntries(Object.entries(cells ?? {}).map(([oldKey, cell]) => {
    const newKey = keyMap.get(oldKey) ?? oldKey;
    const { q, r } = parseCellKey(newKey);
    return [newKey, { ...clone(cell), q, r }];
  }));
  const remapEdges = (edges) => Object.fromEntries(Object.entries(edges ?? {}).map(([oldKey, edge]) => {
    const { a, b } = parseEdgeKey(oldKey);
    const nextA = keyMap.get(a) ?? a;
    const nextB = keyMap.get(b) ?? b;
    return [edgeKey(nextA, nextB), { ...clone(edge), cells: [nextA, nextB] }];
  }));

  migrated.cells = remapCells(migrated.cells);
  migrated.edges = remapEdges(migrated.edges);
  Object.values(migrated.chapterStates ?? {}).forEach((chapterState) => {
    chapterState.cells = remapCells(chapterState.cells);
    chapterState.edges = remapEdges(chapterState.edges);
  });
  migrated.layout = { ...migrated.layout, orientation: 'pointy', coordinateSystem: 'axial', rowLayout: 'odd-r rectangle' };
  migrated.version = Math.max(migrated.version ?? 1, 2);
  return migrated;
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

export function screenPointToWorldPoint(point, viewportCenter, zoom) {
  return {
    x: (point.x - viewportCenter.x) / zoom + viewportCenter.x,
    y: (point.y - viewportCenter.y) / zoom + viewportCenter.y,
  };
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
    (cell.freeObjects ?? []).forEach((object) => {
      if (![...OVERLAY_TYPES, ...CELL_OBJECT_TYPES].includes(object.kind)) {
        results.push({ level: 'error', message: `${key} 有未知自由物件：${object.kind}` });
      }
      if (!object.offset || !Number.isFinite(object.offset.x) || !Number.isFinite(object.offset.y)) {
        results.push({ level: 'error', message: `${key} 的自由物件缺少有效位置：${object.kind}` });
      }
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
  const at = (column, row) => cellKeyFromColumn(column, row);
  const point = (columnRatio, rowRatio) => at(
    Math.round((width - 1) * columnRatio),
    Math.round((height - 1) * rowRatio),
  );
  Object.values(map.cells).forEach((cell) => {
    const levelIndex = Math.min(levels.length - 1, Math.floor((cell.r / Math.max(height - 1, 1)) * levels.length));
    cell.gravityLevel = levels[levelIndex];
  });

  const addOverlay = (key, kind) => map.cells[key].overlays.push(kind);
  const addObject = (key, kind) => map.cells[key].objects.push({ kind });
  const addActor = (key, kind) => map.cells[key].actors.push({ kind });
  addActor(point(0.12, 0.2), 'playerStart');
  addActor(point(0.62, 0.34), 'enemySpawn');
  addActor(point(0.76, 0.64), 'miniBossSpawn');
  addActor(at(width - 3, height - 3), 'bossSpawn');
  addOverlay(point(0.72, 0.2), 'ink');
  addObject(point(0.42, 0.34), 'mine');
  addObject(point(0.5, 0.34), 'weightStone');
  addObject(point(0.34, 0.62), 'oxygen');
  addObject(point(0.54, 0.74), 'checkpoint');
  addObject(point(0.8, 0.16), 'bubble');
  addObject(point(0.1, 0.7), 'torricelli');
  const springColumn = Math.round((width - 1) * 0.4);
  const spikeColumn = Math.round((width - 1) * 0.42);
  const barrierColumn = Math.round((width - 1) * 0.65);
  const currentColumn = Math.round((width - 1) * 0.26);
  const seaweedColumn = Math.round((width - 1) * 0.2);
  const coralClusterColumn = Math.round((width - 1) * 0.74);
  patchEdge(map, at(springColumn, Math.round((height - 1) * 0.34)), at(springColumn + 1, Math.round((height - 1) * 0.34)), { type: 'springJelly', blocksPassage: true });
  patchEdge(map, at(spikeColumn, Math.round((height - 1) * 0.62)), at(spikeColumn + 1, Math.round((height - 1) * 0.62)), { type: 'spike', blocksPassage: true });
  patchEdge(map, at(barrierColumn, Math.round((height - 1) * 0.62)), at(barrierColumn + 1, Math.round((height - 1) * 0.62)), { type: 'barrier', blocksPassage: true });
  patchEdge(map, at(currentColumn, Math.round((height - 1) * 0.46)), at(currentColumn + 1, Math.round((height - 1) * 0.46)), { type: 'current', currentDirection: 0, currentStrength: 1.5 });
  patchEdge(map, at(seaweedColumn, Math.round((height - 1) * 0.46)), at(seaweedColumn + 1, Math.round((height - 1) * 0.46)), { type: 'seaweed', blocksPassage: false });
  patchEdge(map, at(coralClusterColumn, Math.round((height - 1) * 0.2)), at(coralClusterColumn + 1, Math.round((height - 1) * 0.2)), { type: 'coralCluster', blocksPassage: false });
  return map;
}
