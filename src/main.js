import {
  ACTOR_TYPES,
  CELL_OBJECT_TYPES,
  DIRECTIONS,
  EDGE_TYPES,
  GRAVITY_ORDER,
  HEX_SIZE,
  OVERLAY_TYPES,
  WATER_LAYERS,
  TERRAIN_TYPES,
  allMapEdges,
  cellKeyFromColumn,
  createBlankMap,
  edgeKey,
  ensureOddRRows,
  findCellContainingPoint,
  getActiveCell,
  getActiveEdge,
  getEditableCell,
  getHexCenter,
  getHexVertices,
  getOddRRectangularBounds,
  getDirectionVector,
  migrateMapToOddR,
  neighborKey,
  patchCell,
  patchEdge,
  screenPointToWorldPoint,
  validateMap,
} from './map-model.js';
import {
  FIXED_STEP,
  EDGE_ATTACHMENT_HELP_RADIUS,
  WORLD_BOUNDS,
  createTestActor,
  drainAimEnergy,
  findPlayerStart,
  isActorNearEdgeAttachment,
  launchActor,
  MAX_ENERGY,
  MAX_HEALTH,
  MAX_OXYGEN,
  registerPlayerDeath,
  respawnActor,
  resetTestActor,
  startTestRun,
  stepPhysics,
  toggleSeaweedAttachment,
} from './physics.js';
import {
  getEdgeFields,
  getEdgeSetting,
  getFreeObjectFields,
  getFreeObjectHitRadius,
  getFreeObjectSetting,
  getOfficialEdgeState,
  getOfficialFreeObjectState,
} from './map-object-settings.js';
import {
  MULTI_PORTAL_EDGE_TYPE,
  connectPortalGroups,
  disconnectPortalGroup,
  getPortalGroupAnchor,
  getPortalGroupEdges,
  getPortalGroupId,
  getPortalGroupMidpoint,
} from './portal.js';
import { drawLaunchGuide, getLaunchGuideGeometry } from './launch-guide.js';
import {
  PLAYER_ANIMATION_ASSETS,
  PLAYER_ANIMATION_IMAGE_KEYS,
  getPlayerAnimationMotion,
  getPlayerAnimationPosition,
  getPlayerAnimationState,
} from './player-animation.js';

const canvas = document.querySelector('#map-canvas');
const ctx = canvas.getContext('2d');
const canvasViewport = document.querySelector('#map-viewport');
const statusLine = document.querySelector('#status-line');
const toolButtons = document.querySelector('#tool-buttons');
const brushValue = document.querySelector('#brush-value');
const objectPlacementControl = document.querySelector('#object-placement-control');
const objectPlacementButtons = [...document.querySelectorAll('[data-object-placement]')];
const chapterSelect = document.querySelector('#chapter-select');
const currentDirection = document.querySelector('#current-direction');
const currentStrength = document.querySelector('#current-strength');
const inspector = document.querySelector('#inspector');
const validationList = document.querySelector('#validation-list');
const eventList = document.querySelector('#event-list');
const dirtyIndicator = document.querySelector('#dirty-indicator');
const playHelp = document.querySelector('#play-help');
const playerHud = document.querySelector('#player-hud');
const hudMode = document.querySelector('#hud-mode');
const hudHealth = document.querySelector('#hud-health');
const hudHealthValue = document.querySelector('#hud-health-value');
const hudLives = document.querySelector('#hud-lives');
const hudLivesValue = document.querySelector('#hud-lives-value');
const hudOxygen = document.querySelector('#hud-oxygen');
const hudOxygenValue = document.querySelector('#hud-oxygen-value');
const hudEnergy = document.querySelector('#hud-energy');
const hudEnergyValue = document.querySelector('#hud-energy-value');
const editorModeButton = document.querySelector('#editor-mode');
const playModeButton = document.querySelector('#play-mode');
const zoomSlider = document.querySelector('#zoom-slider');
const zoomValue = document.querySelector('#zoom-value');
const eraserButton = document.querySelector('#palette-eraser');
const paletteTabs = [...document.querySelectorAll('[data-palette-tab]')];
const palettePanels = [...document.querySelectorAll('[data-palette-panel]')];
const paletteRoots = Object.fromEntries(['gravity', 'overlay', 'actor', 'edge']
  .map((name) => [name, document.querySelector(`#palette-${name}`)]));

const STORAGE_KEY = 'thirst-for-oxygen.map-editor.v2';
const RETIRED_DEMO_STORAGE_KEY = 'thirst-for-oxygen.map-editor.v1';
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
const conditionalGatePath = '/assets/editor/water/conditional-L1.png';
const terrainImagePaths = {
  blocked: '/assets/editor/terrain/blocked-dark-stone.png',
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
  razor: '✦',
  button: '⏺',
};
const objectImagePaths = {
  coralCluster: '/assets/editor/objects/coral-cluster.png',
  ink: '/assets/editor/objects/ink-zone-overlay.png',
  mine: '/assets/editor/objects/deep-sea-mine.png',
  weightStone: '/assets/editor/objects/heavy-stone.png',
  seaweed: '/assets/editor/objects/sea-grass.png',
  oxygen: '/assets/editor/objects/oxygen-ore.png',
  checkpoint: '/assets/editor/objects/checkpoint.png',
  bubble: '/assets/editor/objects/photosynthesis-bubble.png',
  torricelli: '/assets/editor/objects/torricelli-space.png',
  razor: '/assets/editor/objects/razor-blade.png',
};
const componentImagePaths = {
  razorAxis: '/assets/editor/objects/razor-axis.png',
};
const edgeImagePaths = {
  springJelly: '/assets/editor/edges/spring-jellyfish.png',
  spike: '/assets/editor/edges/edge-spike-barrier.png',
  barrier: '/assets/editor/edges/edge-spike-barrier.png',
  layerPortal: '/assets/editor/edges/layer-portal-stair.png',
  seaweed: '/assets/editor/objects/sea-grass.png',
  coralCluster: '/assets/editor/objects/coral-cluster.png',
  multiPortal: '/assets/editor/edges/multi-portal.png',
};
const actorImagePaths = {
  playerStart: PLAYER_ANIMATION_ASSETS.swim,
  playerSwim: PLAYER_ANIMATION_ASSETS.swim,
  playerHurt: PLAYER_ANIMATION_ASSETS.hurt,
  playerDeath: PLAYER_ANIMATION_ASSETS.death,
  playerFastAscent: PLAYER_ANIMATION_ASSETS.fastAscent,
};
const paletteImagePaths = { ...waterTilePaths, conditionalGate: conditionalGatePath, ...terrainImagePaths, ...objectImagePaths, ...edgeImagePaths, ...actorImagePaths };
const paletteLabels = {
  water: '可通行水域', blocked: '不可通行', T1: '水域第一層（T1）', T2: '水域第二層（T2）',
  ink: '墨水區', coralCluster: '珊瑚群落',
  mine: '深海地雷', weightStone: '重石', seaweed: '水草', oxygen: '氧氣礦石',
  checkpoint: 'Checkpoint', bubble: '光合作用氣泡', torricelli: '托里切利空間', razor: '剃刀', button: '一次性開門按鈕',
  conditionalGate: '條件通行門（L1）',
  noGate: '不是條件通行門', buttonGate: '條件通行門',
  once: '一次性開門', toggle: '開關門',
  playerStart: '玩家起點', enemySpawn: '敵人出生點', miniBossSpawn: 'Mini Boss', bossSpawn: 'Boss',
  none: '清除 Edge', springJelly: '彈簧水母', spike: '尖刺邊界', barrier: '通用邊界', current: '潮流', layerPortal: '層間轉接門', multiPortal: '多邊傳送門',
};
const waterTiles = Object.fromEntries(Object.entries(waterTilePaths).map(([level, source]) => {
  const image = new Image();
  image.src = source;
  return [level, image];
}));
const conditionalGateImage = new Image();
conditionalGateImage.src = conditionalGatePath;
const terrainImages = Object.fromEntries(Object.entries(terrainImagePaths).map(([kind, source]) => {
  const image = new Image();
  image.src = source;
  return [kind, image];
}));
const objectImages = Object.fromEntries(Object.entries(objectImagePaths).map(([kind, source]) => {
  const image = new Image();
  image.src = source;
  return [kind, image];
}));
const componentImages = Object.fromEntries(Object.entries(componentImagePaths).map(([kind, source]) => {
  const image = new Image();
  image.src = source;
  return [kind, image];
}));
const edgeImages = Object.fromEntries(Object.entries(edgeImagePaths).map(([kind, source]) => {
  const image = new Image();
  image.src = source;
  return [kind, image];
}));
const actorImages = Object.fromEntries(Object.entries(actorImagePaths).map(([kind, source]) => {
  const image = new Image();
  image.src = source;
  return [kind, image];
}));
Object.values(waterTiles).forEach((image) => image.addEventListener('load', () => render()));
conditionalGateImage.addEventListener('load', () => render());
Object.values(terrainImages).forEach((image) => image.addEventListener('load', () => render()));
Object.values(objectImages).forEach((image) => image.addEventListener('load', () => render()));
Object.values(componentImages).forEach((image) => image.addEventListener('load', () => render()));
Object.values(edgeImages).forEach((image) => image.addEventListener('load', () => render()));
Object.values(actorImages).forEach((image) => image.addEventListener('load', () => render()));
const actorSymbols = {
  playerStart: 'D',
  enemySpawn: 'E',
  miniBossSpawn: 'M',
  bossSpawn: 'B',
};
const toolDefinitions = {
  select: { label: '選取', values: [] },
  terrain: { label: '地形', values: TERRAIN_TYPES },
  gravity: { label: '重力', values: [...GRAVITY_ORDER, 'conditionalGate'] },
  waterLayer: { label: '水域層級', values: WATER_LAYERS },
  overlay: { label: '環境效果', values: OVERLAY_TYPES },
  object: { label: 'Cell 物件', values: CELL_OBJECT_TYPES },
  actor: { label: 'Actor／出生點', values: ACTOR_TYPES },
  edge: { label: 'Edge 互動', values: EDGE_TYPES.filter((value) => value !== 'none') },
  erase: { label: '橡皮擦', values: [] },
};

const DEFAULT_ZOOM = 2;
const MAP_VERTICAL_BUFFER_ROWS = 4;
const MAP_TOP_SCREEN_PADDING = 24;
const MAP_ROW_STEP = HEX_SIZE * 1.5;

function calculateCanvasWidth(map) {
  const bounds = getOddRRectangularBounds(map, { x: 0, y: 0 });
  return Math.max(1, Math.ceil((bounds.right - bounds.left) * DEFAULT_ZOOM));
}

function calculateCanvasHeight(map, zoom = DEFAULT_ZOOM) {
  const bounds = getOddRRectangularBounds(map, { x: 0, y: 0 });
  const worldHeight = bounds.bottom - bounds.top + MAP_VERTICAL_BUFFER_ROWS * MAP_ROW_STEP;
  return Math.max(1, Math.ceil(worldHeight * zoom + MAP_TOP_SCREEN_PADDING * 2));
}

function syncCanvasGeometry(map, zoom = DEFAULT_ZOOM) {
  const previousScrollTop = canvasViewport?.scrollTop ?? 0;
  canvas.width = calculateCanvasWidth(map);
  canvas.height = calculateCanvasHeight(map, zoom);
  if (canvasViewport) {
    canvasViewport.scrollTop = Math.min(previousScrollTop, Math.max(0, canvasViewport.scrollHeight - canvasViewport.clientHeight));
  }
}

function calculateMapOrigin(map, zoom = DEFAULT_ZOOM, pan = { x: 0, y: 0 }) {
  const bounds = getOddRRectangularBounds(map, { x: 0, y: 0 });
  const halfWidth = (Math.sqrt(3) * HEX_SIZE) / 2;
  const renderLeft = bounds.left + halfWidth;
  const renderRight = bounds.right - halfWidth;
  const topSource = canvas.height / 2 + (MAP_TOP_SCREEN_PADDING - canvas.height / 2) / zoom;
  return {
    x: (canvas.width - (renderRight - renderLeft)) / 2 - renderLeft + pan.x,
    y: topSource - bounds.top + pan.y,
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
  // v1 was a demo map with authored objects and gravity bands. Retire it once
  // so refreshing starts from a genuinely blank map, while v2 preserves every
  // later map the author explicitly saves.
  localStorage.removeItem(RETIRED_DEMO_STORAGE_KEY);
  return createBlankMap();
}

const initialMap = loadMap();
syncCanvasGeometry(initialMap, DEFAULT_ZOOM);
const initialPan = { x: 0, y: 0 };
const initialOrigin = calculateMapOrigin(initialMap, DEFAULT_ZOOM, initialPan);
const state = {
  map: initialMap,
  origin: initialOrigin,
  chapter: 'chapter1',
  mode: 'edit',
  tool: 'select',
  selectedCellKey: null,
  selectedEdgeKey: null,
  selectedMapObject: null,
  connection: null,
  portalConnection: null,
  nextPortalGroupId: 1,
  dirty: false,
  dragging: null,
  painting: null,
  events: [],
  validation: [],
  actor: createTestActor(findPlayerStart(initialMap, 'chapter1', initialOrigin)),
  accumulator: 0,
  zoom: DEFAULT_ZOOM,
  objectPlacementMode: 'free',
  pan: initialPan,
  viewDrag: null,
  lastPointerClient: null,
  paletteTab: 'gravity',
  hoverPoint: null,
  animationTime: 0,
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

function updateCanvasCursor() {
  const canPan = state.mode === 'edit' && state.tool === 'select' && !state.viewDrag;
  canvas.classList.toggle('is-pan-ready', canPan);
  canvas.classList.toggle('is-panning', Boolean(state.viewDrag));
  canvas.classList.toggle('is-connecting', Boolean(state.connection));
  canvas.classList.toggle('is-portal-connecting', Boolean(state.portalConnection));
}

function updateObjectPlacementControl() {
  const enabled = ['overlay', 'object'].includes(state.tool);
  objectPlacementControl.disabled = !enabled;
  objectPlacementButtons.forEach((button) => {
    const active = button.dataset.objectPlacement === state.objectPlacementMode;
    button.setAttribute('aria-pressed', String(active));
  });
}

function setObjectPlacementMode(mode) {
  if (!['free', 'center'].includes(mode)) return;
  state.objectPlacementMode = mode;
  updateObjectPlacementControl();
  if (['overlay', 'object'].includes(state.tool)) {
    setStatus(mode === 'center' ? '水域物件將放在六邊形正中央。' : '水域物件使用 Free Snap，可放在游標位置。');
  }
  render();
}

function setPaletteTab(tab) {
  state.paletteTab = tab;
  paletteTabs.forEach((button) => {
    const active = button.dataset.paletteTab === tab;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-selected', String(active));
  });
  palettePanels.forEach((panel) => {
    panel.hidden = panel.dataset.palettePanel !== tab;
  });
}

function setTool(tool, preferredValue = null, paletteTab = null) {
  state.painting = null;
  state.connection = null;
  state.portalConnection = null;
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
  updateObjectPlacementControl();
  if (paletteTab) setPaletteTab(paletteTab);
  else if (paletteRoots[tool]) setPaletteTab(tool);
  [...toolButtons.children].forEach((button) => button.classList.toggle('is-active', button.dataset.tool === tool));
  eraserButton.classList.toggle('is-active', tool === 'erase');
  eraserButton.setAttribute('aria-pressed', String(tool === 'erase'));
  setStatus(`已選擇工具：${toolDefinitions[tool].label}`);
  updatePaletteSelection();
  updateCanvasCursor();
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
  const directPaletteTools = new Set(['terrain', 'gravity', 'waterLayer', 'overlay', 'object', 'actor', 'edge', 'erase']);
  Object.entries(toolDefinitions).filter(([key]) => !directPaletteTools.has(key)).forEach(([key, definition]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.tool = key;
    button.textContent = definition.label;
    button.addEventListener('click', () => setTool(key));
    toolButtons.append(button);
  });
}

function createPalette() {
  const paletteGroups = {
    gravity: [
      { tool: 'gravity', values: [...GRAVITY_ORDER, 'conditionalGate'] },
      { tool: 'waterLayer', values: WATER_LAYERS },
      { tool: 'terrain', values: ['blocked'] },
    ],
    overlay: [
      { tool: 'overlay', values: OVERLAY_TYPES },
      { tool: 'object', values: CELL_OBJECT_TYPES.filter((value) => !['seaweed', 'coralCluster'].includes(value)) },
    ],
    actor: [{ tool: 'actor', values: ACTOR_TYPES }],
    edge: [{ tool: 'edge', values: EDGE_TYPES.filter((value) => value !== 'none') }],
  };
  Object.entries(paletteGroups).forEach(([group, entries]) => {
    const root = paletteRoots[group];
    entries.forEach(({ tool, values }) => values.forEach((value) => {
      const card = document.createElement('article');
      card.className = `palette-item palette-${tool} palette-in-${group}`;
      const choice = document.createElement('button');
      choice.type = 'button';
      choice.className = 'palette-choice palette-face palette-front';
      choice.dataset.paletteTool = tool;
      choice.dataset.paletteValue = value;
      choice.title = '選擇此素材';
      choice.setAttribute('aria-label', `選擇${paletteLabels[value] ?? value}`);
      const visual = createPaletteVisual(tool, value);
      const label = document.createElement('span');
      label.className = 'palette-choice-label';
      label.textContent = paletteLabels[value] ?? value;
      choice.append(visual, label);
      choice.addEventListener('click', () => {
        const isSameSelection = state.tool === tool && brushValue.value === value;
        setTool(isSameSelection ? 'select' : tool, isSameSelection ? null : value, isSameSelection ? null : group);
        if (isSameSelection) setStatus('已取消素材選取；可拖曳地圖，游標移到畫布會變成抓取手勢。');
      });

      const info = document.createElement('button');
      info.type = 'button';
      info.className = 'palette-info';
      info.textContent = 'i';
      info.title = '查看素材用途';
      info.setAttribute('aria-label', `查看${paletteLabels[value] ?? value}用途`);
      info.addEventListener('click', () => card.classList.toggle('is-flipped'));

      const back = document.createElement('section');
      back.className = 'palette-back palette-face';
      const title = document.createElement('strong');
      title.textContent = paletteLabels[value] ?? value;
      const description = document.createElement('p');
      description.textContent = getPaletteDescription(tool, value);
      const close = document.createElement('button');
      close.type = 'button';
      close.className = 'palette-back-close';
      close.textContent = '返回';
      close.addEventListener('click', () => card.classList.remove('is-flipped'));
      back.append(title, description, close);
      card.append(choice, info, back);
      root.append(card);
    }));
  });
}

function createPaletteVisual(tool, value) {
  if (value === 'razor') {
    const composite = document.createElement('span');
    composite.className = 'palette-composite';
    const blade = document.createElement('img');
    blade.src = objectImagePaths.razor;
    blade.alt = '';
    const axis = document.createElement('img');
    axis.src = componentImagePaths.razorAxis;
    axis.alt = '';
    axis.className = 'palette-composite-axis';
    composite.append(blade, axis);
    return composite;
  }
  const visual = document.createElement(paletteImagePaths[value] ? 'img' : 'span');
  if (visual.tagName === 'IMG') {
    visual.src = paletteImagePaths[value];
    visual.alt = '';
  } else {
    visual.className = 'palette-swatch';
        visual.textContent = tool === 'gravity' || tool === 'waterLayer'
          ? value
          : actorSymbols[value] ?? (tool === 'edge' ? (value === 'layerPortal' ? '⇄' : value === 'multiPortal' ? '⟷' : '↔') : value === 'blocked' ? '■' : '◇');
        if (tool === 'gravity') visual.style.background = gravityColours[value];
        if (tool === 'waterLayer') {
          visual.classList.add('palette-layer-swatch');
          visual.style.background = value === 'T2' ? '#214d82' : '#315f83';
        }
  }
  return visual;
}

function getPaletteDescription(tool, value) {
  if (tool === 'gravity') {
    if (value === 'conditionalGate') return '整格水域重力 Tile：固定為 L1。關閉時由鎖鏈交叉封住且不可通行；按鈕開啟後解除鎖鏈，顯示較亮的 L1 水域，不會複製其他格子的重力。';
    return ({
      'L-1': '向上 1.0G：把角色往上推。',
      L0: '零重力：保留慣性，不產生垂直加速度。',
      L1: '向下 1.0G：標準水域重力。',
      L2: '向下 1.5G：下沉更快。',
      L3: '向下 2.0G：最強下沉水域。',
    })[value];
  }
  if (tool === 'waterLayer') {
    return value === 'T2'
      ? '水域層級整格筆刷：選取後點擊或拖曳，直接把連續六邊形改成 T2；不必逐格開 Inspector。'
      : '水域層級整格筆刷：選取後點擊或拖曳，直接把連續六邊形恢復成 T1。';
  }
  if (tool === 'terrain' && value === 'blocked') return '不可通行：角色不能進入此 Cell。選擇任一水域重力 Tile 可把這格還原為可通行水域。';
  if (tool === 'overlay' && value === 'ink') return '水域上物件：可切換 Free Snap／六邊形中央；物件自身輪廓是 hitbox，接觸時遮蔽角色周圍以外的視野。';
  if (tool === 'object' && value === 'mine') return '水域上物件：可切換 Free Snap／六邊形中央；物件自身輪廓是 hitbox，角色接觸時造成傷害。';
  if (tool === 'object' && value === 'weightStone') return '水域上物件：可切換 Free Snap／六邊形中央；物件自身輪廓是 hitbox，高速撞擊可破壞它。';
  if (tool === 'object' && value === 'oxygen') return '水域上物件：可切換 Free Snap／六邊形中央；物件自身輪廓是 hitbox，接觸即可補給。';
  if (tool === 'object' && value === 'checkpoint') return '水域上物件：可切換 Free Snap／六邊形中央；物件自身輪廓是 hitbox，接觸即可更新重生位置並恢復資源。';
  if (tool === 'object' && value === 'bubble') return '水域上物件：可切換 Free Snap／六邊形中央；物件自身輪廓是 hitbox，接觸可暫時免疫重力。';
  if (tool === 'object' && value === 'torricelli') return '水域上物件：可切換 Free Snap／六邊形中央；物件自身輪廓是 hitbox，接觸即可獲得氧氣補給。';
  if (tool === 'object' && value === 'razor') return '水域上物件：可切換 Free Snap／六邊形中央；放置後可在右側 Inspector 選 1–4 個剃刀，刀片繞中心軸旋轉並造成接觸傷害。';
  if (tool === 'object' && value === 'button') return '水域上物件：碰觸後只按下這一次，開啟右側 Inspector 指定的條件通行門。每個按鈕可以指定多個門。';
  if (tool === 'actor') return '出生點：放置該類 Actor 的起始位置。';
  if (tool === 'edge' && value === 'none') return '邊緣沾黏：清除兩格之間既有的邊緣物件。';
  if (tool === 'edge' && value === 'springJelly') return '邊緣沾黏：固定在兩格中間的六角邊；角色越過時反彈。通常放在不可通行障礙旁。';
  if (tool === 'edge' && value === 'spike') return '邊緣沾黏：固定在兩格中間的六角邊，阻擋角色通過。通常放在不可通行障礙旁。';
  if (tool === 'edge' && value === 'barrier') return '邊緣沾黏：固定在兩格中間的六角邊，阻擋角色通過。通常放在不可通行障礙旁。';
  if (tool === 'edge' && value === 'current') return '邊緣沾黏：固定在兩格中間的六角邊，依左側設定的方向與強度推動角色。';
  if (tool === 'edge' && value === 'layerPortal') return '層間轉接門：只能放在 T1 與 T2 相鄰的共享邊；玩家通過後即可進入另一個水域層。';
  if (tool === 'edge' && value === 'multiPortal') return '多邊傳送門：按住滑鼠拖過貼著黑色不可通行六角形的連續邊，可畫出一整端；再畫另一端，從右側 Inspector 開始拖曳連線，畫面只顯示一條大範圍總線，兩端仍會逐段一對一傳送。';
  if (tool === 'edge' && value === 'seaweed') return '邊緣沾黏：以底座貼在六角邊，優先朝可通行水域一側伸出。物理測試按 E 可附著或離開。';
  if (tool === 'edge' && value === 'coralCluster') return '邊緣沾黏：以底座貼在六角邊，優先朝可通行水域一側伸出。';
  return getPaletteNote(tool, value);
}

function getPaletteNote(tool, value) {
  if (tool === 'edge' && value === 'barrier') return '邏輯上是通用障礙；目前共用 edge-spike-barrier.png，沒有獨立 barrier 圖。';
  if (tool === 'edge' && value === 'current') return '潮流是程式化方向與強度工具，不使用 bitmap。';
  if (tool === 'edge' && value === 'none') return '清除 Edge 的操作，不是素材。';
  if (tool === 'edge' && value === 'multiPortal') return '多邊傳送門使用 imagegen 生成的透明 Edge 段，必須貼在黑色不可通行障礙物邊上；只有完成另一端連線後才會啟用。';
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

function getMapRenderBounds() {
  const bounds = getOddRRectangularBounds(state.map, state.origin);
  const halfWidth = (Math.sqrt(3) * HEX_SIZE) / 2;
  // Clip the completed map with one global rectangle. The same half-Cell inset
  // is applied to both sides, so no per-Cell mask or row-specific edge logic
  // can introduce asymmetric notches.
  return {
    ...bounds,
    left: bounds.left + halfWidth,
    right: bounds.right - halfWidth,
  };
}

function clipToMapSideBoundaries(bounds) {
  ctx.beginPath();
  // This is the only perimeter crop: one fixed rectangle for the whole map.
  ctx.rect(bounds.left, -canvas.height * 2, bounds.right - bounds.left, canvas.height * 5);
  ctx.clip();
}

function drawMapBackplate(bounds) {
  ctx.save();
  ctx.fillStyle = '#0f3156';
  ctx.fillRect(bounds.left, bounds.top, bounds.right - bounds.left, bounds.bottom - bounds.top);
  ctx.restore();
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

function freeObjectVisualSize(kind) {
  return getFreeObjectSetting({ kind }, 'size');
}

function drawRazor(position, size, object = null, alpha = 0.96) {
  const blade = objectImages.razor;
  const axis = componentImages.razorAxis;
  if (!blade?.complete || !blade.naturalWidth || !axis?.complete || !axis.naturalWidth) {
    drawCellAsset('razor', position.x, position.y, size);
    return;
  }
  const rotationSpeed = getFreeObjectSetting(object ?? { kind: 'razor' }, 'rotationSpeed') ?? 180;
  const count = Math.max(1, Math.min(4, Math.round(getFreeObjectSetting(object ?? { kind: 'razor' }, 'count') ?? 1)));
  const rotation = (state.animationTime * rotationSpeed * Math.PI) / 180;
  const bladeSize = size * 2;
  const axisSize = size * 0.52;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(position.x, position.y);
  for (let index = 0; index < count; index += 1) {
    ctx.save();
    ctx.rotate(rotation + (index * Math.PI * 2) / count);
    // The blade artwork places its pivot on the left, so it rotates around the axis.
    drawImageWithSilhouetteOutline(blade, -bladeSize * 0.08, -bladeSize / 2, bladeSize, bladeSize, { alpha });
    ctx.restore();
  }
  ctx.restore();
  drawImageWithSilhouetteOutline(axis, position.x - axisSize / 2, position.y - axisSize / 2, axisSize, axisSize, { alpha });
}

function drawFreeObject(object, position) {
  const size = object.size ?? getFreeObjectSetting(object, 'size');
  if (object.kind === 'razor') {
    drawRazor(position, size, object);
    return;
  }
  if (object.kind === 'button') {
    drawButton(position, size, object.pressed);
    return;
  }
  drawCellAsset(object.kind, position.x, position.y, size);
}

function drawButton(position, size, pressed = false, alpha = 0.96) {
  const radius = size * 0.42;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = 'rgba(11, 23, 38, 0.9)';
  ctx.strokeStyle = '#c7efff';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.roundRect(position.x - size * 0.5, position.y - size * 0.23, size, size * 0.46, size * 0.12);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = pressed ? '#6fd1c0' : '#f3b95f';
  ctx.beginPath();
  ctx.arc(position.x, position.y + (pressed ? size * 0.06 : -size * 0.01), radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = pressed ? '#d9fff6' : '#fff0b2';
  ctx.stroke();
  ctx.restore();
}

function getFreeObjectPosition(cell, object) {
  const center = getHexCenter(cell, state.origin);
  const offset = object.offset ?? { x: 0, y: 0 };
  return { x: center.x + offset.x, y: center.y + offset.y };
}

function drawFreeObjectOutline(kind, position, colour = '#f6e66d', alpha = 0.96, size = freeObjectVisualSize(kind)) {
  if (kind === 'razor') {
    drawRazor(position, size, null, alpha);
    ctx.save();
    ctx.strokeStyle = colour;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(position.x, position.y, size / 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    return;
  }
  if (kind === 'button') {
    drawButton(position, size, false, alpha);
    ctx.save();
    ctx.strokeStyle = colour;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(position.x, position.y, size * 0.55, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    return;
  }
  const image = objectImages[kind];
  ctx.save();
  ctx.globalAlpha = alpha;
  if (image?.complete && image.naturalWidth > 0) {
    ctx.shadowColor = colour;
    ctx.shadowBlur = 0;
    [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([x, y]) => {
      ctx.shadowOffsetX = x;
      ctx.shadowOffsetY = y;
      ctx.drawImage(image, position.x - size / 2, position.y - size / 2, size, size);
    });
    ctx.shadowColor = 'transparent';
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.globalAlpha = 0.92;
    ctx.drawImage(image, position.x - size / 2, position.y - size / 2, size, size);
  } else {
    ctx.strokeStyle = colour;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(position.x, position.y, size / 2, 0, Math.PI * 2);
    ctx.stroke();
    drawCellAsset(kind, position.x, position.y, size * 0.72);
  }
  ctx.restore();
}

function drawImageWithSilhouetteOutline(image, x, y, width, height, options = {}) {
  const colour = options.colour ?? 'rgba(247, 252, 255, 0.92)';
  const radius = options.radius ?? 0.68;
  const alpha = options.alpha ?? 0.96;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.shadowColor = colour;
  ctx.shadowBlur = 0;
  [[-radius, 0], [radius, 0], [0, -radius], [0, radius], [-radius, -radius], [radius, -radius], [-radius, radius], [radius, radius]].forEach(([offsetX, offsetY]) => {
    ctx.shadowOffsetX = offsetX;
    ctx.shadowOffsetY = offsetY;
    ctx.drawImage(image, x, y, width, height);
  });
  ctx.shadowColor = 'transparent';
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  ctx.drawImage(image, x, y, width, height);
  ctx.restore();
}

function drawPlayerDiver(position, height, options = {}) {
  const actor = options.actor ?? state.actor;
  const time = state.animationTime;
  const gameplay = options.gameplay === true;
  const animationState = options.animationState ?? (gameplay ? getPlayerAnimationState(actor) : 'swim');
  const imageKey = PLAYER_ANIMATION_IMAGE_KEYS[animationState] ?? PLAYER_ANIMATION_IMAGE_KEYS.swim;
  const image = actorImages[imageKey] ?? actorImages.playerStart;
  const motion = getPlayerAnimationMotion(animationState, time, actor);
  const anchor = gameplay ? getPlayerAnimationPosition(actor) : position;
  const width = height * ((image?.naturalWidth || 1122) / (image?.naturalHeight || 1402));
  const alpha = options.alpha ?? motion.alpha;
  ctx.save();
  ctx.translate(anchor.x, anchor.y + motion.bob);
  ctx.rotate(motion.rotation);
  ctx.scale(motion.scaleX, motion.scaleY);
  if (gameplay) {
    const pulse = 0.5 + Math.sin(time * 3.4) * 0.5;
    ctx.save();
    ctx.globalAlpha = 0.06 + pulse * 0.08;
    ctx.fillStyle = options.attached ? '#70e88e' : motion.glow;
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 8 + pulse * 6;
    ctx.beginPath();
    ctx.ellipse(0, height * 0.08, width * 0.38, height * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  if (image?.complete && image.naturalWidth > 0) {
    drawImageWithSilhouetteOutline(image, -width / 2, -height / 2, width, height, {
      alpha,
      radius: gameplay ? 0.68 : 0.5,
      colour: options.attached ? 'rgba(205, 255, 221, 0.9)' : 'rgba(246, 252, 255, 0.88)',
    });
  } else {
    // Keep a readable non-letter fallback while the generated asset loads.
    ctx.fillStyle = options.attached ? '#70e88e' : '#eafaff';
    ctx.strokeStyle = '#17334d';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(0, -height * 0.22, height * 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillRect(-width * 0.2, -height * 0.02, width * 0.4, height * 0.42);
    ctx.beginPath();
    ctx.moveTo(-width * 0.14, height * 0.4);
    ctx.lineTo(-width * 0.34, height * 0.5);
    ctx.moveTo(width * 0.14, height * 0.4);
    ctx.lineTo(width * 0.34, height * 0.5);
    ctx.stroke();
  }
  ctx.restore();

  if (!gameplay) return;
  for (let index = 0; index < (animationState === 'death' ? 1 : 3); index += 1) {
    const phase = time * (1.2 + index * 0.14) + index * 2.1;
    const bubbleX = anchor.x + Math.sin(phase) * height * (0.18 + index * 0.06);
    const bubbleY = anchor.y + motion.bob - height * (0.46 + index * 0.13) - ((time * (5 + index) + index * 7) % 7);
    ctx.save();
    ctx.globalAlpha = 0.35 - index * 0.07;
    ctx.strokeStyle = '#a6f5ff';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.arc(bubbleX, bubbleY, 1.1 + index * 0.35, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

function findNearestCell(point) {
  let nearest = null;
  Object.keys(state.map.cells).forEach((key) => {
    const cell = getActiveCell(state.map, key, state.chapter);
    const center = getHexCenter(cell, state.origin);
    const distance = Math.hypot(point.x - center.x, point.y - center.y);
    if (!nearest || distance < nearest.distance) nearest = { key, cell, center, distance };
  });
  return nearest;
}

// The dashed continuation cells are an authoring affordance, not a precision
// target.  Resolve a generous band around every visible guide hex first so a
// click/touch on a dashed edge, a vertex, or the small gap between two guides
// still chooses the nearest row and column.
function getContinuationGuideTargetAtPoint(point) {
  const width = Number(state.map.layout?.width) || 0;
  const firstRow = Number(state.map.layout?.height) || 0;
  if (!width || firstRow < 0) return null;

  const guides = [];
  for (let row = firstRow; row < firstRow + MAP_VERTICAL_BUFFER_ROWS; row += 1) {
    for (let column = 0; column < width; column += 1) {
      const cell = { q: column - Math.floor(row / 2), r: row };
      guides.push({ column, row, center: getHexCenter(cell, state.origin) });
    }
  }
  if (!guides.length) return null;

  const bounds = getMapRenderBounds();
  const minX = Math.min(...guides.map((guide) => guide.center.x));
  const maxX = Math.max(...guides.map((guide) => guide.center.x));
  const minY = Math.min(...guides.map((guide) => guide.center.y));
  const maxY = Math.max(...guides.map((guide) => guide.center.y));
  const touchPadding = 8;
  const left = Math.max(minX - HEX_SIZE - touchPadding, bounds.left - touchPadding);
  const right = Math.min(maxX + HEX_SIZE + touchPadding, bounds.right + touchPadding);
  const top = minY - HEX_SIZE - touchPadding;
  const bottom = maxY + HEX_SIZE + touchPadding;
  if (point.x < left || point.x > right || point.y < top || point.y > bottom) return null;

  return guides.reduce((nearest, guide) => {
    const distance = Math.hypot(point.x - guide.center.x, point.y - guide.center.y);
    return !nearest || distance < nearest.distance ? { ...guide, distance } : nearest;
  }, null);
}

function estimateCellGridPosition(point) {
  const row = Math.max(0, Math.floor((point.y - state.origin.y + HEX_SIZE) / MAP_ROW_STEP));
  const column = Math.round((point.x - state.origin.x) / (HEX_SIZE * Math.sqrt(3)) - row / 2);
  return { column, row, key: cellKeyFromColumn(column, row) };
}

function getOrExtendCellAtPoint(point, allowExtend = false) {
  const existing = findCellContainingPoint(state.map, point, state.chapter, state.origin);
  if (existing || !allowExtend) return existing;

  const candidate = getContinuationGuideTargetAtPoint(point) ?? estimateCellGridPosition(point);
  const width = Number(state.map.layout?.width) || 0;
  const height = Number(state.map.layout?.height) || 0;
  if (candidate.column < 0 || candidate.column >= width || candidate.row < height) return null;
  const targetRow = Math.min(candidate.row, height + MAP_VERTICAL_BUFFER_ROWS - 1);
  const targetKey = cellKeyFromColumn(candidate.column, targetRow);

  const previousOrigin = { ...state.origin };
  ensureOddRRows(state.map, targetRow);
  syncCanvasGeometry(state.map, state.zoom);
  const resizedOrigin = calculateMapOrigin(state.map, state.zoom, state.pan);
  state.pan.x += previousOrigin.x - resizedOrigin.x;
  state.pan.y += previousOrigin.y - resizedOrigin.y;
  state.origin = calculateMapOrigin(state.map, state.zoom, state.pan);
  // The target row was already resolved before the map grew. Re-running the
  // geometric hit test after resizing can snap a click near the new row's
  // boundary back to the previous row, making downward painting and Free Snap
  // placement appear to do nothing. Return the authoring target directly.
  const targetCell = getActiveCell(state.map, targetKey, state.chapter);
  return targetCell ? { key: targetKey, cell: targetCell } : null;
}

function getWaterObjectCellAtPoint(point, allowExtend = false) {
  const hit = allowExtend
    ? getOrExtendCellAtPoint(point, true)
    : findCellContainingPoint(state.map, point, state.chapter, state.origin);
  if (hit) return hit;

  // A click on a thin geometric gap between two pointy-top hexagons should
  // still resolve to the nearest existing water Cell. This keeps Free Snap
  // usable without weakening the map's width boundary.
  const nearest = findNearestCell(point);
  const bounds = getMapRenderBounds();
  const insideEditorWidth = point.x >= bounds.left - HEX_SIZE
    && point.x <= bounds.right + HEX_SIZE;
  const insideEditorHeight = point.y >= bounds.top - HEX_SIZE
    && point.y <= bounds.bottom + MAP_ROW_STEP;
  if (!nearest || !insideEditorWidth || !insideEditorHeight) return null;
  return { key: nearest.key, cell: nearest.cell };
}

function getFreeObjectPlacementPoint(point) {
  if (state.objectPlacementMode !== 'center') return point;
  const target = getWaterObjectCellAtPoint(point, false);
  return target ? getHexCenter(target.cell, state.origin) : point;
}

function getCellPreviewAtPoint(point) {
  const existing = findCellContainingPoint(state.map, point, state.chapter, state.origin);
  if (existing) return existing;
  const candidate = getContinuationGuideTargetAtPoint(point) ?? estimateCellGridPosition(point);
  const width = Number(state.map.layout?.width) || 0;
  const height = Number(state.map.layout?.height) || 0;
  if (candidate.column < 0 || candidate.column >= width || candidate.row < height) return null;
  const targetRow = Math.min(candidate.row, height + MAP_VERTICAL_BUFFER_ROWS - 1);
  return {
    key: cellKeyFromColumn(candidate.column, targetRow),
    cell: {
      q: candidate.column - Math.floor(targetRow / 2),
      r: targetRow,
      terrain: 'water',
      gravityLevel: getContinuationGuideCell(candidate.column, height - 1)?.gravityLevel ?? 'L0',
      waterLayer: getContinuationGuideCell(candidate.column, height - 1)?.waterLayer ?? 'T1',
      overlays: [],
      objects: [],
      freeObjects: [],
      actors: [],
    },
  };
}

function freeObjectAtPoint(point) {
  let closest = null;
  Object.entries(state.map.cells).forEach(([key]) => {
    const cell = getActiveCell(state.map, key, state.chapter);
    (cell.freeObjects ?? []).forEach((object, index) => {
      const position = getFreeObjectPosition(cell, object);
      const radius = getFreeObjectHitRadius(object);
      const distance = Math.hypot(point.x - position.x, point.y - position.y);
      if (distance <= radius && (!closest || distance < closest.distance)) {
        closest = { key, index, object, cell, position, distance, storage: 'free' };
      }
    });
    const center = getHexCenter(cell, state.origin);
    // Existing Cell-centred overlays and objects remain editable after the
    // switch to Free Snap. Editing an old overlay promotes it to a free item.
    cell.overlays.forEach((kind, index) => {
      const radius = getFreeObjectHitRadius({ kind });
      const distance = Math.hypot(point.x - center.x, point.y - center.y);
      if (distance <= radius && (!closest || distance < closest.distance)) {
        closest = { key, index, object: { kind }, cell, position: center, distance, storage: 'overlay' };
      }
    });
    cell.objects.forEach((object, index) => {
      const radius = getFreeObjectHitRadius(object);
      const distance = Math.hypot(point.x - center.x, point.y - center.y);
      if (distance <= radius && (!closest || distance < closest.distance)) {
        closest = { key, index, object, cell, position: center, distance, storage: 'object' };
      }
    });
  });
  return closest;
}

function drawCellSurface(cell) {
  const center = getHexCenter(cell, state.origin);
  ctx.save();
  pathHex(cell);
  ctx.clip();
  const isGate = Boolean(cell.conditionalGate);
  const isClosedGate = isGate && !cell.conditionalGate.opened;
  ctx.fillStyle = isClosedGate ? gravityColours.L1 : (cell.terrain === 'blocked' ? '#0b111b' : gravityColours[cell.gravityLevel]);
  ctx.fillRect(center.x - HEX_SIZE, center.y - HEX_SIZE, HEX_SIZE * 2, HEX_SIZE * 2);
  const tile = isClosedGate ? conditionalGateImage : (cell.terrain === 'blocked' ? terrainImages.blocked : waterTiles[cell.gravityLevel]);
  if (tile?.complete && tile.naturalWidth > 0) {
    // Bleed authored Tile rims beyond the clip. Shared same-type sides then read
    // as one continuous field rather than a hard outlined hex grid.
    const bleed = 1.12;
    ctx.drawImage(tile, center.x - HEX_SIZE * bleed, center.y - HEX_SIZE * bleed, HEX_SIZE * 2 * bleed, HEX_SIZE * 2 * bleed);
  }
  if (isGate) {
    ctx.fillStyle = isClosedGate ? 'rgba(4, 12, 28, 0.24)' : 'rgba(214, 250, 255, 0.18)';
    ctx.fillRect(center.x - HEX_SIZE, center.y - HEX_SIZE, HEX_SIZE * 2, HEX_SIZE * 2);
  }
  if (cell.waterLayer === 'T2') {
    // T2 is the same water family, only visually deeper; keep L1/L2 colour
    // identity and add a neutral low-light veil instead of a hue shift.
    ctx.fillStyle = 'rgba(3, 8, 20, 0.17)';
    ctx.fillRect(center.x - HEX_SIZE, center.y - HEX_SIZE, HEX_SIZE * 2, HEX_SIZE * 2);
  }
  if (cell.terrain === 'water') drawWaterMotion(cell, center);
  ctx.restore();
}

function drawWaterMotion(cell, center) {
  const phase = cell.q * 1.71 + cell.r * 0.93;
  const time = state.animationTime;
  const pulse = 0.5 + Math.sin(time * 0.8 + phase) * 0.5;
  const intensity = 5;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  // Short arcs rotate locally with different phases. They suggest movement
  // without introducing a readable left-to-right or top-to-bottom current.
  for (let index = 0; index < 3; index += 1) {
    const localPhase = phase + index * 2.07;
    const angle = localPhase + Math.sin(time * 0.45 + localPhase) * 0.42;
    const radius = 3.2 + index * 2.2;
    const x = center.x + Math.cos(localPhase * 0.7 + time * 0.16) * 2.2;
    const y = center.y + Math.sin(localPhase * 0.8 - time * 0.14) * 2.2;
    ctx.strokeStyle = `rgba(193, 235, 255, ${(0.035 + pulse * 0.045) * intensity})`;
    ctx.lineWidth = 0.42 * 1.7;
    ctx.beginPath();
    ctx.arc(x, y, radius, angle, angle + 0.95 + pulse * 0.18);
    ctx.stroke();
  }
  // Two tiny particles provide the readable motion cue while remaining much
  // softer than the authored Tile artwork.
  for (let index = 0; index < 2; index += 1) {
    const particlePhase = phase + index * 3.1;
    const x = center.x + Math.sin(time * (0.28 + index * 0.05) + particlePhase) * 7.4;
    const y = center.y + Math.cos(time * (0.22 + index * 0.04) + particlePhase * 1.3) * 6.2;
    ctx.fillStyle = `rgba(218, 247, 255, ${(0.08 + pulse * 0.08) * intensity})`;
    ctx.beginPath();
    ctx.arc(x, y, (0.42 + pulse * 0.18) * 1.45, 0, Math.PI * 2);
    ctx.fill();
  }
  // A slow brightness pulse makes the water feel alive even when no particle
  // happens to be near the player, without changing the Tile's gravity colour.
  ctx.fillStyle = `rgba(181, 229, 255, ${(0.012 + pulse * 0.018) * intensity})`;
  ctx.beginPath();
  ctx.arc(
    center.x + Math.cos(time * 0.22 + phase) * 4.5,
    center.y + Math.sin(time * 0.19 + phase * 1.2) * 4.5,
    4.5 + pulse * 4.5,
    0,
    Math.PI * 2,
  );
  ctx.fill();
  ctx.restore();
}

function drawContinuationGuide() {
  const width = Number(state.map.layout?.width) || 0;
  const firstRow = Number(state.map.layout?.height) || 0;
  ctx.save();
  ctx.strokeStyle = 'rgba(123, 195, 224, 0.42)';
  ctx.lineWidth = 0.7;
  ctx.setLineDash([2.5, 3.5]);
  for (let row = firstRow; row < firstRow + MAP_VERTICAL_BUFFER_ROWS; row += 1) {
    for (let column = 0; column < width; column += 1) {
      const cell = { q: column - Math.floor(row / 2), r: row };
      const template = getContinuationGuideCell(column, firstRow - 1);
      pathHex(cell);
      ctx.fillStyle = gravityColours[template?.gravityLevel ?? 'L0'] ?? gravityColours.L0;
      ctx.globalAlpha = 0.14;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.stroke();
    }
  }
  ctx.restore();
}

function getContinuationGuideCell(column, row) {
  if (row < 0) return null;
  const key = cellKeyFromColumn(column, row);
  return getActiveCell(state.map, key, state.chapter);
}

function drawCellObjects(cell) {
  const center = getHexCenter(cell, state.origin);
  cell.overlays.forEach((overlay) => drawCellAsset(overlay, center.x, center.y, HEX_SIZE * 1.8));
  cell.objects.forEach((object, index) => {
    const angle = (index / Math.max(cell.objects.length, 1)) * Math.PI * 2;
    const x = center.x + Math.cos(angle) * 4;
    const y = center.y + Math.sin(angle) * 4;
    drawCellAsset(object.kind, x, y, getFreeObjectSetting(object, 'size'));
  });
  (cell.freeObjects ?? []).forEach((object) => {
    const position = getFreeObjectPosition(cell, object);
    drawFreeObject(object, position);
  });
  cell.actors.forEach((actor, index) => {
    if (actor.kind === 'playerStart') {
      drawPlayerDiver(center, HEX_SIZE * 2.55, { alpha: 0.98 });
    } else {
      drawText(actorSymbols[actor.kind] ?? '?', center.x - 6 + index * 5, center.y + 6, { font: 'bold 7px system-ui', fill: '#ffdde4' });
    }
  });
}

function drawButtonConnectionLine(start, end, colour = '#73e3f3', active = false) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 0.5) return;
  const direction = { x: dx / distance, y: dy / distance };
  const arrowSize = active ? 6 : 5;
  const arrowBase = {
    x: end.x - direction.x * arrowSize,
    y: end.y - direction.y * arrowSize,
  };
  ctx.save();
  ctx.globalAlpha = active ? 0.95 : 0.72;
  ctx.strokeStyle = colour;
  ctx.fillStyle = colour;
  ctx.lineWidth = active ? 1.5 : 1.05;
  ctx.setLineDash(active ? [3.5, 2.5] : [4, 3]);
  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(arrowBase.x, arrowBase.y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(end.x, end.y);
  ctx.lineTo(arrowBase.x - direction.y * arrowSize * 0.55, arrowBase.y + direction.x * arrowSize * 0.55);
  ctx.lineTo(arrowBase.x + direction.y * arrowSize * 0.55, arrowBase.y - direction.x * arrowSize * 0.55);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawButtonConnections() {
  if (state.mode !== 'edit') return;
  Object.entries(state.map.cells).forEach(([key]) => {
    const cell = getActiveCell(state.map, key, state.chapter);
    if (!cell) return;
    const drawForObject = (object, index, storage) => {
      if (object.kind !== 'button') return;
      const source = { storage, key, index, cell, object };
      const sourcePosition = getMapObjectPosition(source);
      if (!sourcePosition) return;
      (object.targetGates ?? []).forEach((gateKey) => {
        const gate = getActiveCell(state.map, gateKey, state.chapter);
        if (!gate?.conditionalGate) return;
        const gateCenter = getHexCenter(gate, state.origin);
        drawButtonConnectionLine(sourcePosition, gateCenter);
        ctx.save();
        ctx.fillStyle = '#73e3f3';
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        ctx.arc(gateCenter.x, gateCenter.y, 2.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
      if (state.connection?.pointerId !== null
        && isActiveConnectionSource({ storage, key, index })
        && state.connection.targetPoint) {
        const gate = getConditionalGateAtPoint(state.connection.targetPoint);
        drawButtonConnectionLine(sourcePosition, state.connection.targetPoint, gate ? '#8dffbe' : '#ff857d', true);
      }
    };
    (cell.freeObjects ?? []).forEach((object, index) => drawForObject(object, index, 'free'));
    cell.objects.forEach((object, index) => drawForObject(object, index, 'object'));
  });
}

function drawPortalConnectionLine(start, end, active = false) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 0.5) return;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.globalAlpha = active ? 0.95 : 0.82;
  ctx.strokeStyle = active ? '#f6e66d' : '#cf8bff';
  ctx.lineWidth = active ? 2.8 : 2.4;
  ctx.setLineDash(active ? [5, 4] : []);
  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(end.x, end.y);
  ctx.stroke();
  ctx.restore();
}

function drawPortalConnections() {
  if (state.mode !== 'edit') return;
  const groups = new Set();
  Object.values(state.map.edges).forEach((edge) => {
    if (edge.type === MULTI_PORTAL_EDGE_TYPE && edge.portalGroupId) groups.add(edge.portalGroupId);
  });
  const links = [];
  groups.forEach((groupId) => {
    const entries = getPortalGroupEdges(state.map, groupId, state.chapter);
    const targetKey = entries.find((entry) => entry.edge.portalTargetKey)?.edge.portalTargetKey;
    const target = targetKey ? getActiveEdge(state.map, targetKey, state.chapter) : null;
    const targetGroupId = target?.portalGroupId;
    if (!targetGroupId || groupId > targetGroupId) return;
    const start = getPortalGroupAnchor(state.map, groupId, state.chapter, state.origin);
    const end = getPortalGroupAnchor(state.map, targetGroupId, state.chapter, state.origin);
    if (start && end) links.push({ start, end });
  });
  // Several strokes can describe one broad portal end. Collapse nearby
  // paired anchors into one visual link instead of drawing parallel arrows.
  const clusters = [];
  const clusterDistance = HEX_SIZE * 3;
  links.forEach((link) => {
    const cluster = clusters.find((candidate) => (
      Math.hypot(candidate.start.x - link.start.x, candidate.start.y - link.start.y) <= clusterDistance
      && Math.hypot(candidate.end.x - link.end.x, candidate.end.y - link.end.y) <= clusterDistance
    ));
    if (cluster) {
      cluster.links.push(link);
      cluster.start = cluster.links.reduce((sum, item) => ({
        x: sum.x + item.start.x / cluster.links.length,
        y: sum.y + item.start.y / cluster.links.length,
      }), { x: 0, y: 0 });
      cluster.end = cluster.links.reduce((sum, item) => ({
        x: sum.x + item.end.x / cluster.links.length,
        y: sum.y + item.end.y / cluster.links.length,
      }), { x: 0, y: 0 });
    } else {
      clusters.push({ links: [link], start: link.start, end: link.end });
    }
  });
  clusters.forEach(({ start, end }) => drawPortalConnectionLine(start, end));
  if (state.portalConnection?.pointerId !== null && state.portalConnection?.targetPoint) {
    const start = getPortalGroupAnchor(state.map, state.portalConnection.sourceGroupId, state.chapter, state.origin);
    if (start) drawPortalConnectionLine(start, state.portalConnection.targetPoint, true);
  }
}

const sideVertexIndexes = [
  [0, 1], // E
  [5, 0], // NE
  [4, 5], // NW
  [3, 4], // W
  [2, 3], // SW
  [1, 2], // SE
];

function drawCellSide(cell, directionIndex, style) {
  const vertices = getHexVertices(cell, state.origin);
  const [startIndex, endIndex] = sideVertexIndexes[directionIndex];
  const start = vertices[startIndex];
  const end = vertices[endIndex];
  ctx.save();
  ctx.lineWidth = style.width;
  ctx.strokeStyle = style.colour;
  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(end.x, end.y);
  ctx.stroke();
  ctx.restore();
}

function hasSameSurface(left, right) {
  if (left.terrain !== right.terrain) return false;
  return left.terrain === 'blocked'
    || (left.gravityLevel === right.gravityLevel && (left.waterLayer ?? 'T1') === (right.waterLayer ?? 'T1'));
}

function drawTerrainBoundaries() {
  const faintSharedBorder = { width: 0.5, colour: 'rgba(4, 16, 33, 0.23)' };
  const clearTransitionBorder = { width: 1.25, colour: 'rgba(2, 12, 27, 0.78)' };
  const outerBorder = { width: 1.45, colour: 'rgba(4, 17, 35, 0.92)' };
  Object.entries(state.map.cells).forEach(([key]) => {
    const cell = getActiveCell(state.map, key, state.chapter);
    DIRECTIONS.forEach((_, directionIndex) => {
      const adjacentKey = neighborKey(key, directionIndex);
      const adjacent = state.map.cells[adjacentKey] ? getActiveCell(state.map, adjacentKey, state.chapter) : null;
      if (!adjacent) {
        // The map is open-ended downward. Keep the top and side guides, but do
        // not draw a bottom cap that suggests authoring has ended.
        if (directionIndex >= 4) return;
        drawCellSide(cell, directionIndex, outerBorder);
        return;
      }
      // Each shared side is painted once; directions 0..2 are E, NE, NW.
      if (directionIndex > 2) return;
      drawCellSide(cell, directionIndex, hasSameSurface(cell, adjacent) ? faintSharedBorder : clearTransitionBorder);
    });
  });
}

function drawEdgeOccupancyWedge(cell, shared) {
  const center = getHexCenter(cell, state.origin);
  const baseColour = cell.terrain === 'water' ? gravityColours[cell.gravityLevel] : '#315573';
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(center.x, center.y);
  ctx.lineTo(shared[0].x, shared[0].y);
  ctx.lineTo(shared[1].x, shared[1].y);
  ctx.closePath();
  ctx.globalAlpha = cell.waterLayer === 'T2' ? 0.27 : 0.36;
  ctx.fillStyle = baseColour;
  ctx.fill();
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = 0.24;
  ctx.fillStyle = '#bfe9ff';
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 0.64;
  ctx.strokeStyle = '#c8edff';
  ctx.lineWidth = 0.7;
  ctx.stroke();
  ctx.restore();
}

function drawEdgeOccupancyWedges() {
  allMapEdges(state.map).forEach(({ key, a, b }) => {
    const edge = getActiveEdge(state.map, key, state.chapter);
    if (!edge || edge.type === 'none') return;
    const cellA = getActiveCell(state.map, a, state.chapter);
    const cellB = getActiveCell(state.map, b, state.chapter);
    const shared = getSharedEdgePoints({ a, b });
    if (!cellA || !cellB || !shared) return;
    const waterCells = [cellA, cellB].filter((cell) => cell.terrain === 'water');
    // Most Edge Snap objects sit beside a blocked Cell, so mark the usable
    // water-side sector. A layer portal is water-to-water and marks both sides.
    const cellsToHighlight = waterCells.length === 1 ? waterCells : [cellA, cellB];
    cellsToHighlight.forEach((cell) => drawEdgeOccupancyWedge(cell, shared));
  });
}

function drawCellAsset(kind, x, y, size) {
  const image = objectImages[kind];
  if (image?.complete && image.naturalWidth > 0) {
    drawImageWithSilhouetteOutline(image, x - size / 2, y - size / 2, size, size);
    return;
  }
  drawText(objectSymbols[kind] ?? kind[0]?.toUpperCase() ?? '?', x, y, { font: 'bold 8px system-ui', fill: '#f9e38c' });
}

function drawArrow(origin, vector, colour = '#ebff6b', size = 1) {
  const end = { x: origin.x + vector.x * 9 * size, y: origin.y + vector.y * 9 * size };
  const left = { x: end.x - vector.x * 4 * size - vector.y * 3 * size, y: end.y - vector.y * 4 * size + vector.x * 3 * size };
  const right = { x: end.x - vector.x * 4 * size + vector.y * 3 * size, y: end.y - vector.y * 4 * size - vector.x * 3 * size };
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
    const edgeAngle = Math.atan2(centerB.y - centerA.y, centerB.x - centerA.x);
    const tangentAngle = edgeAngle + Math.PI / 2;
    const edgeLength = Math.hypot(centerB.x - centerA.x, centerB.y - centerA.y);
    const edgeImage = edgeImages[edge.type];
    const size = getEdgeSetting(edge, 'size');
    const isAnchoredPlant = ['seaweed', 'coralCluster'].includes(edge.type);
    const cellA = getActiveCell(state.map, a, state.chapter);
    const cellB = getActiveCell(state.map, b, state.chapter);
    const shared = getSharedEdgePoints({ a, b });
    if (edge.type === 'layerPortal' && shared) {
      drawLayerPortal(shared, centerA, centerB, cellA, cellB, size);
      return;
    }
    const opensTowardA = cellB.terrain === 'blocked' && cellA.terrain !== 'blocked';
    const attachmentAngle = tangentAngle + (opensTowardA ? Math.PI : 0);
    const receivesHelp = state.mode === 'play' && (
      (edge.type === 'coralCluster' && isActorNearEdgeAttachment(state.actor, state.map, state.chapter, state.origin, 'coralCluster'))
      || (edge.type === 'seaweed' && state.actor.attached && Math.hypot(state.actor.x - midpoint.x, state.actor.y - midpoint.y) <= state.actor.radius + EDGE_ATTACHMENT_HELP_RADIUS)
    );
    if (edgeImage?.complete && edgeImage.naturalWidth > 0) {
      const width = edgeLength * (isAnchoredPlant ? 1.18 : 1.04) * size;
      const height = width * (edgeImage.naturalHeight / edgeImage.naturalWidth);
      drawOutlinedEdgeImage(edgeImage, midpoint, attachmentAngle, width, height, edge.type, receivesHelp);
    }
    if (edge.type === 'springJelly' && !(edgeImage?.complete && edgeImage.naturalWidth > 0)) drawText('J', midpoint.x, midpoint.y, { font: 'bold 7px system-ui' });
    if (edge.type === 'spike' && !(edgeImage?.complete && edgeImage.naturalWidth > 0)) drawText('▲', midpoint.x, midpoint.y + 1, { font: 'bold 7px system-ui', fill: '#ffb5aa' });
    if (edge.type === 'barrier' && !(edgeImage?.complete && edgeImage.naturalWidth > 0)) drawText('▌', midpoint.x, midpoint.y, { font: 'bold 9px system-ui' });
    if (edge.type === 'seaweed' && !(edgeImage?.complete && edgeImage.naturalWidth > 0)) drawText('≈', midpoint.x, midpoint.y, { font: 'bold 10px system-ui', fill: '#8ff4d4' });
    if (edge.type === 'coralCluster' && !(edgeImage?.complete && edgeImage.naturalWidth > 0)) drawText('✿', midpoint.x, midpoint.y, { font: 'bold 10px system-ui', fill: '#ffbbd5' });
    if (edge.type === MULTI_PORTAL_EDGE_TYPE && !(edgeImage?.complete && edgeImage.naturalWidth > 0)) drawText('⟷', midpoint.x, midpoint.y, { font: 'bold 9px system-ui', fill: '#d4a8ff' });
    if (edge.type === 'current') drawArrow(midpoint, getDirectionVector(edge.currentDirection), '#ebff6b', size);
  });
}

function drawLayerPortalTriangle(point, direction, radius, colour) {
  const perpendicular = { x: -direction.y, y: direction.x };
  const tip = { x: point.x + direction.x * radius, y: point.y + direction.y * radius };
  const back = { x: point.x - direction.x * radius * 0.7, y: point.y - direction.y * radius * 0.7 };
  ctx.beginPath();
  ctx.moveTo(tip.x, tip.y);
  ctx.lineTo(back.x + perpendicular.x * radius * 0.62, back.y + perpendicular.y * radius * 0.62);
  ctx.lineTo(back.x - perpendicular.x * radius * 0.62, back.y - perpendicular.y * radius * 0.62);
  ctx.closePath();
  ctx.fillStyle = colour;
  ctx.fill();
}

function drawLayerPortal(shared, centerA, centerB, cellA, cellB, size = 1) {
  const [first, second] = shared;
  const edgeVector = { x: second.x - first.x, y: second.y - first.y };
  const edgeLength = Math.hypot(edgeVector.x, edgeVector.y);
  if (!Number.isFinite(edgeLength) || edgeLength < 1) return;
  const tangent = { x: edgeVector.x / edgeLength, y: edgeVector.y / edgeLength };
  const midpoint = { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
  const t1Center = (cellA?.waterLayer ?? 'T1') === 'T1' ? centerA : centerB;
  const t2Center = (cellA?.waterLayer ?? 'T1') === 'T1' ? centerB : centerA;
  const layerVector = { x: t2Center.x - t1Center.x, y: t2Center.y - t1Center.y };
  const layerLength = Math.hypot(layerVector.x, layerVector.y) || 1;
  const layerDirection = { x: layerVector.x / layerLength, y: layerVector.y / layerLength };
  const safeSize = Math.max(0.5, Number(size) || 1);
  const halfRail = Math.max(3, Math.min(edgeLength * 0.34, edgeLength / 2 - 1));
  const railStart = { x: midpoint.x - tangent.x * halfRail, y: midpoint.y - tangent.y * halfRail };
  const railEnd = { x: midpoint.x + tangent.x * halfRail, y: midpoint.y + tangent.y * halfRail };
  const seamHalf = Math.min(4.5 * safeSize, edgeLength * 0.22);
  const t1Marker = { x: midpoint.x - layerDirection.x * seamHalf, y: midpoint.y - layerDirection.y * seamHalf };
  const t2Marker = { x: midpoint.x + layerDirection.x * seamHalf, y: midpoint.y + layerDirection.y * seamHalf };
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(4, 13, 27, 0.96)';
  ctx.lineWidth = 8 * safeSize;
  ctx.beginPath();
  ctx.moveTo(railStart.x, railStart.y);
  ctx.lineTo(railEnd.x, railEnd.y);
  ctx.stroke();
  ctx.strokeStyle = '#75d8e9';
  ctx.lineWidth = 4.6 * safeSize;
  ctx.beginPath();
  ctx.moveTo(railStart.x, railStart.y);
  ctx.lineTo(railEnd.x, railEnd.y);
  ctx.stroke();
  ctx.strokeStyle = '#f0d17b';
  ctx.lineWidth = 1.05 * safeSize;
  ctx.beginPath();
  ctx.moveTo(railStart.x, railStart.y);
  ctx.lineTo(railEnd.x, railEnd.y);
  ctx.stroke();
  ctx.strokeStyle = '#effcff';
  ctx.lineWidth = 0.9 * safeSize;
  ctx.beginPath();
  ctx.moveTo(t1Marker.x, t1Marker.y);
  ctx.lineTo(t2Marker.x, t2Marker.y);
  ctx.stroke();
  drawLayerPortalTriangle(t1Marker, layerDirection, 2.6 * safeSize, '#75e3f2');
  drawLayerPortalTriangle(t2Marker, { x: -layerDirection.x, y: -layerDirection.y }, 2.6 * safeSize, '#f5cf77');
  ctx.restore();
}

function isCellPlacementValid(cell) {
  if (!cell) return false;
  if (state.tool === 'gravity' || state.tool === 'waterLayer' || state.tool === 'terrain') return true;
  if (state.tool === 'overlay' || state.tool === 'object' || state.tool === 'actor') return cell.terrain === 'water';
  return false;
}

function isEdgePlacementValid(edgeTarget) {
  if (!edgeTarget || state.tool !== 'edge') return false;
  if (brushValue.value === 'none') return true;
  const cellA = getActiveCell(state.map, edgeTarget.a, state.chapter);
  const cellB = getActiveCell(state.map, edgeTarget.b, state.chapter);
  if (brushValue.value === 'layerPortal') {
    return cellA?.terrain === 'water'
      && cellB?.terrain === 'water'
      && (cellA.waterLayer ?? 'T1') !== (cellB.waterLayer ?? 'T1');
  }
  if (brushValue.value === MULTI_PORTAL_EDGE_TYPE) {
    return cellA?.terrain === 'blocked' || cellB?.terrain === 'blocked';
  }
  return cellA?.terrain === 'blocked' || cellB?.terrain === 'blocked';
}

function createPortalGroupId() {
  let groupId = `portal-${state.nextPortalGroupId}`;
  while (Object.values(state.map.edges).some((edge) => edge.portalGroupId === groupId)) {
    state.nextPortalGroupId += 1;
    groupId = `portal-${state.nextPortalGroupId}`;
  }
  state.nextPortalGroupId += 1;
  return groupId;
}

function paintPortalEdge(edgeTarget) {
  const groupId = state.painting?.portalGroupId ?? createPortalGroupId();
  if (state.painting && !state.painting.portalGroupId) state.painting.portalGroupId = groupId;
  const existing = getActiveEdge(state.map, edgeTarget.key, state.chapter);
  if (existing?.portalTargetKey) disconnectPortalGroup(state.map, existing.portalGroupId, state.chapter);
  const slot = state.painting?.portalSlot ?? getPortalGroupEdges(state.map, groupId, state.chapter).length;
  patchEdge(state.map, edgeTarget.a, edgeTarget.b, {
    type: MULTI_PORTAL_EDGE_TYPE,
    blocksPassage: false,
    currentDirection: 0,
    currentStrength: 0,
    ...getOfficialEdgeState(MULTI_PORTAL_EDGE_TYPE),
    portalGroupId: groupId,
    portalSlot: slot,
    portalTargetKey: null,
  }, state.chapter);
  if (state.painting) state.painting.portalSlot = slot + 1;
  if (existing?.portalTargetKey) {
    setStatus('已重新繪製傳送門段；原本的對應線已解除，請重新連接。');
  }
  return groupId;
}

function paintEdgesAlongPath(point) {
  if (!state.painting) return;
  const previous = state.painting.lastPoint ?? point;
  const distance = Math.hypot(point.x - previous.x, point.y - previous.y);
  const steps = Math.max(1, Math.ceil(distance / 6));
  let changed = false;
  for (let index = 1; index <= steps; index += 1) {
    const progress = index / steps;
    const sample = {
      x: previous.x + (point.x - previous.x) * progress,
      y: previous.y + (point.y - previous.y) * progress,
    };
    const edgeTarget = edgeAtPoint(sample);
    if (!edgeTarget || state.painting.visited.has(edgeTarget.key)) continue;
    state.painting.visited.add(edgeTarget.key);
    if (!isEdgePlacementValid(edgeTarget)) continue;
    state.selectedEdgeKey = edgeTarget.key;
    state.selectedCellKey = null;
    state.selectedMapObject = null;
    if (brushValue.value === MULTI_PORTAL_EDGE_TYPE) paintPortalEdge(edgeTarget);
    else applyEdgeTool(edgeTarget);
    changed = true;
  }
  state.painting.lastPoint = point;
  if (changed && !state.painting.statusShown) {
    state.painting.statusShown = true;
    markDirty(`拖曳繪製 Edge：已連續套用${paletteLabels[brushValue.value] ?? brushValue.value}。`);
  }
}

function isCellEraseValid(cell) {
  return Boolean(cell && (cell.overlays.length || cell.objects.length || cell.freeObjects?.length || cell.actors.length));
}

function isEdgeEraseValid(edgeTarget) {
  if (!edgeTarget) return false;
  return getActiveEdge(state.map, edgeTarget.key, state.chapter)?.type !== 'none';
}

function getSharedEdgePoints(edgeTarget) {
  const cellA = getActiveCell(state.map, edgeTarget.a, state.chapter);
  const cellB = getActiveCell(state.map, edgeTarget.b, state.chapter);
  if (!cellA || !cellB) return null;
  const verticesA = getHexVertices(cellA, state.origin);
  const verticesB = getHexVertices(cellB, state.origin);
  const shared = verticesA.filter((pointA) => verticesB.some((pointB) => Math.hypot(pointA.x - pointB.x, pointA.y - pointB.y) < 0.2));
  return shared.length === 2 ? shared : null;
}

function drawPlacementPreview() {
  if (state.mode !== 'edit' || !state.hoverPoint) return;
  if (state.tool === 'erase') {
    const objectTarget = freeObjectAtPoint(state.hoverPoint);
    if (objectTarget) {
      drawFreeObjectOutline(objectTarget.object.kind, objectTarget.position, '#f6e66d', 0.96, getFreeObjectSetting(objectTarget.object, 'size'));
      return;
    }
    const edgeTarget = edgeAtPoint(state.hoverPoint);
    const shared = edgeTarget && getSharedEdgePoints(edgeTarget);
    if (shared) {
      const valid = isEdgeEraseValid(edgeTarget);
      ctx.save();
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.strokeStyle = valid ? '#f6e66d' : '#ff6f68';
      ctx.globalAlpha = 0.95;
      ctx.beginPath();
      ctx.moveTo(shared[0].x, shared[0].y);
      ctx.lineTo(shared[1].x, shared[1].y);
      ctx.stroke();
      ctx.restore();
      return;
    }
    const hitCell = findCellContainingPoint(state.map, state.hoverPoint, state.chapter, state.origin);
    if (!hitCell) return;
    const valid = isCellEraseValid(hitCell.cell);
    pathHex(hitCell.cell);
    ctx.save();
    ctx.fillStyle = valid ? 'rgba(246, 230, 109, 0.12)' : 'rgba(255, 111, 104, 0.16)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = valid ? '#f6e66d' : '#ff6f68';
    ctx.stroke();
    ctx.restore();
    return;
  }
  if (state.tool === 'overlay' || state.tool === 'object') {
    const previewPoint = getFreeObjectPlacementPoint(state.hoverPoint);
    drawFreeObjectOutline(state.tool === 'overlay' ? brushValue.value : brushValue.value, previewPoint, '#f6e66d', 0.82);
    return;
  }
  const cellTool = ['gravity', 'waterLayer', 'terrain', 'overlay', 'object', 'actor'].includes(state.tool);
  const edgeTool = state.tool === 'edge';
  if (!cellTool && !edgeTool) return;
  const validColour = '#f6e66d';
  const invalidColour = '#ff6f68';
  if (cellTool) {
    const hitCell = getCellPreviewAtPoint(state.hoverPoint);
    if (!hitCell) return;
    const valid = isCellPlacementValid(hitCell.cell);
    pathHex(hitCell.cell);
    ctx.save();
    ctx.fillStyle = valid ? 'rgba(246, 230, 109, 0.12)' : 'rgba(255, 111, 104, 0.16)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = valid ? validColour : invalidColour;
    ctx.stroke();
    ctx.restore();
    return;
  }
  const edgeTarget = edgeAtPoint(state.hoverPoint);
  const shared = edgeTarget && getSharedEdgePoints(edgeTarget);
  if (!shared) return;
  const valid = isEdgePlacementValid(edgeTarget);
  ctx.save();
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.strokeStyle = valid ? validColour : invalidColour;
  ctx.globalAlpha = 0.95;
  ctx.beginPath();
  ctx.moveTo(shared[0].x, shared[0].y);
  ctx.lineTo(shared[1].x, shared[1].y);
  ctx.stroke();
  ctx.restore();
}

function drawOutlinedEdgeImage(image, midpoint, angle, width, height, type, receivesHelp) {
  const isAnchoredPlant = ['seaweed', 'coralCluster'].includes(type);
  const imageX = -width / 2;
  const transparentBottomPadding = { seaweed: 0.08, coralCluster: 0.123 }[type] ?? 0;
  const imageY = isAnchoredPlant ? -height + height * transparentBottomPadding : -height / 2;
  ctx.save();
  ctx.translate(midpoint.x, midpoint.y);
  ctx.rotate(angle);
  // The silhouette follows only opaque pixels, so Edge art never gets a
  // rectangular bitmap frame. Active help is slightly thicker, still white.
  drawImageWithSilhouetteOutline(image, imageX, imageY, width, height, {
    colour: 'rgba(247, 252, 255, 0.94)',
    radius: receivesHelp ? 0.9 : 0.68,
    alpha: 0.96,
  });
  ctx.restore();
}

function drawTrajectory() {
  if (!state.dragging || state.mode !== 'play' || state.actor.attached) return;
  const geometry = getLaunchGuideGeometry(state.actor, state.dragging.pointer);
  drawLaunchGuide(ctx, geometry, state.actor, state.dragging.pointer, state.animationTime);
}

function drawTestActor() {
  if (state.mode !== 'play') return;
  const actor = state.actor;
  drawPlayerDiver({ x: actor.x, y: actor.y }, actor.radius * 2.8, {
    gameplay: true,
    attached: actor.attached,
  });
}

function drawInkMask() {
  if (state.mode !== 'play' || !state.actor.inInk) return;
  ctx.save();
  ctx.fillStyle = 'rgba(2, 3, 12, 0.78)';
  ctx.beginPath();
  ctx.rect(0, 0, canvas.width, canvas.height);
  ctx.arc(state.actor.x, state.actor.y, state.actor.inkVisionRange ?? getFreeObjectSetting({ kind: 'ink' }, 'visibilityRadius'), 0, Math.PI * 2);
  ctx.fill('evenodd');
  ctx.restore();
}

function updateHudBar(element, valueElement, value, maximum, unit = '%') {
  const safeValue = Math.max(0, Math.min(maximum, value));
  const percent = (safeValue / maximum) * 100;
  element.style.setProperty('--resource-fill', `${percent}%`);
  element.setAttribute('aria-valuenow', String(Math.round(safeValue)));
  valueElement.textContent = unit === '%' ? `${Math.round(safeValue)}%` : `${Math.round(safeValue)}/${maximum}`;
}

function renderHud() {
  const actor = state.actor;
  const preview = state.mode !== 'play';
  playerHud.hidden = preview;
  playerHud.classList.toggle('is-game-over', actor.gameOver);
  hudMode.textContent = actor.gameOver ? '永久死亡：請重新開始測試' : '測試玩家';
  updateHudBar(hudHealth, hudHealthValue, actor.health, MAX_HEALTH);
  hudLives.textContent = `${'●'.repeat(actor.lives)}${'○'.repeat(actor.maxLives - actor.lives)}`;
  hudLivesValue.textContent = `${actor.lives}/${actor.maxLives}`;
  updateHudBar(hudOxygen, hudOxygenValue, actor.oxygen, MAX_OXYGEN);
  updateHudBar(hudEnergy, hudEnergyValue, actor.energy, MAX_ENERGY);
}

function getSelectedMapObject() {
  const selection = state.selectedMapObject;
  if (!selection) return null;
  const cell = getActiveCell(state.map, selection.key, state.chapter);
  if (!cell) return null;
  const objects = selection.storage === 'free' ? cell.freeObjects : cell.objects;
  const object = objects?.[selection.index];
  return object ? { ...selection, cell, object } : null;
}

function getMapObjectPosition(selection) {
  if (!selection?.cell || !selection.object) return null;
  if (selection.storage === 'free') return getFreeObjectPosition(selection.cell, selection.object);
  return getHexCenter(selection.cell, state.origin);
}

function getConnectionSource() {
  const source = state.connection?.source ?? state.selectedMapObject;
  if (!source) return null;
  const cell = getActiveCell(state.map, source.key, state.chapter);
  if (!cell) return null;
  const objects = source.storage === 'free' ? cell.freeObjects : cell.objects;
  const object = objects?.[source.index];
  if (!object || object.kind !== 'button') return null;
  return { ...source, cell, object, position: getMapObjectPosition({ ...source, cell, object }) };
}

function getConditionalGateKeys() {
  return Object.entries(state.map.cells)
    .map(([key, cell]) => ({ key, cell: getActiveCell(state.map, key, state.chapter) }))
    .filter(({ cell }) => Boolean(cell?.conditionalGate))
    .sort((left, right) => (left.cell.r - right.cell.r) || (left.cell.q - right.cell.q))
    .map(({ key }) => key);
}

function getConditionalGateLabel(key) {
  const index = getConditionalGateKeys().indexOf(key);
  return index >= 0 ? `G${index + 1}` : '無效門';
}

function getConditionalGateAtPoint(point) {
  const hit = findCellContainingPoint(state.map, point, state.chapter, state.origin);
  return hit?.cell?.conditionalGate ? hit : null;
}

function isActiveConnectionSource(selection) {
  const source = state.connection?.source;
  return Boolean(source && selection
    && source.storage === selection.storage
    && source.key === selection.key
    && source.index === selection.index);
}

function startButtonConnection() {
  const selected = getSelectedMapObject();
  if (!selected || selected.object.kind !== 'button') return;
  state.connection = {
    source: { storage: selected.storage, key: selected.key, index: selected.index },
    pointerId: null,
    targetPoint: selected.position ?? getMapObjectPosition(selected),
  };
  setStatus('請從按鈕圖示拖曳到條件通行門；放開即可建立連線。');
  updateCanvasCursor();
  render();
}

function cancelButtonConnection() {
  state.connection = null;
  state.portalConnection = null;
  updateCanvasCursor();
  setStatus('已結束按鈕連線模式。');
  render();
}

function clearButtonConnections() {
  const selected = getSelectedMapObject();
  if (!selected || selected.object.kind !== 'button') return;
  updateSelectedMapObject({ targetGates: [] });
  setStatus('已清除這個按鈕的所有門連線。');
  render();
}

function completeButtonConnection(point) {
  const source = getConnectionSource();
  const gate = getConditionalGateAtPoint(point);
  if (!source) {
    cancelButtonConnection();
    return;
  }
  if (!gate) {
    setStatus('連線未完成：請把線放在條件通行門的六邊形中央。');
    return;
  }
  const targetGates = [...new Set([...(source.object.targetGates ?? []), gate.key])];
  state.selectedMapObject = { storage: source.storage, key: source.key, index: source.index };
  updateSelectedMapObject({ targetGates });
  setStatus(`已建立 ${getConditionalGateLabel(gate.key)} 連線；可繼續拖曳到其他門。`);
}

function startPortalConnection() {
  const edge = state.selectedEdgeKey && getActiveEdge(state.map, state.selectedEdgeKey, state.chapter);
  const groupId = getPortalGroupId(edge);
  if (!groupId) return;
  state.portalConnection = {
    sourceGroupId: groupId,
    pointerId: null,
    targetPoint: getPortalGroupAnchor(state.map, groupId, state.chapter, state.origin),
  };
  setStatus('請從這一大片多邊傳送門拖曳到另一大片；放開後會按段一對一連接。');
  updateCanvasCursor();
  render();
}

function cancelPortalConnection() {
  state.portalConnection = null;
  updateCanvasCursor();
  setStatus('已結束多邊傳送門連線模式。');
  render();
}

function completePortalConnection(point) {
  if (!state.portalConnection) return;
  const edgeTarget = edgeAtPoint(point);
  const targetEdge = edgeTarget && getActiveEdge(state.map, edgeTarget.key, state.chapter);
  const targetGroupId = getPortalGroupId(targetEdge);
  if (!targetGroupId) {
    setStatus('連線未完成：請把線放在另一大片多邊傳送門的 Edge 上。');
    return;
  }
  const result = connectPortalGroups(state.map, state.portalConnection.sourceGroupId, targetGroupId, state.chapter);
  if (!result.ok) {
    setStatus(result.reason === 'countMismatch'
      ? `連線未完成：兩端必須有相同數量的 Edge（目前 ${result.firstCount} 對 ${result.secondCount}）。`
      : '連線未完成：不能把同一大片傳送門連回自己。');
    return;
  }
  state.portalConnection = null;
  markDirty(`多邊傳送門已連接：${result.count} 條 Edge 一對一對應。`);
  updateCanvasCursor();
  setStatus(`已建立多邊傳送關係：${result.count} 條 Edge 會逐段傳送。`);
}

function clearPortalConnection() {
  const edge = state.selectedEdgeKey && getActiveEdge(state.map, state.selectedEdgeKey, state.chapter);
  const groupId = getPortalGroupId(edge);
  if (!groupId) return;
  const count = disconnectPortalGroup(state.map, groupId, state.chapter);
  markDirty(`已清除這大片多邊傳送門的對應連線（${count} 條 Edge）。`);
  setStatus('已清除多邊傳送門連線；兩端仍保留，可重新配對。');
  render();
}

function selectMapObject(target) {
  if (target.storage === 'overlay') {
    const editable = getEditableCell(state.map, target.key, state.chapter);
    const kind = editable.overlays[target.index];
    const freeObjects = [
      ...(editable.freeObjects ?? []),
      { kind, offset: { x: 0, y: 0 }, ...getOfficialFreeObjectState(kind) },
    ];
    patchCell(state.map, target.key, {
      overlays: editable.overlays.filter((_, index) => index !== target.index),
      freeObjects,
    }, state.chapter);
    target = { storage: 'free', key: target.key, index: freeObjects.length - 1, object: freeObjects.at(-1) };
    markDirty(`已將既有${paletteLabels[kind] ?? kind}轉為可調整的 Free Snap 物件。`);
  }
  state.selectedMapObject = { storage: target.storage, key: target.key, index: target.index };
  state.selectedCellKey = null;
  state.selectedEdgeKey = null;
  setStatus(`已選取${paletteLabels[target.object.kind] ?? target.object.kind}；可在右側調整參數。`);
}

function updateSelectedMapObject(values = {}, reset = false) {
  const selected = getSelectedMapObject();
  if (!selected) return;
  const official = getOfficialFreeObjectState(selected.object.kind);
  const fields = getFreeObjectFields(selected.object.kind);
  const next = {
    ...selected.object,
    size: reset ? official.size : (values.size ?? getFreeObjectSetting(selected.object, 'size')),
    params: { ...(selected.object.params ?? {}) },
  };
  fields.filter((field) => field.key !== 'size').forEach((field) => {
    next.params[field.key] = reset ? official.params[field.key] : (values[field.key] ?? getFreeObjectSetting(selected.object, field.key));
  });
  if (selected.object.kind === 'button') {
    next.targetGates = reset ? [] : (values.targetGates ?? selected.object.targetGates ?? []);
    next.mode = reset ? 'once' : (values.mode ?? selected.object.mode ?? 'once');
  }
  const editable = getEditableCell(state.map, selected.key, state.chapter);
  const property = selected.storage === 'free' ? 'freeObjects' : 'objects';
  const items = editable[property].map((object, index) => index === selected.index ? next : object);
  patchCell(state.map, selected.key, { [property]: items }, state.chapter);
  markDirty(reset ? `已恢復${paletteLabels[next.kind] ?? next.kind}的官方預設。` : `已調整${paletteLabels[next.kind] ?? next.kind}參數。`);
}

function updateSelectedEdge(values = {}, reset = false) {
  const key = state.selectedEdgeKey;
  const edge = key && getActiveEdge(state.map, key, state.chapter);
  if (!edge || edge.type === 'none') return;
  const official = getOfficialEdgeState(edge.type);
  const fields = getEdgeFields(edge.type);
  const next = {
    ...edge,
    size: reset ? official.size : (values.size ?? getEdgeSetting(edge, 'size')),
    params: { ...(edge.params ?? {}) },
  };
  fields.filter((field) => field.key !== 'size').forEach((field) => {
    next.params[field.key] = reset ? official.params[field.key] : (values[field.key] ?? getEdgeSetting(edge, field.key));
  });
  const [a, b] = key.split('|');
  patchEdge(state.map, a, b, next, state.chapter);
  markDirty(reset ? `已恢復${paletteLabels[edge.type] ?? edge.type}的官方預設。` : `已調整${paletteLabels[edge.type] ?? edge.type}參數。`);
}

function setInspector(signature, build) {
  if (inspector.dataset.signature === signature) return;
  inspector.dataset.signature = signature;
  inspector.replaceChildren();
  build();
}

function appendInspectorHeader(title, note) {
  const heading = document.createElement('h3');
  heading.className = 'inspector-title';
  heading.textContent = title;
  const detail = document.createElement('p');
  detail.className = 'inspector-note';
  detail.textContent = note;
  inspector.append(heading, detail);
}

function appendInspectorField(fields, field, value, onCommit) {
  const row = document.createElement('div');
  row.className = 'inspector-field';
  const label = document.createElement('label');
  const id = `inspector-${field.key}`;
  label.htmlFor = id;
  label.textContent = field.label;
  const input = document.createElement('input');
  input.id = id;
  input.type = 'number';
  input.min = String(field.min);
  input.max = String(field.max);
  input.step = String(field.step);
  input.value = String(value);
  input.addEventListener('change', () => {
    const next = Number(input.value);
    if (Number.isFinite(next)) onCommit(next);
  });
  const official = document.createElement('span');
  official.className = 'inspector-default';
  official.textContent = `官方預設：${field.defaultValue}${field.unit ? ` ${field.unit}` : ''}`;
  row.append(label, input, official);
  fields.append(row);
}

function appendInspectorSelect(fields, field, value, onCommit) {
  const row = document.createElement('div');
  row.className = 'inspector-field';
  const label = document.createElement('label');
  const id = `inspector-${field.key}`;
  label.htmlFor = id;
  label.textContent = field.label;
  const select = document.createElement('select');
  select.id = id;
  field.options.forEach((optionValue) => {
    const option = document.createElement('option');
    option.value = optionValue;
    option.textContent = paletteLabels[optionValue] ?? optionValue;
    select.append(option);
  });
  select.value = value;
  select.addEventListener('change', () => onCommit(select.value));
  const official = document.createElement('span');
  official.className = 'inspector-default';
  official.textContent = `官方預設：${paletteLabels[field.defaultValue] ?? field.defaultValue}`;
  row.append(label, select, official);
  fields.append(row);
}

function appendInspectorText(fields, field, value, onCommit) {
  const row = document.createElement('div');
  row.className = 'inspector-field';
  const label = document.createElement('label');
  const id = `inspector-${field.key}`;
  label.htmlFor = id;
  label.textContent = field.label;
  const input = document.createElement('input');
  input.id = id;
  input.type = 'text';
  input.value = value;
  input.placeholder = field.placeholder ?? '';
  input.addEventListener('change', () => onCommit(input.value));
  const note = document.createElement('span');
  note.className = 'inspector-default';
  note.textContent = field.note ?? '';
  row.append(label, input, note);
  fields.append(row);
}

function appendResetButton(onClick) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'inspector-reset';
  button.textContent = '恢復官方預設';
  button.addEventListener('click', onClick);
  inspector.append(button);
}

function updateSelectedCell(values = {}, reset = false) {
  const key = state.selectedCellKey;
  const cell = key && getActiveCell(state.map, key, state.chapter);
  if (!cell) return;
  const nextLayer = reset ? 'T1' : (values.waterLayer ?? cell.waterLayer ?? 'T1');
  const gateType = reset ? 'noGate' : (values.gateType ?? (cell.conditionalGate ? 'buttonGate' : 'noGate'));
  const gate = gateType === 'buttonGate'
    ? { ...(cell.conditionalGate ?? {}), opened: Boolean(cell.conditionalGate?.opened) }
    : null;
  const patch = { waterLayer: nextLayer, conditionalGate: gate };
  if (gateType === 'buttonGate') {
    patch.gravityLevel = 'L1';
    if (!gate.opened) patch.terrain = 'blocked';
  }
  patchCell(state.map, key, patch, state.chapter);
  markDirty(reset
    ? `${key} 已恢復水域層級與條件通行設定官方預設。`
    : gateType === 'buttonGate'
      ? `${key} 已標記為條件通行門；按鈕可指定這個 Cell。`
      : `${key} 已切換為 ${nextLayer}。`);
}

function renderCellInspector(cell) {
  const signature = JSON.stringify({ key: state.selectedCellKey, gravity: cell.gravityLevel, waterLayer: cell.waterLayer, conditionalGate: cell.conditionalGate, chapter: state.chapter });
  setInspector(signature, () => {
    appendInspectorHeader(`${cell.conditionalGate ? '條件通行門（L1）' : (paletteLabels[cell.gravityLevel] ?? cell.gravityLevel)}・可調參數`, '條件通行門是整格水域重力 Tile，固定為 L1。關閉時鎖鏈封住且不可通行；開啟後只會變亮並恢復 L1 水域效果。');
    const fieldList = document.createElement('div');
    fieldList.className = 'inspector-fields';
    appendInspectorSelect(fieldList, { key: 'waterLayer', label: '水域層級', options: WATER_LAYERS, defaultValue: 'T1' }, cell.waterLayer ?? 'T1', (value) => updateSelectedCell({ waterLayer: value }));
    appendInspectorSelect(fieldList, { key: 'gateType', label: '通行狀態', options: ['noGate', 'buttonGate'], defaultValue: 'noGate' }, cell.conditionalGate ? 'buttonGate' : 'noGate', (value) => updateSelectedCell({ gateType: value }));
    inspector.append(fieldList);
    appendResetButton(() => updateSelectedCell({}, true));
  });
}

function renderObjectInspector(selected) {
  const object = selected.object;
  const fields = getFreeObjectFields(object.kind);
  const signature = JSON.stringify({
    selection: state.selectedMapObject,
    object,
    chapter: state.chapter,
    connection: state.connection ? { source: state.connection.source, pointerId: state.connection.pointerId } : null,
  });
  setInspector(signature, () => {
    appendInspectorHeader(`${paletteLabels[object.kind] ?? object.kind}・可調參數`, '此物件已使用官方預設建立；改動只影響這一個實例。');
    const fieldList = document.createElement('div');
    fieldList.className = 'inspector-fields';
    fields.forEach((field) => appendInspectorField(fieldList, field, getFreeObjectSetting(object, field.key), (value) => updateSelectedMapObject({ [field.key]: value })));
    if (object.kind === 'button') {
      appendInspectorSelect(fieldList, {
        key: 'mode',
        label: '按鈕模式',
        options: ['once', 'toggle'],
        defaultValue: 'once',
      }, object.mode === 'toggle' ? 'toggle' : 'once', (value) => updateSelectedMapObject({ mode: value }));
    }
    inspector.append(fieldList);
    if (object.kind === 'button') {
      const targetGates = Array.isArray(object.targetGates) ? object.targetGates : [];
      const connectionSummary = document.createElement('p');
      connectionSummary.className = 'inspector-connection-summary';
      connectionSummary.textContent = targetGates.length
        ? `已連接：${targetGates.map((key) => `${getConditionalGateLabel(key)}（${key}）`).join('、')}`
        : '已連接：尚未指定條件通行門。';
      inspector.append(connectionSummary);
      const connectButton = document.createElement('button');
      connectButton.type = 'button';
      connectButton.className = 'inspector-connect';
      connectButton.textContent = isActiveConnectionSource(selected) ? '結束拖曳連線' : '開始拖曳連線';
      connectButton.addEventListener('click', () => {
        if (isActiveConnectionSource(selected)) cancelButtonConnection();
        else startButtonConnection();
      });
      inspector.append(connectButton);
      if (targetGates.length) {
        const clearButton = document.createElement('button');
        clearButton.type = 'button';
        clearButton.className = 'inspector-reset inspector-clear-connections';
        clearButton.textContent = '清除所有門連線';
        clearButton.addEventListener('click', clearButtonConnections);
        inspector.append(clearButton);
      }
    }
    appendResetButton(() => updateSelectedMapObject({}, true));
  });
}

function renderEdgeInspector(edge) {
  const fields = getEdgeFields(edge.type);
  const signature = JSON.stringify({ key: state.selectedEdgeKey, edge, chapter: state.chapter });
  setInspector(signature, () => {
    const isMultiPortal = edge.type === MULTI_PORTAL_EDGE_TYPE;
    appendInspectorHeader(`${paletteLabels[edge.type] ?? edge.type}・可調參數`, isMultiPortal
      ? '這一條是多邊傳送門的一段；同一群組的連續 Edge 會一起形成一大片。'
      : '大小與效果值只影響這一條 Edge；可隨時回到官方預設。');
    const fieldList = document.createElement('div');
    fieldList.className = 'inspector-fields';
    fields.forEach((field) => appendInspectorField(fieldList, field, getEdgeSetting(edge, field.key), (value) => updateSelectedEdge({ [field.key]: value })));
    inspector.append(fieldList);
    if (isMultiPortal) {
      const groupEdges = getPortalGroupEdges(state.map, edge.portalGroupId, state.chapter);
      const targetEdge = edge.portalTargetKey && getActiveEdge(state.map, edge.portalTargetKey, state.chapter);
      const groupSummary = document.createElement('p');
      groupSummary.className = 'inspector-connection-summary';
      groupSummary.textContent = targetEdge
        ? `群組 ${edge.portalGroupId}：${groupEdges.length} 條 Edge，已連到 ${targetEdge.portalGroupId}。`
        : `群組 ${edge.portalGroupId}：${groupEdges.length} 條 Edge，尚未連接另一端。`;
      inspector.append(groupSummary);
      const connectButton = document.createElement('button');
      connectButton.type = 'button';
      connectButton.className = 'inspector-connect';
      connectButton.textContent = state.portalConnection ? '結束傳送門連線' : '開始拖曳連接另一端';
      connectButton.addEventListener('click', () => {
        if (state.portalConnection) cancelPortalConnection();
        else startPortalConnection();
      });
      inspector.append(connectButton);
      if (targetEdge) {
        const clearButton = document.createElement('button');
        clearButton.type = 'button';
        clearButton.className = 'inspector-reset inspector-clear-connections';
        clearButton.textContent = '清除這大片的傳送連線';
        clearButton.addEventListener('click', clearPortalConnection);
        inspector.append(clearButton);
      }
    }
    appendResetButton(() => updateSelectedEdge({}, true));
  });
}

function renderInspectorJson(value, signature) {
  setInspector(signature, () => {
    const pre = document.createElement('pre');
    pre.className = 'inspector-json';
    pre.textContent = JSON.stringify(value, null, 2);
    inspector.append(pre);
  });
}

function renderInspector() {
  const selectedObject = getSelectedMapObject();
  if (state.selectedMapObject && !selectedObject) state.selectedMapObject = null;
  if (selectedObject) {
    renderObjectInspector(selectedObject);
    return;
  }
  if (state.selectedEdgeKey) {
    const edge = getActiveEdge(state.map, state.selectedEdgeKey, state.chapter);
    if (edge?.type && edge.type !== 'none') {
      renderEdgeInspector(edge);
      return;
    }
    renderInspectorJson({ kind: 'Edge', key: state.selectedEdgeKey, chapter: state.chapter, ...edge }, `edge:${state.selectedEdgeKey}:${JSON.stringify(edge)}`);
    return;
  }
  if (state.selectedCellKey) {
    const cell = getActiveCell(state.map, state.selectedCellKey, state.chapter);
    renderCellInspector(cell);
    return;
  }
  setInspector('empty', () => { inspector.textContent = '未選取 Cell、Edge 或水域上物件。'; });
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
  const mapBounds = getMapRenderBounds();
  ctx.save();
  clipToMapSideBoundaries(mapBounds);
  drawMapBackplate(mapBounds);
  const cells = Object.entries(state.map.cells).map(([key]) => getActiveCell(state.map, key, state.chapter));
  cells.forEach((cell) => drawCellSurface(cell));
  drawContinuationGuide();
  // Paint every water surface before any object. A Free Snap object may cross
  // into a neighbouring Cell, so drawing per-Cell would let the next surface
  // cover part of the object.
  drawEdgeOccupancyWedges();
  drawButtonConnections();
  drawPortalConnections();
  cells.forEach((cell) => drawCellObjects(cell));
  drawTerrainBoundaries();
  drawEdges();
  drawPlacementPreview();
  drawTrajectory();
  drawTestActor();
  drawInkMask();
  ctx.restore();
  ctx.restore();
  renderInspector();
  renderLists();
  editorModeButton.classList.toggle('is-active', state.mode === 'edit');
  playModeButton.classList.toggle('is-active', state.mode === 'play');
  playHelp.hidden = state.mode !== 'play';
  renderHud();
}

function canvasScreenPoint(clientX, clientY, rect = canvas.getBoundingClientRect()) {
  return {
    x: (clientX - rect.left) * (canvas.width / rect.width),
    y: (clientY - rect.top) * (canvas.height / rect.height),
  };
}

function eventPoint(event) {
  const screenPoint = canvasScreenPoint(event.clientX, event.clientY);
  state.lastPointerClient = { x: event.clientX, y: event.clientY };
  return screenPointToWorldPoint(screenPoint, { x: canvas.width / 2, y: canvas.height / 2 }, state.zoom);
}

function setZoomAroundClient(nextZoom, clientPoint = state.lastPointerClient) {
  const clampedZoom = Math.min(4, Math.max(0.5, Number(nextZoom) || DEFAULT_ZOOM));
  const previousZoom = state.zoom;
  if (clampedZoom === previousZoom) return;
  const previousRect = canvas.getBoundingClientRect();
  const anchorClient = clientPoint ?? {
    x: previousRect.left + previousRect.width / 2,
    y: previousRect.top + previousRect.height / 2,
  };
  const previousScreen = canvasScreenPoint(anchorClient.x, anchorClient.y, previousRect);
  const previousWorld = screenPointToWorldPoint(
    previousScreen,
    { x: canvas.width / 2, y: canvas.height / 2 },
    previousZoom,
  );

  state.zoom = clampedZoom;
  syncCanvasGeometry(state.map, state.zoom);
  const nextRect = canvas.getBoundingClientRect();
  const nextScreen = canvasScreenPoint(anchorClient.x, anchorClient.y, nextRect);
  const nextWorld = screenPointToWorldPoint(
    nextScreen,
    { x: canvas.width / 2, y: canvas.height / 2 },
    state.zoom,
  );
  state.pan.x += nextWorld.x - previousWorld.x;
  state.pan.y += nextWorld.y - previousWorld.y;
  state.origin = calculateMapOrigin(state.map, state.zoom, state.pan);
  zoomSlider.value = String(state.zoom);
  zoomValue.textContent = `${Math.round(state.zoom * 100)}%`;
  render();
}

function edgeAtPoint(point) {
  let closest = null;
  allMapEdges(state.map).forEach(({ key, a, b }) => {
    const centerA = getHexCenter(getActiveCell(state.map, a, state.chapter), state.origin);
    const centerB = getHexCenter(getActiveCell(state.map, b, state.chapter), state.origin);
    const midpoint = { x: (centerA.x + centerB.x) / 2, y: (centerA.y + centerB.y) / 2 };
    const distance = Math.hypot(point.x - midpoint.x, point.y - midpoint.y);
    if (distance < 9 && (!closest || distance < closest.distance)) closest = { key, a, b, distance };
  });
  return closest;
}

function addOrRemove(values, value) {
  return values.includes(value) ? values.filter((candidate) => candidate !== value) : [...values, value];
}

function applyFreeObjectTool(point) {
  const nearest = getWaterObjectCellAtPoint(point, true);
  if (!nearest) {
    setStatus('請在地圖寬度內放置素材；地圖可以向下繼續延伸。');
    return;
  }
  if (nearest.cell.terrain !== 'water') {
    setStatus('水域上物件只能放在水域格。');
    return;
  }
  const value = brushValue.value;
  const editable = getEditableCell(state.map, nearest.key, state.chapter);
  const center = getHexCenter(nearest.cell, state.origin);
  const placementPoint = state.objectPlacementMode === 'center' ? center : point;
  const placedObject = {
    kind: value,
    offset: { x: placementPoint.x - center.x, y: placementPoint.y - center.y },
    ...getOfficialFreeObjectState(value),
  };
  if (value === 'button') {
    placedObject.targetGates = [];
    placedObject.mode = 'once';
  }
  const freeObjects = [...(editable.freeObjects ?? []), placedObject];
  patchCell(state.map, nearest.key, { freeObjects }, state.chapter);
  state.selectedMapObject = { storage: 'free', key: nearest.key, index: freeObjects.length - 1 };
  state.selectedCellKey = null;
  state.selectedEdgeKey = null;
  const placementLabel = state.objectPlacementMode === 'center' ? '中央放置' : '自由放置';
  markDirty(`已${placementLabel}${paletteLabels[value] ?? value}；右側 Inspector 可調整參數或回復官方預設。`);
}

function applyFreeObjectErase(target) {
  if (!target) return false;
  if (target.storage === 'object') {
    const editable = getEditableCell(state.map, target.key, state.chapter);
    patchCell(state.map, target.key, { objects: editable.objects.filter((_, index) => index !== target.index) }, state.chapter);
  } else if (target.storage === 'overlay') {
    const editable = getEditableCell(state.map, target.key, state.chapter);
    patchCell(state.map, target.key, { overlays: editable.overlays.filter((_, index) => index !== target.index) }, state.chapter);
  } else {
    const editable = getEditableCell(state.map, target.key, state.chapter);
    patchCell(state.map, target.key, { freeObjects: editable.freeObjects.filter((_, index) => index !== target.index) }, state.chapter);
  }
  state.selectedCellKey = target.key;
  state.selectedEdgeKey = null;
  state.selectedMapObject = null;
  markDirty(`已清除${paletteLabels[target.object.kind] ?? target.object.kind}。`);
  return true;
}

function applyCellTool(key) {
  const cell = getActiveCell(state.map, key, state.chapter);
  const value = brushValue.value;
  state.selectedCellKey = key;
  state.selectedEdgeKey = null;
  state.selectedMapObject = null;
  if (state.tool === 'select') {
    setStatus(`已選取 Cell ${key}`);
    return;
  }
  if (state.tool === 'erase' && !isCellEraseValid(cell)) {
    setStatus('這個六角形沒有可清除的素材。');
    return;
  }
  if (['overlay', 'object', 'actor'].includes(state.tool) && !isCellPlacementValid(cell)) {
    setStatus('這類素材只能放在可通行水域格。');
    return;
  }
  if (state.tool === 'terrain') patchCell(state.map, key, { terrain: value }, state.chapter);
  if (state.tool === 'gravity') {
    patchCell(state.map, key, value === 'conditionalGate'
      ? { terrain: 'blocked', gravityLevel: 'L1', conditionalGate: { opened: false } }
      : { terrain: 'water', gravityLevel: value, conditionalGate: null }, state.chapter);
  }
  if (state.tool === 'waterLayer') patchCell(state.map, key, { waterLayer: value }, state.chapter);
  if ((state.tool === 'overlay' || state.tool === 'object') && cell.terrain !== 'water') {
    setStatus('水域上物件現在是自由放置，不會吸附到這個六角格。');
    return;
  }
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
  if (state.tool === 'erase') patchCell(state.map, key, { overlays: [], objects: [], freeObjects: [], actors: [] }, state.chapter);
  markDirty(`${key} 已套用 ${toolDefinitions[state.tool].label}${value ? `：${value}` : ''}。`);
}

function isCellPaintTool() {
  return state.mode === 'edit' && ['gravity', 'waterLayer', 'terrain'].includes(state.tool);
}

function paintCell(key) {
  if (!state.painting || state.painting.visited.has(key)) return false;
  const cell = getActiveCell(state.map, key, state.chapter);
  if (!cell) return false;
  state.painting.visited.add(key);
  state.selectedCellKey = key;
  state.selectedEdgeKey = null;
  state.selectedMapObject = null;
  if (state.tool === 'gravity') {
    patchCell(state.map, key, brushValue.value === 'conditionalGate'
      ? { terrain: 'blocked', gravityLevel: 'L1', conditionalGate: { opened: false } }
      : { terrain: 'water', gravityLevel: brushValue.value, conditionalGate: null }, state.chapter);
  }
  if (state.tool === 'waterLayer') patchCell(state.map, key, { waterLayer: brushValue.value }, state.chapter);
  if (state.tool === 'terrain') patchCell(state.map, key, { terrain: brushValue.value }, state.chapter);
  return true;
}

function paintCellsAlongPath(point) {
  if (!state.painting) return;
  const previous = state.painting.lastPoint ?? point;
  const distance = Math.hypot(point.x - previous.x, point.y - previous.y);
  const steps = Math.max(1, Math.ceil(distance / 6));
  let changed = false;
  for (let index = 1; index <= steps; index += 1) {
    const progress = index / steps;
    const sample = {
      x: previous.x + (point.x - previous.x) * progress,
      y: previous.y + (point.y - previous.y) * progress,
    };
    const hitCell = getOrExtendCellAtPoint(sample, true);
    if (hitCell) changed = paintCell(hitCell.key) || changed;
  }
  state.painting.lastPoint = point;
  if (changed && !state.painting.statusShown) {
    state.painting.statusShown = true;
    markDirty(`拖曳塗色：已連續套用${toolDefinitions[state.tool].label}「${brushValue.value}」。`);
  }
}

function applyEdgeTool(edgeTarget) {
  state.selectedEdgeKey = edgeTarget.key;
  state.selectedCellKey = null;
  state.selectedMapObject = null;
  const value = brushValue.value;
  if (state.tool === 'select') {
    setStatus(`已選取 Edge ${edgeTarget.key}`);
    return;
  }
  if (state.tool === 'erase' && !isEdgeEraseValid(edgeTarget)) {
    setStatus('這條六角邊沒有可清除的 Edge。');
    return;
  }
  if (state.tool === 'edge') {
    if (!isEdgePlacementValid(edgeTarget)) {
      setStatus(value === 'layerPortal'
        ? '層間轉接門只能放在 T1 與 T2 相鄰的共享六角邊。'
        : '邊緣沾黏素材只能放在至少一側是不可通行障礙的六角邊。');
      return;
    }
    if (value === MULTI_PORTAL_EDGE_TYPE) {
      paintPortalEdge(edgeTarget);
      markDirty(`${edgeTarget.key} 已加入多邊傳送門；完成另一端後可在 Inspector 拖曳連接。`);
      return;
    }
    const isBlocking = ['springJelly', 'spike', 'barrier'].includes(value);
    patchEdge(state.map, edgeTarget.a, edgeTarget.b, {
      type: value,
      blocksPassage: isBlocking,
      currentDirection: Number(currentDirection.value),
      currentStrength: value === 'current' ? Number(currentStrength.value) : 0,
      ...getOfficialEdgeState(value),
    }, state.chapter);
  }
  if (state.tool === 'erase') patchEdge(state.map, edgeTarget.a, edgeTarget.b, { type: 'none', blocksPassage: false, currentStrength: 0 }, state.chapter);
  markDirty(`${edgeTarget.key} 已套用 Edge 設定。`);
}

function applySelectAtPoint(point) {
  const objectTarget = freeObjectAtPoint(point);
  if (objectTarget) {
    selectMapObject(objectTarget);
    return;
  }
  const hitEdge = edgeAtPoint(point);
  if (hitEdge) {
    applyEdgeTool(hitEdge);
    return;
  }
  const hitCell = getOrExtendCellAtPoint(point, false);
  if (hitCell) applyCellTool(hitCell.key);
}

function recordEvents(events) {
  if (!events.length) return;
  state.events = [...events, ...state.events].slice(0, 8);
  if (events.some((event) => event.type === 'weightStone')) state.dirty = true;
}

function stepGame() {
  if (state.mode !== 'play' || state.actor.gameOver) return;
  if (state.dragging) {
    drainAimEnergy(state.actor, FIXED_STEP);
    if (state.actor.energy <= 0) {
      state.dragging = null;
      recordEvents([{ type: 'aim', message: '能量耗盡：已取消瞄準，靜止後可恢復能量。' }]);
    }
  }
  const events = stepPhysics({ map: state.map, chapter: state.chapter, actor: state.actor, origin: state.origin, bounds: WORLD_BOUNDS, time: state.animationTime });
  if (state.actor.health <= 0 || state.actor.oxygen <= 0) {
    const cause = state.actor.health <= 0 ? '生命歸零' : '氧氣歸零';
    const death = registerPlayerDeath(state.actor, cause);
    if (death.gameOver) {
      recordEvents([{ type: 'gameOver', message: `${cause}：最後一條命已失去，永久死亡；請重新開始物理測試。` }]);
    } else {
      respawnActor(state.actor, state.actor.spawn);
      recordEvents([{ type: 'respawn', message: `${cause}：失去 1 條命，剩餘 ${death.livesRemaining} 條命，已回到最近 Checkpoint。` }]);
    }
  }
  recordEvents(events);
}

function animationFrame(now) {
  const elapsed = Math.min((now - (animationFrame.last ?? now)) / 1000, 0.1);
  animationFrame.last = now;
  state.animationTime += elapsed;
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
  state.hoverPoint = point;
  if (state.mode === 'play') {
    if (!state.actor.attached && Math.hypot(point.x - state.actor.x, point.y - state.actor.y) < 52) {
      state.dragging = { pointer: point };
      canvas.setPointerCapture(event.pointerId);
    }
    return;
  }
  if (state.portalConnection) {
    const sourceTarget = edgeAtPoint(point);
    const sourceEdge = sourceTarget && getActiveEdge(state.map, sourceTarget.key, state.chapter);
    if (getPortalGroupId(sourceEdge) !== state.portalConnection.sourceGroupId) {
      setStatus('請從已選取的多邊傳送門群組任一段開始拖曳連線。');
      return;
    }
    state.portalConnection.pointerId = event.pointerId;
    state.portalConnection.targetPoint = point;
    canvas.setPointerCapture(event.pointerId);
    render();
    return;
  }
  if (state.connection) {
    const source = getConnectionSource();
    const sourceDistance = source?.position ? Math.hypot(point.x - source.position.x, point.y - source.position.y) : Infinity;
    if (!source || sourceDistance > getFreeObjectHitRadius(source.object) + 5) {
      setStatus('請從已選取的按鈕圖示開始拖曳連線。');
      return;
    }
    state.connection.pointerId = event.pointerId;
    state.connection.targetPoint = point;
    canvas.setPointerCapture(event.pointerId);
    render();
    return;
  }
  if (state.tool === 'select') {
    // Selection is also the default state after cancelling a palette card.
    // Touching the dashed continuation band must still grow the map instead
    // of silently starting a pan gesture.
    if (getContinuationGuideTargetAtPoint(point)) {
      const previousHeight = Number(state.map.layout?.height) || 0;
      const hitCell = getOrExtendCellAtPoint(point, true);
      if (hitCell && Number(state.map.layout?.height) > previousHeight) {
        state.selectedCellKey = hitCell.key;
        state.selectedEdgeKey = null;
        state.selectedMapObject = null;
        markDirty(`已從虛線框向下擴充地圖至 ${state.map.layout.height} 列。`);
        render();
        return;
      }
    }
    state.viewDrag = { pointerId: event.pointerId, startPoint: point, lastPoint: point, moved: false };
    canvas.setPointerCapture(event.pointerId);
    updateCanvasCursor();
    return;
  }
  if (isCellPaintTool()) {
    state.painting = { pointerId: event.pointerId, lastPoint: point, visited: new Set(), statusShown: false };
    canvas.setPointerCapture(event.pointerId);
    paintCellsAlongPath(point);
    render();
    return;
  }
  if (state.tool === 'edge') {
    state.painting = {
      pointerId: event.pointerId,
      lastPoint: point,
      visited: new Set(),
      statusShown: false,
      portalGroupId: brushValue.value === MULTI_PORTAL_EDGE_TYPE ? createPortalGroupId() : null,
      portalSlot: 0,
    };
    canvas.setPointerCapture(event.pointerId);
    paintEdgesAlongPath(point);
    render();
    return;
  }
  if (state.tool === 'overlay' || state.tool === 'object') {
    applyFreeObjectTool(point);
    render();
    return;
  }
  if (state.tool === 'erase') {
    const objectTarget = freeObjectAtPoint(point);
    if (objectTarget) {
      applyFreeObjectErase(objectTarget);
      render();
      return;
    }
  }
  const hitEdge = edgeAtPoint(point);
  if ((state.tool === 'edge' || state.tool === 'erase') && hitEdge) {
    applyEdgeTool(hitEdge);
    render();
    return;
  }
  const canExtendDownward = ['gravity', 'waterLayer', 'terrain', 'actor'].includes(state.tool);
  const hitCell = getOrExtendCellAtPoint(point, canExtendDownward);
  if (hitCell) applyCellTool(hitCell.key);
  render();
});

canvas.addEventListener('pointermove', (event) => {
  const point = eventPoint(event);
  state.hoverPoint = point;
  if (state.dragging) state.dragging.pointer = point;
  if (state.portalConnection?.pointerId === event.pointerId) {
    state.portalConnection.targetPoint = point;
    render();
    return;
  }
  if (state.connection?.pointerId === event.pointerId) {
    state.connection.targetPoint = point;
    render();
    return;
  }
  if (state.viewDrag?.pointerId === event.pointerId) {
    const drag = state.viewDrag;
    const delta = { x: point.x - drag.lastPoint.x, y: point.y - drag.lastPoint.y };
    if (!drag.moved && Math.hypot(point.x - drag.startPoint.x, point.y - drag.startPoint.y) > 1.5) drag.moved = true;
    if (drag.moved) {
      state.pan.x += delta.x;
      state.pan.y += delta.y;
      state.origin = calculateMapOrigin(state.map, state.zoom, state.pan);
    }
    drag.lastPoint = point;
    updateCanvasCursor();
    render();
    return;
  }
  if (state.painting?.pointerId === event.pointerId) {
    if (state.tool === 'edge') paintEdgesAlongPath(point);
    else paintCellsAlongPath(point);
  }
  if (state.mode === 'edit') render();
});

canvas.addEventListener('pointerleave', () => {
  state.hoverPoint = null;
  if (state.mode === 'edit') render();
});

canvas.addEventListener('pointerup', (event) => {
  if (state.portalConnection?.pointerId === event.pointerId) {
    const pointer = eventPoint(event);
    completePortalConnection(pointer);
    if (state.portalConnection) {
      state.portalConnection.pointerId = null;
      state.portalConnection.targetPoint = getPortalGroupAnchor(state.map, state.portalConnection.sourceGroupId, state.chapter, state.origin);
    }
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    updateCanvasCursor();
    render();
    return;
  }
  if (state.connection?.pointerId === event.pointerId) {
    const pointer = eventPoint(event);
    completeButtonConnection(pointer);
    if (state.connection) {
      state.connection.pointerId = null;
      state.connection.targetPoint = getConnectionSource()?.position ?? pointer;
    }
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    updateCanvasCursor();
    render();
    return;
  }
  if (state.viewDrag?.pointerId === event.pointerId) {
    const drag = state.viewDrag;
    state.viewDrag = null;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    updateCanvasCursor();
    if (!drag.moved) applySelectAtPoint(eventPoint(event));
    render();
    return;
  }
  if (state.painting?.pointerId === event.pointerId) {
    state.painting = null;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    render();
    return;
  }
  if (!state.dragging) {
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    return;
  }
  const pointer = eventPoint(event);
  const launch = launchActor(state.actor, pointer);
  if (launch.launched) {
    recordEvents([{ type: 'launch', message: `彈射初速度：${Math.round(launch.speed)} px/s；氧氣 -${Math.ceil(launch.costs.oxygen)}，能量 -${Math.ceil(launch.costs.energy)}。` }]);
  } else if (launch.reason === 'oxygen' || launch.reason === 'energy') {
    const label = launch.reason === 'oxygen' ? '氧氣' : '能量';
    recordEvents([{ type: 'launchBlocked', message: `${label}不足：無法彈射，請補給或原地休息。` }]);
  }
  state.dragging = null;
  if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
});

canvas.addEventListener('pointercancel', (event) => {
  if (state.portalConnection?.pointerId === event.pointerId) {
    state.portalConnection.pointerId = null;
    state.portalConnection.targetPoint = getPortalGroupAnchor(state.map, state.portalConnection.sourceGroupId, state.chapter, state.origin);
  }
  if (state.connection?.pointerId === event.pointerId) {
    state.connection.pointerId = null;
    state.connection.targetPoint = getConnectionSource()?.position ?? null;
  }
  if (state.painting?.pointerId === event.pointerId) state.painting = null;
  if (state.dragging) state.dragging = null;
  if (state.viewDrag?.pointerId === event.pointerId) state.viewDrag = null;
  if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  updateCanvasCursor();
});

function setMode(mode) {
  state.mode = mode;
  state.dragging = null;
  state.painting = null;
  state.viewDrag = null;
  state.connection = null;
  state.portalConnection = null;
  state.accumulator = 0;
  updateCanvasCursor();
  if (mode === 'play') {
    startTestRun(state.actor, state.map, state.chapter, state.origin);
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
  state.map = createBlankMap();
  state.pan = { x: 0, y: 0 };
  state.zoom = DEFAULT_ZOOM;
  syncCanvasGeometry(state.map, state.zoom);
  state.origin = calculateMapOrigin(state.map, state.zoom, state.pan);
  zoomSlider.value = String(state.zoom);
  zoomValue.textContent = `${Math.round(state.zoom * 100)}%`;
  state.chapter = 'chapter1';
  chapterSelect.value = state.chapter;
  state.selectedCellKey = null;
  state.selectedEdgeKey = null;
  state.selectedMapObject = null;
  state.connection = null;
  state.portalConnection = null;
  markDirty('已重設為空白 24×17 地圖：全水域為 L0，沒有物件、Actor 或 Edge。');
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
    state.pan = { x: 0, y: 0 };
    syncCanvasGeometry(state.map, state.zoom);
    state.origin = calculateMapOrigin(state.map, state.zoom, state.pan);
    state.selectedCellKey = null;
    state.selectedEdgeKey = null;
    state.selectedMapObject = null;
    state.connection = null;
    state.portalConnection = null;
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
  setZoomAroundClient(Number(zoomSlider.value));
});

canvas.addEventListener('wheel', (event) => {
  if (state.mode !== 'edit') return;
  event.preventDefault();
  state.lastPointerClient = { x: event.clientX, y: event.clientY };
  const direction = event.deltaY < 0 ? 0.1 : -0.1;
  setZoomAroundClient(Math.round((state.zoom + direction) * 10) / 10, state.lastPointerClient);
}, { passive: false });

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
    const launch = launchActor(state.actor, { x: state.actor.x, y: state.actor.y + 115 });
    if (launch.launched) recordEvents([{ type: 'launch', message: `快速向上彈射：${Math.round(launch.speed)} px/s；氧氣與能量已扣除。` }]);
    else if (launch.reason === 'oxygen' || launch.reason === 'energy') {
      const label = launch.reason === 'oxygen' ? '氧氣' : '能量';
      recordEvents([{ type: 'launchBlocked', message: `${label}不足：無法快速彈射。` }]);
    }
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
      cell: actorCell, health: formatNumber(state.actor.health), healthMax: MAX_HEALTH,
      oxygen: formatNumber(state.actor.oxygen), oxygenMax: MAX_OXYGEN,
      energy: formatNumber(state.actor.energy), attached: state.actor.attached,
      lives: state.actor.lives, maxLives: state.actor.maxLives, gameOver: state.actor.gameOver,
      animation: getPlayerAnimationState(state.actor),
      gravityImmuneFor: formatNumber(state.actor.gravityImmunity),
    },
    map: { cells: Object.keys(state.map.cells).length, configuredEdges, dirty: state.dirty },
    viewport: {
      zoom: state.zoom,
      pan: { x: formatNumber(state.pan.x), y: formatNumber(state.pan.y) },
      canPan: state.mode === 'edit' && state.tool === 'select',
      objectPlacementMode: state.objectPlacementMode,
      scrollTop: Math.round(canvasViewport?.scrollTop ?? 0),
      scrollHeight: Math.round(canvasViewport?.scrollHeight ?? canvas.height),
    },
  });
};

window.advanceTime = (milliseconds) => {
  const steps = Math.max(1, Math.round(milliseconds / (FIXED_STEP * 1000)));
  for (let index = 0; index < steps; index += 1) {
    state.animationTime += FIXED_STEP;
    stepGame();
  }
  render();
  return window.render_game_to_text();
};

brushValue.addEventListener('change', updatePaletteSelection);
objectPlacementButtons.forEach((button) => button.addEventListener('click', () => setObjectPlacementMode(button.dataset.objectPlacement)));
paletteTabs.forEach((button) => button.addEventListener('click', () => setPaletteTab(button.dataset.paletteTab)));
eraserButton.addEventListener('click', () => setTool(state.tool === 'erase' ? 'select' : 'erase'));
createToolButtons();
createPalette();
setPaletteTab('gravity');
setTool('select');
state.validation = validateMap(state.map);
dirtyIndicator.textContent = '編輯器已就緒；新地圖從空白 L0 水域開始，儲存後刷新會保留本機版本。';
requestAnimationFrame(animationFrame);
