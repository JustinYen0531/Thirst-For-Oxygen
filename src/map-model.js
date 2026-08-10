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
export const WATER_LAYERS = Object.freeze(['T1', 'T2']);
export const TERRAIN_TYPES = Object.freeze(['water', 'blocked']);
export const OVERLAY_TYPES = Object.freeze(['ink']);
export const CELL_OBJECT_TYPES = Object.freeze([
  'coralCluster',
  'mine',
  'weightStone',
  'seaweed',
  'oxygen',
  'oxygenBubble',
  'checkpoint',
  'bubble',
  'torricelli',
  'razor',
  'button',
]);
// seaweed/coralCluster remain accepted in CELL_OBJECT_TYPES for existing saved
// maps, but new authoring always places them as Edge attachments.
export const EDGE_TYPES = Object.freeze(['none', 'springJelly', 'spike', 'barrier', 'current', 'seaweed', 'coralCluster', 'layerPortal', 'multiPortal']);
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
    gravityLevel: 'L0',
    waterLayer: 'T1',
    // A conditional passage starts locked as an impassable Cell. Its runtime
    // state is opened once by a button and then remains a water Cell.
    conditionalGate: null,
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

// The editor keeps a stable column width but may grow the map downward while
// authoring. New rows use the same odd-r coordinates as the original grid and
// continue each column's bottom-row gravity/layer, while starting as ordinary
// passable water Cells.
export function ensureOddRRows(map, throughRow) {
  const width = Math.max(1, Number(map.layout?.width) || 1);
  const currentHeight = Math.max(
    Number(map.layout?.height) || 0,
    ...Object.values(map.cells ?? {}).map((cell) => cell.r + 1),
  );
  const targetHeight = Math.max(currentHeight, Math.floor(Number(throughRow)) + 1);
  const bottomRow = currentHeight - 1;
  const columnTemplates = Array.from({ length: width }, (_, column) => {
    const sourceKey = cellKeyFromColumn(column, bottomRow);
    const source = map.cells[sourceKey];
    return {
      gravityLevel: source?.gravityLevel ?? 'L0',
      waterLayer: source?.waterLayer ?? 'T1',
      region: source?.region ?? 'default',
    };
  });
  for (let row = currentHeight; row < targetHeight; row += 1) {
    for (let column = 0; column < width; column += 1) {
      const q = column - Math.floor(row / 2);
      const key = cellKey(q, row);
      if (!map.cells[key]) {
        map.cells[key] = {
          ...makeCell(q, row),
          ...columnTemplates[column],
        };
      }
    }
  }
  map.layout.height = targetHeight;
  return map;
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
  const override = map.chapterStates?.[chapter]?.cells?.[key];
  const active = chapter === 'chapter1' ? base : (override ? { ...base, ...clone(override) } : base);
  return active.waterLayer ? active : { ...active, waterLayer: 'T1' };
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
  const revision = Number(map.__physicsRevision) || 0;
  Object.defineProperty(map, '__physicsRevision', { value: revision + 1, writable: true, configurable: true, enumerable: false });
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

// Odd-r rows alternate their horizontal offset by half a Cell. Rendering to
// these centre-to-centre limits trims only the alternating half-Cell tips,
// giving the editor a stable rectangular map silhouette without changing any
// Cell coordinate or hit-testing rule.
export function getOddRRectangularBounds(map, origin = { x: 0, y: 0 }) {
  const centers = Object.values(map.cells).map((cell) => getHexCenter(cell, origin));
  if (!centers.length) return { left: origin.x, right: origin.x, top: origin.y, bottom: origin.y };
  return {
    left: Math.min(...centers.map((center) => center.x)),
    right: Math.max(...centers.map((center) => center.x)),
    top: Math.min(...centers.map((center) => center.y)) - HEX_SIZE,
    bottom: Math.max(...centers.map((center) => center.y)) + HEX_SIZE,
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
  const renderOrigin = origin ?? { x: 78, y: 86 };
  if (map.layout?.rowLayout === 'odd-r rectangle') {
    const rowEstimate = Math.round((point.y - renderOrigin.y) / (HEX_SIZE * 1.5));
    const columnEstimate = Math.round((point.x - renderOrigin.x) / (HEX_SIZE * Math.sqrt(3)));
    for (let row = rowEstimate - 2; row <= rowEstimate + 2; row += 1) {
      for (let column = columnEstimate - 2; column <= columnEstimate + 2; column += 1) {
        const key = cellKeyFromColumn(column, row);
        const cell = getActiveCell(map, key, chapter);
        if (!cell) continue;
        const center = getHexCenter(cell, renderOrigin);
        const dx = Math.abs(point.x - center.x) / (Math.sqrt(3) * HEX_SIZE / 2);
        const dy = Math.abs(point.y - center.y) / HEX_SIZE;
        if (dy <= 1 && Math.sqrt(3) * dx + dy <= 2) return { key, cell };
      }
    }
    return null;
  }
  for (const key of Object.keys(map.cells)) {
    const cell = getActiveCell(map, key, chapter);
    if (!cell) continue;
    const center = getHexCenter(cell, renderOrigin);
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
    if (!WATER_LAYERS.includes(cell.waterLayer ?? 'T1')) results.push({ level: 'error', message: `${key} 的 waterLayer 無效：${cell.waterLayer}` });
    if (cell.conditionalGate != null && (typeof cell.conditionalGate !== 'object' || Array.isArray(cell.conditionalGate))) {
      results.push({ level: 'error', message: `${key} 的條件通行門資料無效。` });
    }
    if (cell.conditionalGate?.opened && cell.terrain !== 'water') {
      results.push({ level: 'error', message: `${key} 條件通行門已開啟，但地形仍不是可通行水域。` });
    }
    if (cell.conditionalGate && cell.gravityLevel !== 'L1') {
      results.push({ level: 'error', message: `${key} 條件通行門必須固定使用 L1 水域重力。` });
    }
    if (cell.conditionalGate && !cell.conditionalGate.opened && cell.terrain !== 'blocked') {
      results.push({ level: 'error', message: `${key} 條件通行門尚未開啟，但地形不是不可通行。` });
    }
    if (cell.terrain === 'blocked' && cell.actors.some((actor) => actor.kind === 'playerStart')) {
      results.push({ level: 'error', message: `${key} 不可通行，不能放置玩家起點。` });
    }
    cell.actors.forEach((actor) => {
      if (!ACTOR_TYPES.includes(actor.kind)) results.push({ level: 'error', message: `${key} 有未知 Actor：${actor.kind}` });
      if (actor.kind === 'playerStart') playerStarts += 1;
    });
    cell.objects.forEach((object) => {
      if (!CELL_OBJECT_TYPES.includes(object.kind)) results.push({ level: 'error', message: `${key} 有未知物件：${object.kind}` });
      if (object.kind === 'button') {
        if (object.mode != null && !['once', 'toggle'].includes(object.mode)) results.push({ level: 'error', message: `${key} 的按鈕模式無效：${object.mode}。` });
        if (!Array.isArray(object.targetGates)) results.push({ level: 'error', message: `${key} 的按鈕沒有指定條件通行門。` });
        else object.targetGates.forEach((gateKey) => {
          if (!map.cells[gateKey]) results.push({ level: 'error', message: `${key} 的按鈕指定了不存在的門：${gateKey}。` });
          else if (!map.cells[gateKey].conditionalGate) results.push({ level: 'error', message: `${key} 的按鈕目標 ${gateKey} 尚未標成條件通行門。` });
        });
      }
    });
    (cell.freeObjects ?? []).forEach((object) => {
      if (![...OVERLAY_TYPES, ...CELL_OBJECT_TYPES].includes(object.kind)) {
        results.push({ level: 'error', message: `${key} 有未知自由物件：${object.kind}` });
      }
      if (!object.offset || !Number.isFinite(object.offset.x) || !Number.isFinite(object.offset.y)) {
        results.push({ level: 'error', message: `${key} 的自由物件缺少有效位置：${object.kind}` });
      }
      if (object.kind === 'button') {
        if (object.mode != null && !['once', 'toggle'].includes(object.mode)) {
          results.push({ level: 'error', message: `${key} 的按鈕模式無效：${object.mode}。` });
        }
        if (!Array.isArray(object.targetGates)) {
          results.push({ level: 'error', message: `${key} 的按鈕沒有指定條件通行門。` });
        } else {
          object.targetGates.forEach((gateKey) => {
            if (!map.cells[gateKey]) results.push({ level: 'error', message: `${key} 的按鈕指定了不存在的門：${gateKey}。` });
            else if (!map.cells[gateKey].conditionalGate) results.push({ level: 'error', message: `${key} 的按鈕目標 ${gateKey} 尚未標成條件通行門。` });
          });
        }
      }
    });
  });

  Object.entries(map.edges).forEach(([key, edge]) => {
    const { a, b } = parseEdgeKey(key);
    if (!map.cells[a] || !map.cells[b]) results.push({ level: 'error', message: `孤立 Edge：${key}` });
    else if (!areNeighbors(a, b)) results.push({ level: 'error', message: `Edge 並非相鄰 Cell：${key}` });
    if (!EDGE_TYPES.includes(edge.type)) results.push({ level: 'error', message: `${key} 的 Edge 類型無效：${edge.type}` });
    if (edge.type === 'multiPortal') {
      if (!edge.portalGroupId) results.push({ level: 'error', message: `${key} 的多邊傳送門缺少群組編號。` });
      if (!Number.isInteger(edge.portalSlot) || edge.portalSlot < 0) results.push({ level: 'error', message: `${key} 的多邊傳送門缺少有效順序。` });
      if (edge.portalTargetKey && !map.edges[edge.portalTargetKey]) results.push({ level: 'error', message: `${key} 的多邊傳送門指定了不存在的對應 Edge。` });
      if (edge.portalTargetKey && map.edges[edge.portalTargetKey]?.type !== 'multiPortal') results.push({ level: 'error', message: `${key} 的多邊傳送門目標不是多邊傳送門。` });
    }
  });

  if (playerStarts === 0) results.push({ level: 'warning', message: '尚未放置玩家起點；物理測試會使用預設位置。' });
  if (playerStarts > 1) results.push({ level: 'warning', message: `玩家起點有 ${playerStarts} 個；物理測試會使用第一個。` });
  if (results.length === 0) results.push({ level: 'ok', message: '地圖結構有效。' });
  return results;
}

export function createBlankMap() {
  // A map author always starts with a clean, neutral water field. Objects,
  // actors, Edges, and non-zero gravity are authored deliberately afterward.
  return createEmptyMap();
}
