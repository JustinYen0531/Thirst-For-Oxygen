import {
  ACTOR_TYPES,
  CELL_OBJECT_TYPES,
  EDGE_TYPES,
  GRAVITY_ORDER,
  HEX_SIZE,
  OVERLAY_TYPES,
  TERRAIN_TYPES,
  allMapEdges,
  createDemoMap,
  edgeKey,
  findCellContainingPoint,
  getActiveCell,
  getActiveEdge,
  getEditableCell,
  getHexCenter,
  getHexVertices,
  getDirectionVector,
  migrateMapToOddR,
  patchCell,
  patchEdge,
  screenPointToWorldPoint,
  validateMap,
} from './map-model.js';
import {
  FIXED_STEP,
  WORLD_BOUNDS,
  createTestActor,
  findPlayerStart,
  launchActor,
  predictTrajectory,
  resetTestActor,
  stepPhysics,
  toggleSeaweedAttachment,
} from './physics.js';

const canvas = document.querySelector('#map-canvas');
const ctx = canvas.getContext('2d');
const statusLine = document.querySelector('#status-line');
const toolButtons = document.querySelector('#tool-buttons');
const brushValue = document.querySelector('#brush-value');
const chapterSelect = document.querySelector('#chapter-select');
const currentDirection = document.querySelector('#current-direction');
const currentStrength = document.querySelector('#current-strength');
const inspector = document.querySelector('#inspector');
const validationList = document.querySelector('#validation-list');
const eventList = document.querySelector('#event-list');
const dirtyIndicator = document.querySelector('#dirty-indicator');
const playHelp = document.querySelector('#play-help');
const editorModeButton = document.querySelector('#editor-mode');
const playModeButton = document.querySelector('#play-mode');
const zoomSlider = document.querySelector('#zoom-slider');
const zoomValue = document.querySelector('#zoom-value');
const paletteRoots = Object.fromEntries(['gravity', 'overlay', 'object', 'actor', 'edge', 'terrain']
  .map((name) => [name, document.querySelector(`#palette-${name}`)]));

const STORAGE_KEY = 'thirst-for-oxygen.map-editor.v1';
const gravityColours = {
  'L-1': '#a9ecf2',
  L0: '#aab7c7',
  L1: '#438ac8',
  L2: '#245eac',
  L3: '#132a76',
};
const waterTilePaths = {
  'L-1': '/assets/editor/water/L-1.png',
  L0: '/assets/editor/water/L0.png',
  L1: '/assets/editor/water/L1.png',
  L2: '/assets/editor/water/L2.png',
  L3: '/assets/editor/water/L3.png',
};
const objectSymbols = {
  coralCluster: '✿',
  mine: '✹',
  weightStone: '◆',
  seaweed: '≈',
  oxygen: 'O₂',
  checkpoint: '⚑',
  bubble: '○',
  torricelli: 'T',
};
const objectImagePaths = {
  coralCluster: '/assets/editor/objects/coral-cluster.png',
  coral: '/assets/editor/objects/coral-safe-zone-overlay.png',
  ink: '/assets/editor/objects/ink-zone-overlay.png',
  mine: '/assets/editor/objects/deep-sea-mine.png',
  weightStone: '/assets/editor/objects/heavy-stone.png',
  seaweed: '/assets/editor/objects/sea-grass.png',
  oxygen: '/assets/editor/objects/oxygen-ore.png',
  checkpoint: '/assets/editor/objects/checkpoint.png',
  bubble: '/assets/editor/objects/photosynthesis-bubble.png',
  torricelli: '/assets/editor/objects/torricelli-space.png',
};
const edgeImagePaths = {
  springJelly: '/assets/editor/edges/spring-jellyfish.png',
  spike: '/assets/editor/edges/edge-spike-barrier.png',
  barrier: '/assets/editor/edges/edge-spike-barrier.png',
};
const paletteImagePaths = { ...waterTilePaths, ...objectImagePaths, ...edgeImagePaths };
const paletteLabels = {
  water: '可通行水域', blocked: '不可通行',
  coral: '珊瑚安全區', ink: '墨水區', coralCluster: '珊瑚群落',
  mine: '深海地雷', weightStone: '重石', seaweed: '水草', oxygen: '氧氣礦石',
  checkpoint: 'Checkpoint', bubble: '光合作用氣泡', torricelli: '托里切利空間',
  playerStart: '玩家起點', enemySpawn: '敵人出生點', miniBossSpawn: 'Mini Boss', bossSpawn: 'Boss',
  none: '清除 Edge', springJelly: '彈簧水母', spike: '尖刺邊界', barrier: '通用邊界', current: '潮流',
};
const waterTiles = Object.fromEntries(Object.entries(waterTilePaths).map(([level, source]) => {
  const image = new Image();
  image.src = source;
  return [level, image];
}));
const objectImages = Object.fromEntries(Object.entries(objectImagePaths).map(([kind, source]) => {
  const image = new Image();
  image.src = source;
  return [kind, image];
}));
const edgeImages = Object.fromEntries(Object.entries(edgeImagePaths).map(([kind, source]) => {
  const image = new Image();
  image.src = source;
  return [kind, image];
}));
Object.values(waterTiles).forEach((image) => image.addEventListener('load', () => render()));
Object.values(objectImages).forEach((image) => image.addEventListener('load', () => render()));
Object.values(edgeImages).forEach((image) => image.addEventListener('load', () => render()));
const actorSymbols = {
  playerStart: 'P',
  enemySpawn: 'E',
  miniBossSpawn: 'M',
  bossSpawn: 'B',
};
const toolDefinitions = {
  select: { label: '選取', values: [] },
  terrain: { label: '地形', values: TERRAIN_TYPES },
  gravity: { label: '重力', values: GRAVITY_ORDER },
  overlay: { label: '環境效果', values: OVERLAY_TYPES },
  object: { label: 'Cell 物件', values: CELL_OBJECT_TYPES },
  actor: { label: 'Actor／出生點', values: ACTOR_TYPES },
  edge: { label: 'Edge 互動', values: EDGE_TYPES },
  erase: { label: '清除該層', values: [] },
};

function calculateMapOrigin(map) {
  const centers = Object.values(map.cells).map((cell) => getHexCenter(cell, { x: 0, y: 0 }));
  const halfWidth = (Math.sqrt(3) * HEX_SIZE) / 2;
  const minX = Math.min(...centers.map((center) => center.x)) - halfWidth;
  const maxX = Math.max(...centers.map((center) => center.x)) + halfWidth;
  const minY = Math.min(...centers.map((center) => center.y)) - HEX_SIZE;
  const maxY = Math.max(...centers.map((center) => center.y)) + HEX_SIZE;
  return {
    x: (canvas.width - (maxX - minX)) / 2 - minX,
    y: (canvas.height - (maxY - minY)) / 2 - minY,
  };
}

function loadMap() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed?.cells && parsed?.edges && parsed?.chapterStates) {
        const migrated = migrateMapToOddR(parsed);
        if (migrated !== parsed) localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
        return migrated;
      }
    }
  } catch (error) {
    console.warn('Unable to load saved map', error);
  }
  return createDemoMap();
}

const initialMap = loadMap();
const initialOrigin = calculateMapOrigin(initialMap);
const state = {
  map: initialMap,
  origin: initialOrigin,
  chapter: 'chapter1',
  mode: 'edit',
  tool: 'select',
  selectedCellKey: null,
  selectedEdgeKey: null,
  dirty: false,
  dragging: null,
  events: [],
  validation: [],
  actor: createTestActor(findPlayerStart(initialMap, 'chapter1', initialOrigin)),
  accumulator: 0,
  zoom: 1.5,
};

function setStatus(message) {
  statusLine.textContent = message;
}

function formatNumber(value) {
  return Math.round(value * 10) / 10;
}

function updatePaletteSelection() {
  document.querySelectorAll('[data-palette-tool]').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.paletteTool === state.tool && button.dataset.paletteValue === brushValue.value);
  });
}

function setTool(tool, preferredValue = null) {
  state.tool = tool;
  brushValue.innerHTML = '';
  const values = toolDefinitions[tool].values;
  values.forEach((value) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    brushValue.append(option);
  });
  if (preferredValue && values.includes(preferredValue)) brushValue.value = preferredValue;
  brushValue.disabled = values.length === 0;
  [...toolButtons.children].forEach((button) => button.classList.toggle('is-active', button.dataset.tool === tool));
  setStatus(`已選擇工具：${toolDefinitions[tool].label}`);
  updatePaletteSelection();
  render();
}

function markDirty(message) {
  state.dirty = true;
  dirtyIndicator.textContent = '尚未儲存到本機或匯出 JSON。';
  setStatus(message);
}

function saveLocal() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.map));
  state.dirty = false;
  dirtyIndicator.textContent = '已儲存到瀏覽器本機。';
  setStatus('已儲存地圖到本機。');
}

function createToolButtons() {
  Object.entries(toolDefinitions).forEach(([key, definition]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.tool = key;
    button.textContent = definition.label;
    button.addEventListener('click', () => setTool(key));
    toolButtons.append(button);
  });
}

function createPalette() {
  Object.entries(paletteRoots).forEach(([tool, root]) => {
    toolDefinitions[tool].values.forEach((value) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `palette-item palette-${tool}`;
      button.dataset.paletteTool = tool;
      button.dataset.paletteValue = value;
      const visual = document.createElement(paletteImagePaths[value] ? 'img' : 'span');
      if (visual.tagName === 'IMG') {
        visual.src = paletteImagePaths[value];
        visual.alt = '';
      } else {
        visual.className = 'palette-swatch';
        visual.textContent = tool === 'gravity' ? value : actorSymbols[value] ?? (tool === 'edge' ? '↔' : value === 'blocked' ? '■' : '◇');
        if (tool === 'gravity') visual.style.background = gravityColours[value];
      }
      const label = document.createElement('span');
      label.textContent = paletteLabels[value] ?? value;
      button.title = getPaletteNote(tool, value);
      button.append(visual, label);
      button.addEventListener('click', () => setTool(tool, value));
      root.append(button);
    });
  });
}

function getPaletteNote(tool, value) {
  if (tool === 'edge' && value === 'barrier') return '邏輯上是通用障礙；目前共用 edge-spike-barrier.png，沒有獨立 barrier 圖。';
  if (tool === 'edge' && value === 'current') return '潮流是程式化方向與強度工具，不使用 bitmap。';
  if (tool === 'edge' && value === 'none') return '清除 Edge 的操作，不是素材。';
  if (tool === 'actor') return '出生點是編輯器語意標記，不是本輪生成的靜態素材。';
  if (tool === 'terrain') return '地形狀態工具；水域外觀由重力水域素材與畫布底圖處理。';
  return paletteLabels[value] ?? value;
}

function pathHex(cell) {
  const vertices = getHexVertices(cell, state.origin);
  ctx.beginPath();
  vertices.forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.closePath();
}

function drawText(text, x, y, options = {}) {
  ctx.save();
  ctx.fillStyle = options.fill ?? '#eff8ff';
  ctx.font = options.font ?? '12px system-ui';
  ctx.textAlign = options.align ?? 'center';
  ctx.textBaseline = options.baseline ?? 'middle';
  ctx.fillText(text, x, y);
  ctx.restore();
}

function drawCell(key, cell) {
  const center = getHexCenter(cell, state.origin);
  ctx.save();
  pathHex(cell);
  ctx.clip();
  ctx.fillStyle = cell.terrain === 'blocked' ? '#3e4249' : gravityColours[cell.gravityLevel];
  ctx.fillRect(center.x - HEX_SIZE, center.y - HEX_SIZE, HEX_SIZE * 2, HEX_SIZE * 2);
  const waterTile = waterTiles[cell.gravityLevel];
  if (cell.terrain === 'water' && waterTile?.complete && waterTile.naturalWidth > 0) {
    ctx.drawImage(waterTile, center.x - HEX_SIZE, center.y - HEX_SIZE, HEX_SIZE * 2, HEX_SIZE * 2);
  }
  ctx.restore();
  pathHex(cell);
  ctx.lineWidth = 1;
  ctx.strokeStyle = '#0c1c36';
  ctx.stroke();

  cell.overlays.forEach((overlay) => drawCellAsset(overlay, center.x, center.y, HEX_SIZE * 1.8));
  drawText(cell.gravityLevel, center.x, center.y, { font: 'bold 7px ui-monospace, monospace' });
  cell.objects.forEach((object, index) => {
    const angle = (index / Math.max(cell.objects.length, 1)) * Math.PI * 2;
    const x = center.x + Math.cos(angle) * 4;
    const y = center.y + Math.sin(angle) * 4;
    drawCellAsset(object.kind, x, y, HEX_SIZE * 1.45);
  });
  cell.actors.forEach((actor, index) => {
    drawText(actorSymbols[actor.kind] ?? '?', center.x - 6 + index * 5, center.y + 6, { font: 'bold 7px system-ui', fill: '#ffdde4' });
  });

  if (state.selectedCellKey === key) {
    pathHex(cell);
    ctx.setLineDash([5, 3]);
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#f6e66d';
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

function drawCellAsset(kind, x, y, size) {
  const image = objectImages[kind];
  if (image?.complete && image.naturalWidth > 0) {
    ctx.save();
    ctx.drawImage(image, x - size / 2, y - size / 2, size, size);
    ctx.restore();
    return;
  }
  drawText(objectSymbols[kind] ?? kind[0]?.toUpperCase() ?? '?', x, y, { font: 'bold 8px system-ui', fill: '#f9e38c' });
}

function drawArrow(origin, vector, colour = '#ebff6b') {
  const end = { x: origin.x + vector.x * 9, y: origin.y + vector.y * 9 };
  const left = { x: end.x - vector.x * 4 - vector.y * 3, y: end.y - vector.y * 4 + vector.x * 3 };
  const right = { x: end.x - vector.x * 4 + vector.y * 3, y: end.y - vector.y * 4 - vector.x * 3 };
  ctx.save();
  ctx.strokeStyle = colour;
  ctx.fillStyle = colour;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(origin.x, origin.y);
  ctx.lineTo(end.x, end.y);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(end.x, end.y);
  ctx.lineTo(left.x, left.y);
  ctx.lineTo(right.x, right.y);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawEdges() {
  allMapEdges(state.map).forEach(({ key, a, b }) => {
    const edge = getActiveEdge(state.map, key, state.chapter);
    if (!edge || edge.type === 'none') return;
    const centerA = getHexCenter(getActiveCell(state.map, a, state.chapter), state.origin);
    const centerB = getHexCenter(getActiveCell(state.map, b, state.chapter), state.origin);
    const midpoint = { x: (centerA.x + centerB.x) / 2, y: (centerA.y + centerB.y) / 2 };
    const selected = state.selectedEdgeKey === key;
    const edgeAngle = Math.atan2(centerB.y - centerA.y, centerB.x - centerA.x);
    const edgeLength = Math.hypot(centerB.x - centerA.x, centerB.y - centerA.y);
    const edgeImage = edgeImages[edge.type];
    if (edgeImage?.complete && edgeImage.naturalWidth > 0) {
      const width = edgeLength * 1.04;
      const height = width * (edgeImage.naturalHeight / edgeImage.naturalWidth);
      ctx.save();
      ctx.translate(midpoint.x, midpoint.y);
      ctx.rotate(edgeAngle);
      ctx.globalAlpha = selected ? 1 : 0.92;
      ctx.drawImage(edgeImage, -width / 2, -height / 2, width, height);
      ctx.restore();
    }
    ctx.save();
    ctx.lineWidth = selected ? 3 : 2;
    ctx.strokeStyle = selected ? '#f6e66d' : ({ springJelly: '#e37bff', spike: '#ff6f68', barrier: '#abb5c5', current: '#d9ff68' }[edge.type]);
    ctx.beginPath();
    ctx.arc(midpoint.x, midpoint.y, selected ? 6 : 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    if (edge.type === 'springJelly' && !(edgeImage?.complete && edgeImage.naturalWidth > 0)) drawText('J', midpoint.x, midpoint.y, { font: 'bold 7px system-ui' });
    if (edge.type === 'spike' && !(edgeImage?.complete && edgeImage.naturalWidth > 0)) drawText('▲', midpoint.x, midpoint.y + 1, { font: 'bold 7px system-ui', fill: '#ffb5aa' });
    if (edge.type === 'barrier' && !(edgeImage?.complete && edgeImage.naturalWidth > 0)) drawText('▌', midpoint.x, midpoint.y, { font: 'bold 9px system-ui' });
    if (edge.type === 'current') drawArrow(midpoint, getDirectionVector(edge.currentDirection));
  });
}

function drawSelectedCellNeighbours() {
  if (!state.selectedCellKey) return;
  const cell = getActiveCell(state.map, state.selectedCellKey, state.chapter);
  if (!cell) return;
  const center = getHexCenter(cell, state.origin);
  ctx.save();
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 4]);
  ctx.strokeStyle = '#d2ecff';
  allMapEdges(state.map).forEach(({ a, b }) => {
    const other = a === state.selectedCellKey ? b : b === state.selectedCellKey ? a : null;
    if (!other) return;
    const otherCenter = getHexCenter(getActiveCell(state.map, other, state.chapter), state.origin);
    ctx.beginPath();
    ctx.moveTo(center.x, center.y);
    ctx.lineTo(otherCenter.x, otherCenter.y);
    ctx.stroke();
  });
  ctx.restore();
}

function drawTrajectory() {
  if (!state.dragging || state.mode !== 'play' || state.actor.attached) return;
  const points = predictTrajectory({
    map: state.map,
    chapter: state.chapter,
    actor: state.actor,
    pointer: state.dragging.pointer,
    origin: state.origin,
    steps: 96,
  });
  ctx.save();
  ctx.fillStyle = 'rgba(255, 239, 112, 0.8)';
  points.forEach((point, index) => {
    if (index % 3 !== 0) return;
    ctx.beginPath();
    ctx.arc(point.x, point.y, 2, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.strokeStyle = '#ffe969';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(state.actor.x, state.actor.y);
  ctx.lineTo(state.dragging.pointer.x, state.dragging.pointer.y);
  ctx.stroke();
  ctx.restore();
}

function drawTestActor() {
  if (state.mode !== 'play') return;
  const actor = state.actor;
  ctx.save();
  ctx.fillStyle = actor.attached ? '#70e88e' : '#fff9d3';
  ctx.strokeStyle = '#132338';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(actor.x, actor.y, actor.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  drawText(actor.attached ? 'A' : 'P', actor.x, actor.y, { font: 'bold 20px system-ui', fill: '#16202d' });
  ctx.restore();
}

function drawInkMask() {
  if (state.mode !== 'play' || !state.actor.inInk) return;
  ctx.save();
  ctx.fillStyle = 'rgba(2, 3, 12, 0.78)';
  ctx.beginPath();
  ctx.rect(0, 0, canvas.width, canvas.height);
  ctx.arc(state.actor.x, state.actor.y, 110, 0, Math.PI * 2);
  ctx.fill('evenodd');
  ctx.restore();
}

function renderInspector() {
  if (state.selectedEdgeKey) {
    const edge = getActiveEdge(state.map, state.selectedEdgeKey, state.chapter);
    inspector.textContent = JSON.stringify({
      kind: 'Edge',
      key: state.selectedEdgeKey,
      chapter: state.chapter,
      ...edge,
    }, null, 2);
    return;
  }
  if (state.selectedCellKey) {
    const cell = getActiveCell(state.map, state.selectedCellKey, state.chapter);
    inspector.textContent = JSON.stringify({ kind: 'Cell', key: state.selectedCellKey, chapter: state.chapter, ...cell }, null, 2);
    return;
  }
  inspector.textContent = '未選取 Cell 或 Edge。';
}

function renderLists() {
  validationList.innerHTML = '';
  (state.validation.length ? state.validation : [{ level: 'info', message: '尚未執行。' }]).forEach((result) => {
    const item = document.createElement('li');
    item.className = `validation-${result.level}`;
    item.textContent = result.message;
    validationList.append(item);
  });
  eventList.innerHTML = '';
  (state.events.length ? state.events : [{ message: '尚無事件。' }]).forEach((event) => {
    const item = document.createElement('li');
    item.textContent = event.message;
    eventList.append(item);
  });
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#091423';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.scale(state.zoom, state.zoom);
  ctx.translate(-canvas.width / 2, -canvas.height / 2);
  Object.entries(state.map.cells).forEach(([key]) => drawCell(key, getActiveCell(state.map, key, state.chapter)));
  drawSelectedCellNeighbours();
  drawEdges();
  drawTrajectory();
  drawTestActor();
  drawInkMask();
  ctx.restore();
  renderInspector();
  renderLists();
  editorModeButton.classList.toggle('is-active', state.mode === 'edit');
  playModeButton.classList.toggle('is-active', state.mode === 'play');
  playHelp.hidden = state.mode !== 'play';
}

function eventPoint(event) {
  const rect = canvas.getBoundingClientRect();
  const screenPoint = {
    x: (event.clientX - rect.left) * (canvas.width / rect.width),
    y: (event.clientY - rect.top) * (canvas.height / rect.height),
  };
  return screenPointToWorldPoint(screenPoint, { x: canvas.width / 2, y: canvas.height / 2 }, state.zoom);
}

function edgeAtPoint(point) {
  let closest = null;
  allMapEdges(state.map).forEach(({ key, a, b }) => {
    const centerA = getHexCenter(getActiveCell(state.map, a, state.chapter), state.origin);
    const centerB = getHexCenter(getActiveCell(state.map, b, state.chapter), state.origin);
    const midpoint = { x: (centerA.x + centerB.x) / 2, y: (centerA.y + centerB.y) / 2 };
    const distance = Math.hypot(point.x - midpoint.x, point.y - midpoint.y);
    if (distance < 7 && (!closest || distance < closest.distance)) closest = { key, a, b, distance };
  });
  return closest;
}

function addOrRemove(values, value) {
  return values.includes(value) ? values.filter((candidate) => candidate !== value) : [...values, value];
}

function applyCellTool(key) {
  const cell = getActiveCell(state.map, key, state.chapter);
  const value = brushValue.value;
  state.selectedCellKey = key;
  state.selectedEdgeKey = null;
  if (state.tool === 'select') {
    setStatus(`已選取 Cell ${key}`);
    return;
  }
  if (state.tool === 'terrain') patchCell(state.map, key, { terrain: value }, state.chapter);
  if (state.tool === 'gravity') patchCell(state.map, key, { gravityLevel: value }, state.chapter);
  if (state.tool === 'overlay') patchCell(state.map, key, { overlays: addOrRemove(cell.overlays, value) }, state.chapter);
  if (state.tool === 'object') {
    const existing = cell.objects.some((object) => object.kind === value);
    const objects = existing ? cell.objects.filter((object) => object.kind !== value) : [...cell.objects, { kind: value }];
    patchCell(state.map, key, { objects }, state.chapter);
  }
  if (state.tool === 'actor') {
    if (value === 'playerStart') {
      Object.keys(state.map.cells).forEach((otherKey) => {
        const other = getEditableCell(state.map, otherKey, state.chapter);
        if (other.actors.some((actor) => actor.kind === 'playerStart')) {
          patchCell(state.map, otherKey, { actors: other.actors.filter((actor) => actor.kind !== 'playerStart') }, state.chapter);
        }
      });
    }
    const editable = getEditableCell(state.map, key, state.chapter);
    const exists = editable.actors.some((actor) => actor.kind === value);
    patchCell(state.map, key, { actors: exists ? editable.actors.filter((actor) => actor.kind !== value) : [...editable.actors, { kind: value }] }, state.chapter);
  }
  if (state.tool === 'erase') patchCell(state.map, key, { overlays: [], objects: [], actors: [] }, state.chapter);
  markDirty(`${key} 已套用 ${toolDefinitions[state.tool].label}${value ? `：${value}` : ''}。`);
}

function applyEdgeTool(edgeTarget) {
  state.selectedEdgeKey = edgeTarget.key;
  state.selectedCellKey = null;
  const value = brushValue.value;
  if (state.tool === 'select') {
    setStatus(`已選取 Edge ${edgeTarget.key}`);
    return;
  }
  if (state.tool === 'edge') {
    const isBlocking = ['springJelly', 'spike', 'barrier'].includes(value);
    patchEdge(state.map, edgeTarget.a, edgeTarget.b, {
      type: value,
      blocksPassage: isBlocking,
      currentDirection: Number(currentDirection.value),
      currentStrength: value === 'current' ? Number(currentStrength.value) : 0,
    }, state.chapter);
  }
  if (state.tool === 'erase') patchEdge(state.map, edgeTarget.a, edgeTarget.b, { type: 'none', blocksPassage: false, currentStrength: 0 }, state.chapter);
  markDirty(`${edgeTarget.key} 已套用 Edge 設定。`);
}

function recordEvents(events) {
  if (!events.length) return;
  state.events = [...events, ...state.events].slice(0, 8);
  if (events.some((event) => event.type === 'weightStone')) state.dirty = true;
}

function stepGame() {
  if (state.mode !== 'play') return;
  const events = stepPhysics({ map: state.map, chapter: state.chapter, actor: state.actor, origin: state.origin, bounds: WORLD_BOUNDS });
  if (state.actor.health <= 0 || state.actor.oxygen <= 0) {
    const cause = state.actor.health <= 0 ? '生命歸零' : '氧氣歸零';
    const spawn = state.actor.spawn;
    Object.assign(state.actor, createTestActor(spawn));
    recordEvents([{ type: 'respawn', message: `${cause}：已回到最近 Checkpoint。` }]);
  }
  recordEvents(events);
}

function animationFrame(now) {
  const elapsed = Math.min((now - (animationFrame.last ?? now)) / 1000, 0.1);
  animationFrame.last = now;
  if (state.mode === 'play') {
    state.accumulator += elapsed;
    while (state.accumulator >= FIXED_STEP) {
      stepGame();
      state.accumulator -= FIXED_STEP;
    }
  }
  render();
  requestAnimationFrame(animationFrame);
}

canvas.addEventListener('pointerdown', (event) => {
  const point = eventPoint(event);
  if (state.mode === 'play') {
    if (Math.hypot(point.x - state.actor.x, point.y - state.actor.y) < 52) {
      state.dragging = { pointer: point };
      canvas.setPointerCapture(event.pointerId);
    }
    return;
  }
  const hitEdge = edgeAtPoint(point);
  if ((state.tool === 'edge' || state.tool === 'erase') && hitEdge) {
    applyEdgeTool(hitEdge);
    render();
    return;
  }
  const hitCell = findCellContainingPoint(state.map, point, state.chapter, state.origin);
  if (hitCell) applyCellTool(hitCell.key);
  render();
});

canvas.addEventListener('pointermove', (event) => {
  if (!state.dragging) return;
  state.dragging.pointer = eventPoint(event);
});

canvas.addEventListener('pointerup', (event) => {
  if (!state.dragging) return;
  const pointer = eventPoint(event);
  const speed = launchActor(state.actor, pointer);
  if (speed > 0) recordEvents([{ type: 'launch', message: `彈射初速度：${Math.round(speed)} px/s；之後由固定步長重力與潮流持續影響。` }]);
  state.dragging = null;
  if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
});

function setMode(mode) {
  state.mode = mode;
  state.dragging = null;
  state.accumulator = 0;
  if (mode === 'play') {
    resetTestActor(state.actor, state.map, state.chapter, state.origin);
    setStatus('物理測試已開始：拖曳玩家並放開以彈射。');
  } else setStatus('回到編輯模式。');
  render();
}

editorModeButton.addEventListener('click', () => setMode('edit'));
playModeButton.addEventListener('click', () => setMode('play'));
document.querySelector('#reset-player').addEventListener('click', () => {
  resetTestActor(state.actor, state.map, state.chapter, state.origin);
  recordEvents([{ type: 'reset', message: '測試玩家已回到玩家起點。' }]);
  render();
});
document.querySelector('#fullscreen').addEventListener('click', async () => {
  if (document.fullscreenElement) await document.exitFullscreen();
  else await canvas.requestFullscreen();
});
document.querySelector('#demo-map').addEventListener('click', () => {
  state.map = createDemoMap();
  state.origin = calculateMapOrigin(state.map);
  state.zoom = 1.5;
  zoomSlider.value = String(state.zoom);
  zoomValue.textContent = '150%';
  state.chapter = 'chapter1';
  chapterSelect.value = state.chapter;
  state.selectedCellKey = null;
  state.selectedEdgeKey = null;
  markDirty('已載入 24×17 示範地圖；它含五級水域、物件與 Edge 互動。');
  render();
});
document.querySelector('#save-local').addEventListener('click', saveLocal);
document.querySelector('#validate-map').addEventListener('click', () => {
  state.validation = validateMap(state.map);
  const errors = state.validation.filter((result) => result.level === 'error').length;
  setStatus(errors ? `地圖驗證完成：${errors} 項錯誤。` : '地圖驗證完成，沒有結構錯誤。');
  render();
});
document.querySelector('#export-map').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(state.map, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'thirst-for-oxygen-map.json';
  link.click();
  URL.revokeObjectURL(url);
  setStatus('已匯出 JSON 地圖檔。');
});
document.querySelector('#import-map').addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    if (!parsed?.cells || !parsed?.edges || !parsed?.chapterStates) throw new Error('格式缺少 cells、edges 或 chapterStates');
    state.map = migrateMapToOddR(parsed);
    state.origin = calculateMapOrigin(state.map);
    state.selectedCellKey = null;
    state.selectedEdgeKey = null;
    state.validation = validateMap(state.map);
    markDirty(`已匯入 ${file.name}。`);
  } catch (error) {
    setStatus(`匯入失敗：${error.message}`);
  }
  event.target.value = '';
  render();
});
chapterSelect.addEventListener('change', () => {
  state.chapter = chapterSelect.value;
  resetTestActor(state.actor, state.map, state.chapter, state.origin);
  setStatus(`已切換為${chapterSelect.options[chapterSelect.selectedIndex].text}。`);
  render();
});
zoomSlider.addEventListener('input', () => {
  state.zoom = Number(zoomSlider.value);
  zoomValue.textContent = `${Math.round(state.zoom * 100)}%`;
  render();
});

window.addEventListener('keydown', (event) => {
  if (event.key.toLowerCase() === 'r') {
    resetTestActor(state.actor, state.map, state.chapter, state.origin);
    recordEvents([{ type: 'reset', message: '測試玩家已重設。' }]);
  }
  if (event.key.toLowerCase() === 'e' && state.mode === 'play') {
    const result = toggleSeaweedAttachment(state.actor, state.map, state.chapter, state.origin);
    recordEvents([{ type: 'seaweed', message: result.message }]);
  }
  if (event.key === ' ' && state.mode === 'play') {
    event.preventDefault();
    const speed = launchActor(state.actor, { x: state.actor.x, y: state.actor.y + 115 });
    if (speed) recordEvents([{ type: 'launch', message: `快速向上彈射：${Math.round(speed)} px/s。` }]);
  }
  if (event.key.toLowerCase() === 'f') {
    event.preventDefault();
    if (document.fullscreenElement) document.exitFullscreen();
    else canvas.requestFullscreen();
  }
});

window.render_game_to_text = () => {
  const actorCell = findCellContainingPoint(state.map, state.actor, state.chapter, state.origin)?.key ?? null;
  const configuredEdges = Object.values(state.map.edges).filter((edge) => edge.type !== 'none').length;
  return JSON.stringify({
    coordinateSystem: 'canvas origin top-left; x right, y down; map cells use pointy-top axial q,r',
    mode: state.mode,
    chapter: state.chapter,
    selection: state.selectedEdgeKey ? { edge: state.selectedEdgeKey } : { cell: state.selectedCellKey },
    player: {
      x: formatNumber(state.actor.x), y: formatNumber(state.actor.y),
      vx: formatNumber(state.actor.vx), vy: formatNumber(state.actor.vy),
      cell: actorCell, health: state.actor.health, oxygen: formatNumber(state.actor.oxygen),
      stamina: formatNumber(state.actor.stamina), attached: state.actor.attached,
      gravityImmuneFor: formatNumber(state.actor.gravityImmunity),
    },
    map: { cells: Object.keys(state.map.cells).length, configuredEdges, dirty: state.dirty },
    viewport: { zoom: state.zoom },
  });
};

window.advanceTime = (milliseconds) => {
  const steps = Math.max(1, Math.round(milliseconds / (FIXED_STEP * 1000)));
  for (let index = 0; index < steps; index += 1) stepGame();
  render();
  return window.render_game_to_text();
};

brushValue.addEventListener('change', updatePaletteSelection);
createToolButtons();
createPalette();
setTool('select');
state.validation = validateMap(state.map);
dirtyIndicator.textContent = '示範地圖已載入；可直接修改或匯入自己的 JSON。';
requestAnimationFrame(animationFrame);
