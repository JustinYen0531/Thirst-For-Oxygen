import {
  allMapEdges,
  getActiveCell,
  getActiveEdge,
  getHexCenter,
  getHexVertices,
  getOddRRectangularBounds,
  getEdgeBetween,
  HEX_SIZE,
} from './map-model.js';
import {
  FIXED_STEP,
  MAX_ENERGY,
  MAX_HEALTH,
  MAX_OXYGEN,
  OXYGEN_DURATION_SECONDS,
  applyDamage,
  createTestActor,
  findPlayerStart,
  launchActor,
  registerPlayerDeath,
  respawnActor,
  stepPhysics,
} from './physics.js';
import { drawLaunchGuide, getLaunchGuideGeometry } from './launch-guide.js';
import { getEdgeAttachmentGeometry } from './edge-attachment.js';
import {
  PLAYER_ANIMATION_ASSETS,
  getPlayerAnimationFrameIndex,
  getPlayerFacingDirection,
  getPlayerAnimationMotion,
  getPlayerAnimationPosition,
  getPlayerAnimationState,
  getPlayerSpriteScaleX,
} from './player-animation.js';
import { attachMusicControls, createMusicController, getMusicTrack } from './music.js';
import { attachSfxVolumeControl, createSfxController } from './sfx.js';
import {
  createPlayKatanaState,
  markPlayKatanaMovement,
  resolvePlayKatanaSlash,
  stepPlayKatana,
} from './play-katana.js';
import { KATANA_SPRITE, getKatanaSwingFrames, getKatanaWavePose } from './katana-visual.js';
import { getEnergyHud, getHealthHud, getOxygenHud, getPlayerHudSlots } from './visor-hud.js';
import {
  PLAY_ENEMY_VISUALS,
  createPlayEnemies,
  getPlayEnemyPose,
  isPlayEnemyVisible,
  updatePlayEnemies,
} from './play-enemies.js';
import {
  CONDITIONAL_GATE_GUIDE,
  acknowledgeDiscoveryGuide,
  createDiscoverySession,
  getEdgeDiscoveryGuide,
  getEnemyDiscoveryGuide,
  getObjectDiscoveryGuide,
  updateDiscoverySession,
} from './visor-discovery.js';
import { drawDiscoveryGuides, hitTestDiscoveryAcknowledgement } from './visor-discovery-renderer.js';

const MAPS = {
  1: { path: '/maps/下沉篇/下沉篇-第1部分.json', label: '下沉篇・第一部分（輕）' },
  2: { path: '/maps/下沉篇/下沉篇-第2部分.json', label: '下沉篇・第二部分（中）' },
  3: { path: '/maps/下沉篇/下沉篇-第3部分.json', label: '下沉篇・第三部分' },
};
// A 4x world scale intentionally shows only about 60% of the reference map's
// horizontal span, leaving room for the camera to keep the player readable.
const SCALE = 4;
const TILE_SIZE = 24;
const PLAYER_ASSET = PLAYER_ANIMATION_ASSETS.swim[0];
const TILE_ASSETS = {
  'L-1': '/assets/editor/water/L-1.png', L0: '/assets/editor/water/L0.png', L1: '/assets/editor/water/L1.png', L2: '/assets/editor/water/L2.png', L3: '/assets/editor/water/L3.png',
  blocked: '/assets/editor/terrain/blocked-dark-stone.png',
};
const OBJECT_ASSETS = {
  coralCluster: '/assets/editor/objects/coral-cluster.png', mine: '/assets/editor/objects/deep-sea-mine.png', weightStone: '/assets/editor/objects/heavy-stone.png', seaweed: '/assets/editor/objects/sea-grass.png', oxygen: '/assets/editor/objects/oxygen-ore.png', checkpoint: '/assets/editor/objects/checkpoint.png', bubble: '/assets/editor/objects/photosynthesis-bubble.png', torricelli: '/assets/editor/objects/torricelli-space.png', razor: '/assets/editor/objects/razor-blade.png', button: '/assets/editor/objects/button.png',
};
const EDGE_ASSETS = { springJelly: '/assets/editor/edges/spring-jellyfish.png', spike: '/assets/editor/edges/edge-spike-barrier.png', barrier: '/assets/editor/edges/edge-spike-barrier.png', current: '/assets/editor/edges/edge-spike-barrier.png', layerPortal: '/assets/editor/edges/layer-portal-stair.png', multiPortal: '/assets/editor/edges/multi-portal.png', seaweed: OBJECT_ASSETS.seaweed, coralCluster: OBJECT_ASSETS.coralCluster };
const PLAYER_ASSETS = { ...PLAYER_ANIMATION_ASSETS };
const WEAPON_ASSETS = [KATANA_SPRITE];
const objectGlyphs = { mine: '✹', weightStone: '●', oxygen: 'O₂', checkpoint: '◎', bubble: '○', torricelli: 'T', razor: '╱', button: 'B' };
const edgeColors = { springJelly: '#e77dff', spike: '#ff8394', barrier: '#ff9e78', current: '#6fe5ff', layerPortal: '#f4d56d', multiPortal: '#8cc7ff', seaweed: '#76e49c', coralCluster: '#f1a0ff' };

const canvas = document.querySelector('#play-canvas');
const context = canvas.getContext('2d');
const mapSelect = document.querySelector('#play-map-select');
const musicArcSelect = document.querySelector('#play-music-arc');
const musicModeSelect = document.querySelector('#play-music-mode');
const musicController = createMusicController(getMusicTrack({ part: 3, arc: 'descent', mode: 'normal' }));
attachMusicControls(document.querySelector('#play-music-control'), musicController);
const sfxController = createSfxController();
attachSfxVolumeControl(document.querySelector('[aria-labelledby="music-settings-title"]'), sfxController);
const resetButton = document.querySelector('#play-reset');
const pauseButton = document.querySelector('#play-pause');
const loadingMask = document.querySelector('#play-loading');
const depthReadout = document.querySelector('#play-depth-value');
const levelReadout = document.querySelector('#play-level-value');
const experienceReadout = document.querySelector('#play-experience-value');
const experienceFill = document.querySelector('#play-experience-fill');
const mapTitle = document.querySelector('#play-map-title');
const cameraReadout = document.querySelector('#play-camera-readout');
const speedReadout = document.querySelector('#play-speed');
const eventsList = document.querySelector('#play-events');
const unlimitedResourcesButton = document.querySelector('#play-unlimited-resources');
const ambientToggle = document.querySelector('#play-ambient-toggle');
const attemptsReadout = document.querySelector('#play-attempts');
const settingsToggle = document.querySelector('#play-settings-toggle');
const settingsPanel = document.querySelector('#play-settings');
const settingsClose = document.querySelector('#play-settings-close');
const exitButton = document.querySelector('#play-exit');
const resourceBars = { health: document.querySelector('#play-health'), oxygen: document.querySelector('#play-oxygen'), energy: document.querySelector('#play-energy') };
const resourceValues = { health: document.querySelector('#play-health-value'), oxygen: document.querySelector('#play-oxygen-value'), energy: document.querySelector('#play-energy-value') };
const oxygenFill = resourceBars.oxygen.querySelector('[data-oxygen-fill]');
const energySegments = [...resourceBars.energy.querySelectorAll('[data-energy-segment]')];
const healthSegments = [...resourceBars.health.querySelectorAll('[data-health-segment]')];
const healthPointer = resourceBars.health.querySelector('.health-pointer');
const visorSlots = [...document.querySelectorAll('[data-visor-slot]')];
const images = new Map();
[...Object.values(PLAYER_ASSETS).flat(), ...Object.values(TILE_ASSETS), ...Object.values(OBJECT_ASSETS), ...Object.values(EDGE_ASSETS), ...Object.values(PLAY_ENEMY_VISUALS), ...WEAPON_ASSETS].filter(Boolean).forEach((path) => { if (images.has(path)) return; const image = new Image(); image.src = path; images.set(path, image); });

let map = null;
let mapPart = 3;
let origin = { x: 40, y: 40 };
let mapBounds = null;
let physicsBounds = null;
let actor = null;
let spawn = null;
let enemies = [];
let worldTime = 0;
let camera = { x: 0, y: 0, edgeX: '中段', edgeY: '中段' };
let dragging = false;
let aimPoint = null;
let trajectory = [];
let lastTrajectoryAt = -Infinity;
let paused = false;
let unlimitedResources = false;
let ambientEnabled = true;
let lastFrame = performance.now();
let accumulator = 0;
let eventLog = ['拖曳潛水夫，放開即可彈射。'];
let activeCollisionSoundKeys = new Set();
const discoverySession = createDiscoverySession();
let discoveryAcknowledgementTargets = [];
const PLAYER_LEVEL = 1;
const PLAYER_EXPERIENCE = 0;
const EXPERIENCE_TO_NEXT_LEVEL = 100;
const PLAYER_HUD_LOADOUT = Object.freeze({
  weapons: Object.freeze([{ id: 'knife', level: 1 }]),
  passives: Object.freeze([]),
});
const requestedPart = new URLSearchParams(window.location.search).get('part');
const requestedKatanaLevel = Number(new URLSearchParams(window.location.search).get('katanaLevel'));
const defaultKatanaLevel = requestedPart === '1' || requestedPart === '2' ? 1 : 3;
const INITIAL_KATANA_LEVEL = clamp(requestedKatanaLevel || defaultKatanaLevel, 1, 3);
let katanaState = createPlayKatanaState(INITIAL_KATANA_LEVEL);

function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
function activeTilePath(cell) { return TILE_ASSETS[cell.terrain === 'blocked' ? 'blocked' : (cell.gravityLevel ?? 'L0')]; }
function cellCenter(key) { return getHexCenter(getActiveCell(map, key, 'chapter1'), origin); }
function hexPath(ctx, cell, pad = 0) { const center = getHexCenter(cell, origin); const vertices = getHexVertices(cell, origin); ctx.beginPath(); vertices.forEach((point, index) => { const dx = point.x - center.x; const dy = point.y - center.y; const length = Math.hypot(dx, dy) || 1; const x = center.x + dx * (1 - pad / length); const y = center.y + dy * (1 - pad / length); if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }); ctx.closePath(); }
function silhouetteFilter(colour, radius) {
  return `drop-shadow(${radius}px 0 0 ${colour}) drop-shadow(${-radius}px 0 0 ${colour}) drop-shadow(0 ${radius}px 0 ${colour}) drop-shadow(0 ${-radius}px 0 ${colour})`;
}
function drawImage(path, x, y, width, height, alpha = 1, rotation = 0, outlineColour = null) {
  const image = images.get(path);
  if (!image?.complete || !image.naturalWidth) return false;
  context.save();
  context.globalAlpha = alpha;
  context.translate(x, y);
  context.rotate(rotation);
  if (outlineColour) {
    context.filter = silhouetteFilter(outlineColour, .75);
    context.drawImage(image, -width / 2, -height / 2, width, height);
    context.filter = 'none';
  }
  context.drawImage(image, -width / 2, -height / 2, width, height);
  context.restore();
  return true;
}
function drawImageWithSilhouetteOutline(image, x, y, width, height, alpha = 1, radius = 0.55, colour = 'rgba(246, 252, 255, 0.88)') {
  context.save();
  context.globalAlpha = alpha;
  context.filter = silhouetteFilter(colour, radius);
  context.drawImage(image, x - width / 2, y - height / 2, width, height);
  context.filter = 'none';
  context.drawImage(image, x - width / 2, y - height / 2, width, height);
  context.restore();
}
function visibleCell(cell) { return cell.q !== undefined && cell.r !== undefined && cellCenter(cell.key ?? `${cell.q},${cell.r}`).y > camera.y - 40 && cellCenter(cell.key ?? `${cell.q},${cell.r}`).y < camera.y + canvas.height / SCALE + 40; }

function chooseSpawn(nextMap) {
  const authoredStart = findPlayerStart(nextMap, 'chapter1', origin);
  const startCell = Object.values(nextMap.cells).find((cell) => (
    cell.terrain === 'water' && cell.actors?.some((actor) => actor.kind === 'playerStart')
  ));
  if (startCell) return authoredStart;
  const targetRow = ((nextMap.layout?.height ?? 1) - 1) / 2;
  const targetColumn = ((nextMap.layout?.width ?? 1) - 1) / 2;
  const safe = Object.values(nextMap.cells).filter((cell) => cell.terrain === 'water').sort((a, b) => {
    const aColumn = a.q + Math.floor(a.r / 2);
    const bColumn = b.q + Math.floor(b.r / 2);
    return Math.abs(a.r - targetRow) + Math.abs(aColumn - targetColumn)
      - (Math.abs(b.r - targetRow) + Math.abs(bColumn - targetColumn));
  });
  return getHexCenter(safe[0] ?? Object.values(nextMap.cells)[0], origin);
}

function prepareKatanaShowcaseTarget() {
  const target = enemies
    .filter((enemy) => !enemy.defeated && Number(enemy.health) > 0)
    .sort((left, right) => Math.hypot(left.x - spawn.x, left.y - spawn.y) - Math.hypot(right.x - spawn.x, right.y - spawn.y))[0];
  if (!target) return null;
  const targetX = clamp(spawn.x + 44, physicsBounds.minX + 16, physicsBounds.maxX - 16);
  const targetY = clamp(spawn.y, physicsBounds.minY + 16, physicsBounds.maxY - 16);
  Object.assign(target, {
    x: targetX,
    y: targetY,
    homeX: targetX,
    homeY: targetY,
    moveSpeed: 0,
    alerted: true,
    katanaShowcase: true,
  });
  return target;
}

function setupWorld(nextMap) {
  map = nextMap;
  origin = { x: 36, y: 36 };
  mapBounds = getOddRRectangularBounds(map, origin);
  physicsBounds = { minX: mapBounds.left + 7, maxX: mapBounds.right - 7, minY: mapBounds.top + 8, maxY: mapBounds.bottom - 8 };
  spawn = chooseSpawn(map);
  actor = createTestActor(spawn);
  actor.activeWeapon = { id: 'katana', level: INITIAL_KATANA_LEVEL };
  enemies = createPlayEnemies(map, mapPart, 'chapter1', origin);
  katanaState = createPlayKatanaState(INITIAL_KATANA_LEVEL);
  const showcaseTarget = prepareKatanaShowcaseTarget();
  const showcaseSlash = resolvePlayKatanaSlash({
    state: katanaState,
    actor,
    enemies,
    force: true,
    persistent: true,
    targetId: showcaseTarget?.instanceId ?? null,
    damageMultiplier: actor.derivedStats?.currentDamageMultiplier ?? 1,
  });
  worldTime = 0;
  camera = { x: 0, y: 0, edgeX: '中段', edgeY: '中段' };
  aimPoint = null;
  trajectory = [];
  activeCollisionSoundKeys.clear();
  discoverySession.activeByGuideKey.clear();
  discoveryAcknowledgementTargets = [];
  const encounterGroupCount = new Set(enemies.map((enemy) => enemy.anchorCellKey)).size;
  eventLog = [
    '拖曳潛水夫，放開即可彈射。',
    `${MAPS[mapPart].label} 已載入。`,
    `已生成 ${enemies.length} 隻小怪（${encounterGroupCount} 個遭遇群）。`,
    `武士刀 Lv.${katanaState.level} 已示範：${showcaseSlash.hit ? `命中 ${showcaseSlash.hitCount} 隻，造成 ${showcaseSlash.totalDamage} 傷害` : '等待近距離目標'}`,
  ];
  mapTitle.textContent = `${MAPS[mapPart].label} · ${map.layout.width} × ${map.layout.height}`;
  loadingMask.classList.add('is-hidden');
  updateCamera();
  updateHud();
}

function refillUnlimitedResources() {
  if (!unlimitedResources || !actor) return;
  actor.oxygen = actor.derivedStats?.maxOxygen ?? MAX_OXYGEN;
  actor.energy = MAX_ENERGY;
}

async function loadMap(part) {
  mapPart = Number(part) || 3;
  loadingMask.classList.remove('is-hidden');
  try {
    const response = await fetch(MAPS[mapPart].path);
    if (!response.ok) throw new Error(`map ${response.status}`);
    setupWorld(await response.json());
  } catch (error) {
    eventLog = [`地圖載入失敗：${error.message}`];
    eventsList.innerHTML = `<li>${eventLog[0]}</li>`;
    loadingMask.textContent = '地圖載入失敗';
  }
}

function updateCamera() {
  if (!mapBounds || !actor) return;
  const viewWidth = canvas.width / SCALE;
  const viewHeight = canvas.height / SCALE;
  const leftLimit = mapBounds.left - 8;
  const rightLimit = mapBounds.right + 8;
  const topLimit = mapBounds.top - 8;
  const bottomLimit = mapBounds.bottom + 8;
  const desiredX = actor.x - viewWidth * 0.6;
  const desiredY = actor.y - viewHeight * 0.5;
  const maxX = rightLimit - viewWidth;
  const maxY = bottomLimit - viewHeight;
  camera.x = maxX <= leftLimit ? (leftLimit + rightLimit - viewWidth) / 2 : clamp(desiredX, leftLimit, maxX);
  camera.y = maxY <= topLimit ? (topLimit + bottomLimit - viewHeight) / 2 : clamp(desiredY, topLimit, maxY);
  camera.edgeX = camera.x <= leftLimit + 1 ? '左外緣鎖定' : camera.x >= maxX - 1 ? '右外緣鎖定' : '60% 錨點';
  camera.edgeY = camera.y <= topLimit + 1 ? '上外緣' : camera.y >= maxY - 1 ? '下外緣' : '滑動';
  cameraReadout.textContent = `主角 60% 錨點 · ${camera.edgeX}`;
}

function renderBackground() {
  const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, '#0c3155'); gradient.addColorStop(.5, '#061a31'); gradient.addColorStop(1, '#030e1d');
  context.fillStyle = gradient; context.fillRect(0, 0, canvas.width, canvas.height);
  context.save(); context.globalAlpha = .13; context.strokeStyle = '#6ee8ff'; context.lineWidth = 1;
  for (let x = -canvas.height; x < canvas.width + canvas.height; x += 88) { context.beginPath(); context.moveTo(x, 0); context.lineTo(x - canvas.height * .25, canvas.height); context.stroke(); }
  context.restore();
}

function renderCell(cell, key) {
  const center = getHexCenter(cell, origin);
  if (center.y < camera.y - 40 || center.y > camera.y + canvas.height / SCALE + 40) return;
  context.save();
  hexPath(context, cell);
  context.clip();
  drawImage(activeTilePath(cell), center.x, center.y, TILE_SIZE * 1.78, TILE_SIZE * 2.03, cell.terrain === 'blocked' ? .98 : .86);
  if (cell.waterLayer === 'T2' && cell.terrain !== 'blocked') { context.fillStyle = 'rgba(11, 16, 49, .24)'; context.fillRect(center.x - TILE_SIZE, center.y - TILE_SIZE, TILE_SIZE * 2, TILE_SIZE * 2); }
  if (cell.terrain === 'water') drawWaterMotion(cell, center);
  context.restore();
  if (cell.conditionalGate && !cell.conditionalGate.opened) {
    context.save();
    hexPath(context, cell, 1.3);
    context.strokeStyle = CONDITIONAL_GATE_GUIDE.colour;
    context.lineWidth = 1.15;
    context.shadowColor = CONDITIONAL_GATE_GUIDE.colour;
    context.shadowBlur = 3;
    context.stroke();
    context.restore();
  }
  (cell.objects ?? []).forEach((object, index) => drawObject(object, center.x + Math.cos(index * 2.5) * 2, center.y + Math.sin(index * 2.5) * 2));
  (cell.freeObjects ?? []).forEach((object) => { const offset = object.offset ?? { x: 0, y: 0 }; drawObject(object, center.x + offset.x, center.y + offset.y); });
}

function drawWaterMotion(cell, center) {
  const phase = cell.q * 1.71 + cell.r * 0.93;
  const time = performance.now() / 1000;
  const pulse = 0.5 + Math.sin(time * 0.8 + phase) * 0.5;
  const intensity = 5;
  context.save();
  context.globalCompositeOperation = 'screen';
  for (let index = 0; index < 3; index += 1) {
    const localPhase = phase + index * 2.07;
    const angle = localPhase + Math.sin(time * 0.45 + localPhase) * 0.42;
    const radius = 3.2 + index * 2.2;
    const x = center.x + Math.cos(localPhase * 0.7 + time * 0.16) * 2.2;
    const y = center.y + Math.sin(localPhase * 0.8 - time * 0.14) * 2.2;
    context.strokeStyle = `rgba(193, 235, 255, ${(0.035 + pulse * 0.045) * intensity})`;
    context.lineWidth = (0.42 * 1.7) / SCALE;
    context.beginPath();
    context.arc(x, y, radius, angle, angle + 0.95 + pulse * 0.18);
    context.stroke();
  }
  for (let index = 0; index < 2; index += 1) {
    const particlePhase = phase + index * 3.1;
    const x = center.x + Math.sin(time * (0.28 + index * 0.05) + particlePhase) * 7.4;
    const y = center.y + Math.cos(time * (0.22 + index * 0.04) + particlePhase * 1.3) * 6.2;
    context.fillStyle = `rgba(218, 247, 255, ${(0.08 + pulse * 0.08) * intensity})`;
    context.beginPath();
    context.arc(x, y, (0.42 + pulse * 0.18) * 1.45, 0, Math.PI * 2);
    context.fill();
  }
  context.fillStyle = `rgba(181, 229, 255, ${(0.012 + pulse * 0.018) * intensity})`;
  context.beginPath();
  context.arc(center.x + Math.cos(time * 0.22 + phase) * 4.5, center.y + Math.sin(time * 0.19 + phase * 1.2) * 4.5, 4.5 + pulse * 4.5, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

const sideVertexIndexes = [[0, 1], [5, 0], [4, 5], [3, 4], [2, 3], [1, 2]];
function sameSurface(left, right) {
  if (!left || !right || left.terrain !== right.terrain) return false;
  return left.terrain === 'blocked'
    || (left.gravityLevel === right.gravityLevel && (left.waterLayer ?? 'T1') === (right.waterLayer ?? 'T1'));
}

function drawTerrainBoundaries() {
  const faintSharedBorder = { width: 0.5 / SCALE, colour: 'rgba(4, 16, 33, 0.23)' };
  // Keep the transition in world units so the enlarged play camera produces
  // the same deep, almost-black seam as the editor reference image.
  const clearTransitionBorder = { width: 1.25, colour: 'rgba(1, 8, 18, 0.92)' };
  Object.entries(map.cells).forEach(([key, baseCell]) => {
    const cell = getActiveCell(map, key, 'chapter1');
    const center = getHexCenter(cell, origin);
    if (center.y < camera.y - 40 || center.y > camera.y + canvas.height / SCALE + 40) return;
    const vertices = getHexVertices(cell, origin);
    for (let directionIndex = 0; directionIndex <= 2; directionIndex += 1) {
      const adjacentKey = [
        `${cell.q + 1},${cell.r}`,
        `${cell.q + 1},${cell.r - 1}`,
        `${cell.q},${cell.r - 1}`,
      ][directionIndex];
      const adjacent = map.cells[adjacentKey] ? getActiveCell(map, adjacentKey, 'chapter1') : null;
      if (!adjacent) continue;
      const [startIndex, endIndex] = sideVertexIndexes[directionIndex];
      const style = sameSurface(cell, adjacent) ? faintSharedBorder : clearTransitionBorder;
      context.save();
      context.lineWidth = style.width;
      context.strokeStyle = style.colour;
      context.beginPath();
      context.moveTo(vertices[startIndex].x, vertices[startIndex].y);
      context.lineTo(vertices[endIndex].x, vertices[endIndex].y);
      context.stroke();
      context.restore();
    }
  });
}

function drawObject(object, x, y) {
  const size = Math.min(21, Math.max(10, Number(object.size) || 16));
  const guide = getObjectDiscoveryGuide(object.kind);
  if (!drawImage(OBJECT_ASSETS[object.kind], x, y, size, size, .95, 0, guide?.colour)) { context.save(); context.fillStyle = '#f5d967'; context.strokeStyle = guide?.colour ?? '#081526'; context.lineWidth = 1; context.beginPath(); context.arc(x, y, size * .42, 0, Math.PI * 2); context.fill(); context.stroke(); context.fillStyle = '#071629'; context.font = `bold ${Math.max(7, size * .42)}px sans-serif`; context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillText(objectGlyphs[object.kind] ?? '?', x, y); context.restore(); }
}

function drawEdges() {
  allMapEdges(map).forEach(({ a, b, key }) => {
    const edge = getActiveEdge(map, key, 'chapter1') ?? getEdgeBetween(map, a, b, 'chapter1');
    if (!edge || edge.type === 'none') return;
    const fromCell = getActiveCell(map, a, 'chapter1');
    const toCell = getActiveCell(map, b, 'chapter1');
    const from = cellCenter(a);
    const to = cellCenter(b);
    const geometry = getEdgeAttachmentGeometry(from, to, fromCell?.terrain, toCell?.terrain, {
      edgeLength: HEX_SIZE,
      blockedInset: 1.25,
    });
    if (!geometry) return;
    const mid = geometry.midpoint;
    if (mid.y < camera.y - 45 || mid.y > camera.y + canvas.height / SCALE + 45) return;
    const color = edgeColors[edge.type] ?? '#bcecff';
    context.save(); context.strokeStyle = color; context.lineWidth = (edge.type === 'multiPortal' ? 1.5 : 1.05) / SCALE; context.globalAlpha = .84; context.setLineDash(edge.type === 'current' ? [3 / SCALE, 3 / SCALE] : []);
    context.beginPath(); context.moveTo(geometry.edgeStart.x, geometry.edgeStart.y); context.lineTo(geometry.edgeEnd.x, geometry.edgeEnd.y); context.stroke(); context.restore();
    const asset = EDGE_ASSETS[edge.type];
    if (!asset) return;
    const isPortal = edge.type === 'multiPortal' || edge.type === 'layerPortal';
    const isAnchoredPlant = edge.type === 'seaweed' || edge.type === 'coralCluster';
    const pointsIntoWater = edge.type === 'spike' || edge.type === 'barrier' || edge.type === 'current';
    const sitsInsideWall = pointsIntoWater || edge.type === 'springJelly';
    let renderX = sitsInsideWall ? geometry.attachmentPoint.x : mid.x;
    let renderY = sitsInsideWall ? geometry.attachmentPoint.y : mid.y;
    let rotation = pointsIntoWater
      ? geometry.pointsIntoOpenAngle
      : isAnchoredPlant
        ? geometry.growsIntoOpenAngle
        : geometry.tangentAngle;
    if (isPortal) {
      // Align the long axis to the shared hex edge (the tangent), keeping the
      // portal centered on the boundary instead of floating over a cell.
      rotation = geometry.tangentAngle;
      const blockedCell = fromCell?.terrain === 'blocked' ? fromCell : toCell?.terrain === 'blocked' ? toCell : null;
      const waterCell = blockedCell === fromCell ? toCell : fromCell;
      if (blockedCell && waterCell) {
        const blockedCenter = getHexCenter(blockedCell, origin);
        const waterCenter = getHexCenter(waterCell, origin);
        const distance = Math.hypot(waterCenter.x - blockedCenter.x, waterCenter.y - blockedCenter.y) || 1;
        renderX += ((waterCenter.x - blockedCenter.x) / distance) * 2;
        renderY += ((waterCenter.y - blockedCenter.y) / distance) * 2;
      }
    }
    const width = isPortal ? 22 : isAnchoredPlant ? 16 : HEX_SIZE * 1.04;
    const height = edge.type === 'multiPortal' ? 9 : isPortal ? 18 : isAnchoredPlant ? 16 : width * .625;
    drawImage(asset, renderX, renderY, width, height, .92, rotation, getEdgeDiscoveryGuide(edge.type)?.colour);
  });
}

function applyPlayEnemyDamage(amount, source, damageType = 'generic') {
  if (!actor || unlimitedResources) return;
  const result = applyDamage(actor, amount, source, damageType);
  if (result.applied > 0) eventLog.push(`受到 ${Math.round(result.applied)} 傷害 · ${source}`);
}

function drawTrajectory() {
  if (!dragging || !aimPoint) return;
  drawLaunchGuide(context, getLaunchGuideGeometry(actor, aimPoint), actor, aimPoint, performance.now() / 1000);
}

function drawActor() {
  if (!actor) return;
  const time = performance.now();
  const animationState = getPlayerAnimationState(actor);
  const frameIndex = getPlayerAnimationFrameIndex(animationState, time / 1000, actor);
  const animationPath = PLAYER_ASSETS[animationState]?.[frameIndex] ?? PLAYER_ASSET;
  const image = images.get(animationPath);
  const imageReady = image?.complete && image.naturalWidth > 0 && image.naturalHeight > 0;
  const motion = getPlayerAnimationMotion(animationState, time / 1000, actor);
  const anchor = getPlayerAnimationPosition(actor);
  const facing = getPlayerFacingDirection(actor);
  const height = Math.max(22, actor.radius * 3.1);
  const width = imageReady ? height * image.naturalWidth / image.naturalHeight : height * .78;

  context.save();
  context.globalCompositeOperation = 'screen';
  context.globalAlpha = .18;
  context.fillStyle = '#49dfff';
  context.beginPath();
  context.ellipse(anchor.x, anchor.y + motion.bob + height * .22, width * .42 * motion.scaleX, height * .34 * motion.scaleY, 0, 0, Math.PI * 2);
  context.fill();
  context.restore();

  context.save();
  context.translate(anchor.x, anchor.y + motion.bob);
  context.rotate(motion.rotation);
  context.scale(getPlayerSpriteScaleX(facing, motion.scaleX), motion.scaleY);
  if (imageReady) {
    drawImageWithSilhouetteOutline(image, 0, 0, width, height, motion.alpha, .62, motion.glow === '#ffb7a1' ? 'rgba(255, 243, 239, 0.9)' : 'rgba(246, 252, 255, 0.88)');
  } else {
    // Keep a readable non-text fallback while the sprite is loading.
    context.fillStyle = '#090f18';
    context.strokeStyle = '#8de9ff';
    context.lineWidth = 1.1;
    context.beginPath();
    context.arc(0, -height * .24, width * .27, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.fillStyle = '#183c57';
    context.beginPath();
    context.ellipse(0, height * .12, width * .27, height * .35, 0, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.fillStyle = '#1b6f94';
    context.fillRect(-width * .45, height * .3, width * .28, height * .18);
    context.fillRect(width * .17, height * .3, width * .28, height * .18);
  }
  context.restore();

  context.save();
  context.globalCompositeOperation = 'screen';
  context.globalAlpha = .66;
  context.fillStyle = '#bff8ff';
  for (let index = 0; index < (animationState === 'death' ? 1 : 2); index += 1) {
    const phase = time / 420 + index * 2.8;
    context.beginPath();
    context.arc(anchor.x + Math.cos(phase) * width * .42, anchor.y + motion.bob - height * .28 - ((time / 700 + index * 4) % 4), .55 + index * .18, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();

  if (dragging && aimPoint) {
    context.save();
    context.strokeStyle = '#f7dc78';
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(actor.x, actor.y);
    context.lineTo(aimPoint.x, aimPoint.y);
    context.stroke();
    context.restore();
  }
}

function drawKatanaEffects() {
  katanaState.effects.forEach((effect) => {
    const progress = effect.persistent
      ? (effect.type === 'katanaSwing' ? 0.82 : 0.68)
      : clamp(effect.elapsed / Math.max(effect.duration, 0.001), 0, 1);
    if (effect.type === 'katanaSwing') drawKatanaSwing(effect, progress);
    if (effect.type === 'katanaWave') drawKatanaWave(effect, progress);
  });
}

function drawKatanaBlade(effect, angle, alpha) {
  const sprite = images.get(effect.sprite ?? KATANA_SPRITE);
  const length = effect.weaponLength ?? 72;
  const thickness = effect.weaponThickness ?? 11.2;
  const pivot = effect.gripPivot ?? 14;
  context.save();
  context.translate(effect.x, effect.y);
  context.rotate(angle);
  context.globalAlpha = alpha;
  context.shadowColor = effect.glowColour ?? '#9be8ff';
  context.shadowBlur = effect.empowered ? 12 : 6;
  context.strokeStyle = effect.colour ?? '#73d9ff';
  context.lineWidth = Math.max(1.2, thickness * 0.22);
  context.beginPath();
  context.moveTo(0, 0);
  context.lineTo(length - pivot, 0);
  context.stroke();
  if (sprite?.complete && sprite.naturalWidth > 0) {
    context.drawImage(sprite, -pivot, -thickness * 0.5, length, thickness);
  } else {
    context.strokeStyle = '#d8fbff';
    context.lineWidth = 2.2;
    context.beginPath();
    context.moveTo(-pivot, 0);
    context.lineTo(length - pivot, 0);
    context.stroke();
  }
  context.restore();
}

function drawKatanaSwing(effect, progress) {
  const frames = getKatanaSwingFrames(effect, progress);
  const fade = effect.persistent ? 1 : Math.max(0.18, 1 - Math.max(0, progress - 0.78) / 0.22);
  frames.afterimages.forEach((frame) => drawKatanaBlade(effect, frame.angle, frame.alpha * fade));
  drawKatanaBlade(effect, frames.currentAngle, 0.98 * fade);
}

function drawKatanaWave(effect, progress) {
  const pose = getKatanaWavePose(effect, progress);
  const halfArc = ((effect.arcDegrees ?? 94) * Math.PI) / 360;
  const opacity = effect.persistent ? 0.78 : Math.max(0, 1 - progress);
  context.save();
  context.globalCompositeOperation = 'lighter';
  context.globalAlpha = opacity;
  context.lineCap = 'round';
  context.strokeStyle = effect.colour ?? '#f4fdff';
  context.shadowColor = effect.glowColour ?? '#b8fbff';
  context.shadowBlur = 14;
  context.lineWidth = effect.thickness ?? 9;
  context.beginPath();
  context.arc(pose.x, pose.y, pose.radius, pose.angle - halfArc, pose.angle + halfArc);
  context.stroke();
  context.shadowBlur = 0;
  context.strokeStyle = '#ffffff';
  context.lineWidth = effect.lineWidth ?? 4.5;
  context.stroke();
  context.restore();
}

function drawEnemyHealthBar(enemy, x, y, width, height) {
  const ratio = clamp(Number(enemy.health) / Math.max(Number(enemy.maxHealth) || 1, 1), 0, 1);
  context.save();
  context.globalAlpha = .94;
  context.fillStyle = 'rgba(4, 10, 20, .9)';
  context.fillRect(x - width * .5, y - height * .5, width, height);
  context.fillStyle = enemy.hitFlash > 0 ? '#fff0f5' : '#ff6f91';
  context.fillRect(x - width * .5 + .6, y - height * .5 + .6, Math.max(0, (width - 1.2) * ratio), height - 1.2);
  context.strokeStyle = enemy.katanaShowcase ? '#ff9eb8' : 'rgba(255, 255, 255, .55)';
  context.lineWidth = .7;
  context.strokeRect(x - width * .5, y - height * .5, width, height);
  if (enemy.hitFlash > 0) {
    context.globalAlpha = Math.min(1, enemy.hitFlash * 5);
    context.strokeStyle = '#fff8fb';
    context.lineWidth = 1.2;
    context.beginPath();
    context.arc(x, y, Math.max(width, height) * .62, 0, Math.PI * 2);
    context.stroke();
  }
  context.restore();
}

function drawEnemies() {
  const viewport = { width: canvas.width / SCALE, height: canvas.height / SCALE };
  enemies.forEach((enemy) => {
    if (enemy.defeated || !isPlayEnemyVisible(enemy, camera, viewport)) return;
    const pose = getPlayEnemyPose(enemy, worldTime);
    const guide = getEnemyDiscoveryGuide(enemy.enemyId);
    const image = images.get(enemy.visual);
    const imageReady = image?.complete && image.naturalWidth > 0 && image.naturalHeight > 0;
    const height = enemy.renderSize;
    const rawRatio = imageReady ? image.naturalWidth / image.naturalHeight : 1;
    const width = height * clamp(rawRatio, 0.72, 1.65);
    drawEnemyHealthBar(enemy, pose.x, pose.y - height * .62, Math.max(18, width * .72), 3.1);

    context.save();
    context.globalCompositeOperation = 'screen';
    context.globalAlpha = .2;
    context.fillStyle = enemy.tier >= 3 ? '#a785ff' : '#4edcff';
    context.beginPath();
    context.ellipse(pose.x, pose.y + height * .25, width * .42, height * .24, 0, 0, Math.PI * 2);
    context.fill();
    context.restore();

    if (imageReady) {
      drawImageWithSilhouetteOutline(image, pose.x, pose.y, width, height, .96, .75, guide?.colour);
      return;
    }

    context.save();
    context.fillStyle = '#173b55';
    context.strokeStyle = guide?.colour ?? '#b9efff';
    context.lineWidth = .7;
    context.beginPath();
    context.ellipse(pose.x, pose.y, width * .38, height * .32, 0, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.fillStyle = '#eafaff';
    context.font = 'bold 4px system-ui';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(String(enemy.tier), pose.x, pose.y);
    context.restore();
  });
}

function isWorldTargetVisible(x, y, size = 0) {
  const half = size * .5;
  return x + half >= camera.x
    && x - half <= camera.x + canvas.width / SCALE
    && y + half >= camera.y
    && y - half <= camera.y + canvas.height / SCALE;
}

function collectVisibleDiscoverables() {
  const targets = [];
  Object.entries(map.cells).forEach(([cellKey]) => {
    const cell = getActiveCell(map, cellKey, 'chapter1');
    const center = getHexCenter(cell, origin);
    if (cell.conditionalGate && !cell.conditionalGate.opened && isWorldTargetVisible(center.x, center.y, TILE_SIZE)) {
      targets.push({ instanceId: `gate:${cellKey}`, guideKey: 'gate:conditional', guide: CONDITIONAL_GATE_GUIDE, x: center.x, y: center.y, size: TILE_SIZE });
    }
    (cell.objects ?? []).forEach((object, index) => {
      const guide = getObjectDiscoveryGuide(object.kind);
      if (!guide) return;
      const x = center.x + Math.cos(index * 2.5) * 2;
      const y = center.y + Math.sin(index * 2.5) * 2;
      const size = Math.min(21, Math.max(10, Number(object.size) || 16));
      if (isWorldTargetVisible(x, y, size)) targets.push({ instanceId: `cell-object:${cellKey}:${index}`, guideKey: `object:${object.kind}`, guide, x, y, size });
    });
    (cell.freeObjects ?? []).forEach((object, index) => {
      const guide = getObjectDiscoveryGuide(object.kind);
      if (!guide) return;
      const offset = object.offset ?? { x: 0, y: 0 };
      const x = center.x + offset.x;
      const y = center.y + offset.y;
      const size = Math.min(21, Math.max(10, Number(object.size) || 16));
      if (isWorldTargetVisible(x, y, size)) targets.push({ instanceId: `free-object:${cellKey}:${index}`, guideKey: `object:${object.kind}`, guide, x, y, size });
    });
  });

  allMapEdges(map).forEach(({ a, b, key }) => {
    const edge = getActiveEdge(map, key, 'chapter1') ?? getEdgeBetween(map, a, b, 'chapter1');
    const guide = getEdgeDiscoveryGuide(edge?.type);
    if (!guide) return;
    const from = cellCenter(a);
    const to = cellCenter(b);
    const x = (from.x + to.x) * .5;
    const y = (from.y + to.y) * .5;
    if (isWorldTargetVisible(x, y, 18)) targets.push({ instanceId: `edge:${key}`, guideKey: `edge:${edge.type}`, guide, x, y, size: 18 });
  });

  const viewport = { width: canvas.width / SCALE, height: canvas.height / SCALE };
  enemies.forEach((enemy) => {
    if (enemy.defeated || !isPlayEnemyVisible(enemy, camera, viewport, 0)) return;
    const guide = getEnemyDiscoveryGuide(enemy.enemyId);
    if (!guide) return;
    const pose = getPlayEnemyPose(enemy, worldTime);
    targets.push({ instanceId: enemy.instanceId, guideKey: `enemy:${enemy.enemyId}`, guide, x: pose.x, y: pose.y, size: enemy.renderSize });
  });

  return targets.sort((left, right) => (
    Math.hypot(left.x - actor.x, left.y - actor.y) - Math.hypot(right.x - actor.x, right.y - actor.y)
  ));
}

function render() {
  renderBackground();
  if (!map || !actor) return;
  context.save(); context.scale(SCALE, SCALE); context.translate(-camera.x, -camera.y);
  Object.entries(map.cells).forEach(([key, cell]) => renderCell(getActiveCell(map, key, 'chapter1'), key));
  drawTerrainBoundaries(); drawEdges(); drawEnemies(); drawTrajectory(); drawActor(); drawKatanaEffects();
  const activeGuides = updateDiscoverySession(discoverySession, collectVisibleDiscoverables(), worldTime);
  discoveryAcknowledgementTargets = drawDiscoveryGuides(context, activeGuides, camera, { width: canvas.width / SCALE, height: canvas.height / SCALE }, worldTime);
  context.restore();
}

function updateHud() {
  if (!actor) return;
  updateHudIconSlots();
  const firstRowCenterY = (mapBounds?.top ?? origin.y) + HEX_SIZE;
  const depthMeters = Math.max(0, Math.round((actor.y - firstRowCenterY) / (HEX_SIZE * 1.5)));
  depthReadout.textContent = `${String(depthMeters).padStart(3, '0')} m`;
  depthReadout.setAttribute('aria-label', `目前下沉 ${depthMeters} 公尺`);
  levelReadout.textContent = String(PLAYER_LEVEL).padStart(2, '0');
  experienceReadout.textContent = `EXP ${String(PLAYER_EXPERIENCE).padStart(3, '0')} / ${EXPERIENCE_TO_NEXT_LEVEL}`;
  experienceFill.style.width = `${Math.min(100, Math.max(0, PLAYER_EXPERIENCE / EXPERIENCE_TO_NEXT_LEVEL * 100))}%`;
  attemptsReadout.textContent = `Attempts ${actor.lives}/${actor.maxLives}`;
  const oxygenMaximum = actor.derivedStats?.maxOxygen ?? MAX_OXYGEN;
  const oxygenHud = getOxygenHud(actor.oxygen, oxygenMaximum);
  resourceValues.oxygen.textContent = oxygenHud.label;
  oxygenFill.style.setProperty('--oxygen-fill', `${oxygenHud.ratio * 100}%`);
  resourceBars.oxygen.setAttribute('aria-valuenow', String(Math.round(oxygenHud.ratio * 100)));

  const energyHud = getEnergyHud(actor.energy, MAX_ENERGY);
  resourceValues.energy.textContent = energyHud.label;
  resourceBars.energy.setAttribute('aria-valuenow', String(energyHud.level));
  energySegments.forEach((segment, index) => {
    segment.querySelector('b').style.setProperty('--segment-fill', `${energyHud.fills[index] * 100}%`);
  });

  const healthHud = getHealthHud(actor.health, MAX_HEALTH);
  resourceValues.health.textContent = healthHud.label;
  resourceBars.health.setAttribute('aria-valuenow', String(Math.round(healthHud.value)));
  resourceBars.health.classList.remove('is-full', 'is-warning', 'is-critical');
  resourceBars.health.classList.add(`is-${healthHud.tone}`);
  resourceBars.health.style.setProperty('--health-color', healthHud.color);
  resourceBars.health.style.setProperty('--health-glow', healthHud.glow);
  healthSegments.forEach((segment, index) => {
    segment.querySelector('b').style.setProperty('--segment-fill', `${healthHud.fills[index] * 100}%`);
  });
  healthPointer.style.setProperty('--health-angle', `${180 + healthHud.ratio * 360}deg`);
  speedReadout.textContent = `速度 ${Math.round(Math.hypot(actor.vx, actor.vy))}`;
  eventsList.innerHTML = eventLog.slice(-5).reverse().map((message) => `<li>${message}</li>`).join('');
}

function updateHudIconSlots() {
  const slots = getPlayerHudSlots(PLAYER_HUD_LOADOUT);
  visorSlots.forEach((slotElement, index) => {
    const slot = slots[index];
    const icon = slotElement.querySelector('[data-visor-icon]');
    if (!slot || !icon) return;
    const filled = Boolean(slot.path);
    slotElement.dataset.visorFilled = String(filled);
    if (!filled) {
      icon.hidden = true;
      icon.removeAttribute('src');
      slotElement.setAttribute('aria-label', `${slotElement.dataset.visorSlotKind === 'weapon' ? '主動武器' : '被動能力'}空槽`);
      return;
    }
    icon.src = slot.path;
    icon.alt = `${slot.name} Lv.${slot.level}`;
    icon.hidden = false;
    slotElement.setAttribute('aria-label', `${slot.name} Lv.${slot.level}`);
  });
}

function setSettingsOpen(open) {
  const nextOpen = Boolean(open);
  settingsPanel.hidden = !nextOpen;
  settingsToggle.setAttribute('aria-expanded', String(nextOpen));
  if (nextOpen) settingsClose.focus();
}

const COLLISION_SOUND_TYPES = new Set(['springJelly', 'wall', 'barrier', 'terrainBoundary', 'layerBoundary', 'spike', 'razor']);

function playSfxForEvents(events) {
  const soundIds = new Set();
  const collisionKeys = new Set();
  events.forEach((event) => {
    if (!event?.type) return;
    if (COLLISION_SOUND_TYPES.has(event.type)) {
      collisionKeys.add(`${event.type}:${event.collisionKey ?? 'default'}`);
      return;
    }
    if (event.type === 'mine' || event.type === 'weightStone') soundIds.add('explosion');
    if (event.type === 'button') soundIds.add('button');
    if (event.type === 'checkpoint') soundIds.add('teleport');
    if (event.type === 'layerPortal' || event.type === 'multiPortal') soundIds.add('teleport');
    if (event.type === 'bubble' || (event.type === 'oxygen' && event.message?.includes('釋放'))) soundIds.add('waterDrop');
    if (event.type === 'oxygenStarvation') soundIds.add('impactWet');
  });
  if ([...collisionKeys].some((key) => !activeCollisionSoundKeys.has(key))) soundIds.add('impactWet');
  activeCollisionSoundKeys = collisionKeys;
  soundIds.forEach((soundId) => sfxController.play(soundId));
}

function addEvents(events) {
  playSfxForEvents(events);
  events.forEach((event) => { if (event?.message) eventLog.push(event.message); });
  if (eventLog.length > 12) eventLog = eventLog.slice(-12);
}
function refreshTrajectory(force = false) {
  if (!dragging || !aimPoint || !map || !actor) return;
  const now = performance.now();
  if (!force && now - lastTrajectoryAt < 45) return;
  lastTrajectoryAt = now;
  trajectory = getLaunchGuideGeometry(actor, aimPoint).points;
}
function canvasPoint(event) { const rect = canvas.getBoundingClientRect(); return { x: (event.clientX - rect.left) * canvas.width / rect.width, y: (event.clientY - rect.top) * canvas.height / rect.height }; }
function screenToWorld(point) { return { x: point.x / SCALE + camera.x, y: point.y / SCALE + camera.y }; }
function actorCanvasPoint() { return { x: (actor.x - camera.x) * SCALE, y: (actor.y - camera.y) * SCALE }; }

canvas.addEventListener('pointerdown', (event) => {
  if (!actor) return;
  const point = canvasPoint(event);
  const worldPoint = screenToWorld(point);
  const acknowledgement = hitTestDiscoveryAcknowledgement(discoveryAcknowledgementTargets, worldPoint);
  if (acknowledgement) {
    event.preventDefault();
    if (acknowledgeDiscoveryGuide(discoverySession, acknowledgement.guideKey)) {
      sfxController.play('button', { volumeMultiplier: .55 });
      discoveryAcknowledgementTargets = [];
      render();
    }
    return;
  }
  if (paused || actor.dead) return;
  event.preventDefault();
  const actorPoint = actorCanvasPoint();
  if (Math.hypot(point.x - actorPoint.x, point.y - actorPoint.y) > 58) return;
  dragging = true;
  canvas.setPointerCapture(event.pointerId);
  aimPoint = worldPoint;
  refreshTrajectory(true);
  updateHud();
});
canvas.addEventListener('pointermove', (event) => { if (!dragging) return; aimPoint = screenToWorld(canvasPoint(event)); refreshTrajectory(); });
canvas.addEventListener('pointerup', (event) => { if (!dragging) return; dragging = false; if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId); aimPoint = screenToWorld(canvasPoint(event)); refillUnlimitedResources(); const result = launchActor(actor, aimPoint); if (result.launched) { sfxController.play('launch'); eventLog.push(`彈射 ${Math.round(result.distance)} px · 初速度 ${Math.round(result.speed)} · 能量 -${Math.ceil(result.costs.energy)} · 氧氣改為時間倒數（滿氧約 40 秒）`); } else { sfxController.play('button', { volumeMultiplier: .55 }); eventLog.push(result.reason === 'energy' ? '能量不足，無法彈射。' : '這次彈射距離太短。'); } trajectory = []; updateHud(); });
canvas.addEventListener('pointercancel', () => { dragging = false; trajectory = []; lastTrajectoryAt = -Infinity; });
canvas.addEventListener('lostpointercapture', () => { dragging = false; trajectory = []; lastTrajectoryAt = -Infinity; });
resetButton.addEventListener('click', () => { if (!actor) return; sfxController.play('button'); activeCollisionSoundKeys.clear(); Object.assign(actor, createTestActor(spawn)); eventLog.push('主角已回到中央安全水域。'); updateCamera(); updateHud(); });
pauseButton.addEventListener('click', () => { sfxController.play('menuSelection'); paused = !paused; pauseButton.textContent = paused ? '▶ 繼續' : 'Ⅱ 暫停'; pauseButton.setAttribute('aria-pressed', String(paused)); });
unlimitedResourcesButton.addEventListener('click', () => { sfxController.play('button'); unlimitedResources = !unlimitedResources; unlimitedResourcesButton.classList.toggle('is-active', unlimitedResources); unlimitedResourcesButton.setAttribute('aria-pressed', String(unlimitedResources)); unlimitedResourcesButton.textContent = unlimitedResources ? '∞ 無限氧氣／能量：開' : '∞ 無限氧氣／能量：關'; refillUnlimitedResources(); updateHud(); });
ambientToggle.addEventListener('click', () => { ambientEnabled = !ambientEnabled; ambientToggle.setAttribute('aria-pressed', String(ambientEnabled)); ambientToggle.textContent = `${ambientEnabled ? '◉' : '○'} 潛水環境音（240 秒循環）：${ambientEnabled ? '開' : '關'}`; if (ambientEnabled) sfxController.startAmbient(); else sfxController.stopAmbient(); });
settingsToggle.addEventListener('click', () => { sfxController.play('menuSelection'); setSettingsOpen(settingsPanel.hidden); });
settingsClose.addEventListener('click', () => { sfxController.play('button'); setSettingsOpen(false); });
exitButton.addEventListener('click', () => { sfxController.play('button'); window.location.href = '/home.html'; });
function syncMusicTrack() {
  musicController.setTrack(getMusicTrack({ part: mapPart, arc: musicArcSelect.value, mode: musicModeSelect.value }));
}
mapSelect.addEventListener('change', () => {
  sfxController.play('menuSelection');
  mapPart = Number(mapSelect.value) || 3;
  syncMusicTrack();
  loadMap(mapPart);
});
musicArcSelect.addEventListener('change', () => { sfxController.play('menuSelection'); syncMusicTrack(); });
musicModeSelect.addEventListener('change', () => { sfxController.play('menuSelection'); syncMusicTrack(); });
window.addEventListener('keydown', (event) => {
  if (event.key.toLowerCase() === 'r') resetButton.click();
  if (event.code === 'Space') { event.preventDefault(); pauseButton.click(); }
  if (event.key === 'Escape') {
    if (!settingsPanel.hidden) setSettingsOpen(false);
  }
});

function simulate(elapsed, now = performance.now()) {
  if (!paused && map && actor && !actor.gameOver) {
    accumulator += Math.min(.1, Math.max(0, elapsed));
    while (accumulator >= FIXED_STEP) {
      worldTime += FIXED_STEP;
      refillUnlimitedResources();
      const previousPosition = { x: actor.x, y: actor.y };
      addEvents(stepPhysics({ map, chapter: 'chapter1', actor, dt: FIXED_STEP, origin, bounds: physicsBounds, mutateMap: true, time: now / 1000 }));
      markPlayKatanaMovement(katanaState, Math.hypot(actor.x - previousPosition.x, actor.y - previousPosition.y));
      updatePlayEnemies(enemies, actor, FIXED_STEP, worldTime, applyPlayEnemyDamage, physicsBounds, { map, chapter: 'chapter1', origin });
      stepPlayKatana(katanaState, FIXED_STEP);
      const katanaAttack = resolvePlayKatanaSlash({
        state: katanaState,
        actor,
        enemies,
        damageMultiplier: actor.derivedStats?.currentDamageMultiplier ?? 1,
      });
      if (katanaAttack.ok && katanaAttack.hit) {
        eventLog.push(`武士刀 Lv.${katanaState.level}${katanaAttack.empowered ? ' 強化' : ''}斬擊命中 ${katanaAttack.hitCount} 隻，造成 ${katanaAttack.totalDamage} 傷害。`);
      }
      enemies.forEach((enemy) => {
        enemy.hitFlash = Math.max(0, (enemy.hitFlash ?? 0) - FIXED_STEP);
      });
      if (actor.health <= 0) {
        const cause = '生命歸零';
        const death = registerPlayerDeath(actor, cause);
        if (death.gameOver) {
          sfxController.play('gameOver');
          eventLog.push(`${cause}：永久死亡。`);
        } else {
          sfxController.play('impactWet');
          respawnActor(actor, spawn);
          eventLog.push(`${cause}：失去 1 條命，已回到安全水域。`);
        }
      }
      refillUnlimitedResources();
      accumulator -= FIXED_STEP;
    }
    updateCamera();
    updateHud();
  }
}

window.render_game_to_text = () => JSON.stringify({
  coordinateSystem: 'world origin is top-left; x right, y down',
  map: MAPS[mapPart]?.label ?? 'loading',
  camera: { x: Math.round(camera.x), y: Math.round(camera.y), horizontal: camera.edgeX },
  player: actor ? { x: Math.round(actor.x), y: Math.round(actor.y), vx: Math.round(actor.vx), vy: Math.round(actor.vy), health: Math.round(actor.health), oxygen: Math.round(actor.oxygen), energy: Math.round(actor.energy), animation: getPlayerAnimationState(actor), facing: getPlayerFacingDirection(actor), dragging, weapon: actor.activeWeapon } : null,
  hudLoadout: getPlayerHudSlots(PLAYER_HUD_LOADOUT).map(({ key, kind, id, level, path }) => ({ key, kind, id, level, path })),
  katana: { level: katanaState.level, cooldown: Math.round(katanaState.cooldown * 100) / 100, empowerNextSlash: katanaState.empowerNextSlash, slashCount: katanaState.slashCount, lastHitCount: katanaState.lastHitCount, lastDamage: katanaState.lastDamage, effects: katanaState.effects.map((effect) => ({ type: effect.type, persistent: effect.persistent, empowered: effect.empowered ?? false, hitCount: effect.hitCount ?? 0, damage: effect.damage ?? 0 })) },
  enemies: enemies.filter((enemy) => isPlayEnemyVisible(enemy, camera, { width: canvas.width / SCALE, height: canvas.height / SCALE })).map((enemy) => ({ id: enemy.enemyId, name: enemy.name, x: Math.round(enemy.x), y: Math.round(enemy.y), health: Math.round(enemy.health), maxHealth: Math.round(enemy.maxHealth), defeated: Boolean(enemy.defeated), hitFlash: Math.round((enemy.hitFlash ?? 0) * 100) / 100, katanaShowcase: Boolean(enemy.katanaShowcase), state: enemy.state, facing: enemy.facing, spawnPattern: enemy.spawnPattern, pendingSkill: enemy.pendingSkill ? { id: enemy.pendingSkill.skillId, remaining: Math.round(enemy.pendingSkill.remaining * 100) / 100 } : null })),
  totalEnemySpawns: enemies.length,
  totalEncounterGroups: new Set(enemies.map((enemy) => enemy.anchorCellKey)).size,
  totalClusteredSpawns: enemies.filter((enemy) => enemy.spawnPattern === 'cluster').length,
  discoveries: {
    seen: [...discoverySession.seenGuideKeys],
    active: [...discoverySession.activeByGuideKey.values()].map((entry) => ({ id: entry.guideKey, title: entry.guide.title, category: entry.guide.categoryLabel })),
  },
  unlimitedResources,
  paused,
});
window.advanceTime = (milliseconds) => { const steps = Math.max(1, Math.round(Math.max(0, milliseconds) / (1000 / 60))); for (let index = 0; index < steps; index += 1) simulate(FIXED_STEP, performance.now()); render(); };

function frame(now) { const elapsed = Math.min(.1, Math.max(0, (now - lastFrame) / 1000)); lastFrame = now; simulate(elapsed, now); render(); requestAnimationFrame(frame); }

if (requestedPart && MAPS[requestedPart]) { mapSelect.value = requestedPart; mapPart = Number(requestedPart); }
const requestedArc = new URLSearchParams(window.location.search).get('arc');
const requestedMode = new URLSearchParams(window.location.search).get('mode');
if (requestedArc === 'ascent20') musicArcSelect.value = requestedArc;
if (requestedMode === 'boss') musicModeSelect.value = requestedMode;
syncMusicTrack();
musicController.start();
sfxController.startAmbient();
function unlockAmbientAudio() {
  if (ambientEnabled) sfxController.startAmbient();
}
// Capture the first trusted gesture even when it lands on a HUD control or
// canvas child; repeated attempts also recover from a browser autoplay reject.
window.addEventListener('pointerdown', unlockAmbientAudio, { capture: true });
window.addEventListener('keydown', unlockAmbientAudio, { capture: true });
loadMap(mapPart);
requestAnimationFrame(frame);
