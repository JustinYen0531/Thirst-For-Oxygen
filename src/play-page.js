import {
  allMapEdges,
  getActiveCell,
  getActiveEdge,
  getHexCenter,
  getHexVertices,
  getOddRRectangularBounds,
  getEdgeBetween,
  getDirectionVector,
  HEX_SIZE,
} from './map-model.js';
import { getEdgeSetting, getFreeObjectSetting } from './map-object-settings.js';
import { RESONANCE_RULES } from './resonance.js';
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
  setPlayerDamageReduction,
  stepPhysics,
  toggleSeaweedAttachment,
} from './physics.js';
import { drawLaunchGuide, getLaunchGuideGeometry } from './launch-guide.js';
import { getEdgeAttachmentGeometry } from './edge-attachment.js';
// Keep gameplay styling in the same module graph as the runtime. The direct
// links in play.html remain as an early-paint fallback, while these imports
// guarantee that a successful Play module boot also installs both HUD styles.
import './play.css';
import './visor-hud.css';
import {
  createPlayAwakeningState,
  getPlayAttemptState,
  getPlayAwakeningRenderState,
  stepPlayAwakening,
} from './play-awakening.js';
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
import { bindLanguageSelect, installLiveLocalization } from './i18n-gameplay.js';
import {
  createPlayKatanaState,
  markPlayKatanaMovement,
  resolvePlayKatanaSlash,
  stepPlayKatana,
} from './play-katana.js';
import { KATANA_SPRITE, getKatanaSwingFrames, getKatanaWavePose } from './katana-visual.js';
import { getEnergyHud, getHealthHud, getOxygenHud, getPlayerHudSlotLabel, getPlayerHudSlots } from './visor-hud.js';
import { getAimTimeScale, scaleSimulationDelta } from './aim-slow-motion.js';
import { WEAPONS, getEnemyDamageToPlayer, getWeaponStats } from './game-data.js';
import {
  choosePlayUpgrade,
  choosePlayUpgradeCategory,
  createPlayCombatState,
  getPlayCombatHudState,
  getPlayCombatRenderState,
  recordPlayEnemyDefeats,
  stepPlayCombat,
  syncPlayCombatBuild,
} from './play-combat.js';
import { getPlayStageExitState } from './play-flow.js';
import { createPlayBossRoomState, getPlayBossRoomRenderState, stepPlayBossRoom } from './play-boss-room.js';
import {
  getPlayEdgeVisual,
  getPlayObjectVisual,
  getPlayOverlayVisual,
} from './play-world-visuals.js';
import {
  createPlayEnemies,
  getPlayEnemyFrameState,
  getPlayEnemyRenderState,
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
import { PLAY_IMAGE_ASSET_PATHS, PLAY_MAP_ASSET_URLS, PLAY_TILE_ASSETS } from './play-preload.js';
import {
  createPlayRenderIndex,
  createPlayUpdateGate,
  getVisiblePlayCells,
  getVisiblePlayEdges,
} from './play-performance.js';

const MAP_ROUTES = Object.freeze({
  descent: Object.freeze({
    1: Object.freeze({ path: PLAY_MAP_ASSET_URLS.descent[1], label: '下沉篇・第一部分' }),
    2: Object.freeze({ path: PLAY_MAP_ASSET_URLS.descent[2], label: '下沉篇・第二部分' }),
    3: Object.freeze({ path: PLAY_MAP_ASSET_URLS.descent[3], label: '下沉篇・第三部分' }),
  }),
  ascent: Object.freeze({
    1: Object.freeze({ path: PLAY_MAP_ASSET_URLS.ascent[1], label: '上升篇・第一部分' }),
    2: Object.freeze({ path: PLAY_MAP_ASSET_URLS.ascent[2], label: '上升篇・第二部分' }),
    3: Object.freeze({ path: PLAY_MAP_ASSET_URLS.ascent[3], label: '上升篇・第三部分' }),
  }),
});
const ARC_LABELS = Object.freeze({ descent: '下沉篇', ascent: '上升篇' });
// A 4x world scale intentionally shows only about 60% of the reference map's
// horizontal span, leaving room for the camera to keep the player readable.
const SCALE = 4;
const TILE_SIZE = 24;
const PLAYER_ASSET = PLAYER_ANIMATION_ASSETS.swim[0];
const TILE_ASSETS = PLAY_TILE_ASSETS;
const objectGlyphs = { mine: '✹', weightStone: '●', oxygen: 'O₂', checkpoint: '◎', bubble: '○', torricelli: 'T', razor: '╱' };

const canvas = document.querySelector('#play-canvas');
const context = canvas.getContext('2d');
const stageFrame = document.querySelector('.play-stage-frame');
const mapSelect = document.querySelector('#play-map-select');
const musicArcSelect = document.querySelector('#play-music-arc');
const musicModeSelect = document.querySelector('#play-music-mode');
const damageReductionSelect = document.querySelector('#play-damage-reduction');
const musicController = createMusicController(getMusicTrack({ part: 1, arc: 'descent', mode: 'normal' }));
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
const levelInspect = document.querySelector('#play-experience-track') ?? document.querySelector('#play-level-inspect');
const resonancePanel = document.querySelector('#play-resonance-panel');
const resonanceClose = document.querySelector('#play-resonance-close');
const resonanceCount = document.querySelector('#play-resonance-count');
const resonanceBuffs = document.querySelector('#play-resonance-buffs');
const mapTitle = document.querySelector('#play-map-title');
const cameraReadout = document.querySelector('#play-camera-readout');
const speedReadout = document.querySelector('#play-speed');
const eventsList = document.querySelector('#play-events');
const unlimitedResourcesButton = document.querySelector('#play-unlimited-resources');
const ambientToggle = document.querySelector('#play-ambient-toggle');
const attemptsReadout = document.querySelector('#play-attempts');
const upgradeOverlay = document.querySelector('#play-upgrade-overlay');
const upgradeNote = document.querySelector('#play-upgrade-note');
const upgradeCategories = document.querySelector('#play-upgrade-categories');
const upgradeChoices = document.querySelector('#play-upgrade-choices');
const completionOverlay = document.querySelector('#play-completion-overlay');
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
PLAY_IMAGE_ASSET_PATHS.forEach((path) => { if (images.has(path)) return; const image = new Image(); image.src = path; images.set(path, image); });

let map = null;
let mapArc = 'descent';
let mapPart = 1;
let origin = { x: 40, y: 40 };
let mapBounds = null;
let physicsBounds = null;
let renderIndex = null;
let visibleRenderCells = [];
let visibleRenderEdges = [];
let visibleRenderKey = '';
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
const DAMAGE_REDUCTION_STORAGE_KEY = 'thirst-for-oxygen-play-damage-reduction';
const DAMAGE_REDUCTION_DEFAULT = 0.5;
const DAMAGE_REDUCTION_OPTIONS = new Set([0, 0.3, 0.5, 0.75, 0.9]);
function readDamageReductionPreference() {
  try {
    const storedValue = localStorage.getItem(DAMAGE_REDUCTION_STORAGE_KEY);
    if (storedValue === null) return DAMAGE_REDUCTION_DEFAULT;
    const value = Number(storedValue);
    return DAMAGE_REDUCTION_OPTIONS.has(value) ? value : DAMAGE_REDUCTION_DEFAULT;
  } catch {
    return DAMAGE_REDUCTION_DEFAULT;
  }
}
let playerDamageReduction = readDamageReductionPreference();
damageReductionSelect.value = String(playerDamageReduction);
let lastFrame = performance.now();
let accumulator = 0;
let eventLog = ['拖曳潛水夫，放開即可彈射。'];
let activeCollisionSoundKeys = new Set();
const discoverySession = createDiscoverySession();
let discoveryAcknowledgementTargets = [];
const requestedPart = new URLSearchParams(window.location.search).get('part');
const requestedRoute = new URLSearchParams(window.location.search).get('route');
let combatState = createPlayCombatState();
let katanaState = createPlayKatanaState(1);
let bossRoomState = createPlayBossRoomState(null);
let transitioning = false;
let runCompleted = false;
let awakeningState = createPlayAwakeningState({ enabled: false });
let backgroundLayer = null;
let renderClock = 0;
let hudSlotSignature = '';
let eventLogMarkup = '';
const hudUpdateGate = createPlayUpdateGate(50);

function getMapDefinition(arc = mapArc, part = mapPart) {
  return MAP_ROUTES[arc]?.[part] ?? null;
}

function mapSelectionValue(arc = mapArc, part = mapPart) {
  return `${arc}:${part}`;
}

function parseMapSelection(value) {
  const [arc, rawPart] = String(value).split(':');
  const part = Number(rawPart);
  return MAP_ROUTES[arc]?.[part] ? { arc, part } : { arc: 'descent', part: 1 };
}

function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
function enemySpriteScaleX(facing) { return facing === 'left' ? 1 : -1; }
function activeTilePath(cell) { return TILE_ASSETS[cell.terrain === 'blocked' ? 'blocked' : (cell.gravityLevel ?? 'L0')]; }
function cellCenter(key) { return getHexCenter(getActiveCell(map, key, 'chapter1'), origin); }
function hexPath(ctx, cell, pad = 0, geometry = null) { const center = geometry?.center ?? getHexCenter(cell, origin); const vertices = geometry?.vertices ?? getHexVertices(cell, origin); ctx.beginPath(); vertices.forEach((point, index) => { const dx = point.x - center.x; const dy = point.y - center.y; const length = Math.hypot(dx, dy) || 1; const x = center.x + dx * (1 - pad / length); const y = center.y + dy * (1 - pad / length); if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }); ctx.closePath(); }
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
function drawImageWithSilhouetteOutline(image, x, y, width, height, alpha = 1, radius = 0.55, colour = 'rgba(246, 252, 255, 0.88)', scaleX = 1) {
  context.save();
  context.globalAlpha = alpha;
  context.translate(x, y);
  context.scale(scaleX, 1);
  context.filter = silhouetteFilter(colour, radius);
  context.drawImage(image, -width / 2, -height / 2, width, height);
  context.filter = 'none';
  context.drawImage(image, -width / 2, -height / 2, width, height);
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

function equippedWeapon(weaponId) {
  return combatState.build.weapons.find((entry) => entry.id === weaponId) ?? null;
}

function syncKatanaState() {
  const entry = equippedWeapon('katana');
  if (!entry) {
    katanaState = createPlayKatanaState(1);
    return null;
  }
  if (!katanaState || katanaState.level !== entry.level) katanaState = createPlayKatanaState(entry.level);
  return entry;
}

function setupWorld(nextMap, { previousActor = null } = {}) {
  map = nextMap;
  origin = { x: 36, y: 36 };
  renderIndex = createPlayRenderIndex(map, origin);
  visibleRenderKey = '';
  mapBounds = getOddRRectangularBounds(map, origin);
  physicsBounds = { minX: mapBounds.left + 7, maxX: mapBounds.right - 7, minY: mapBounds.top + 8, maxY: mapBounds.bottom - 8 };
  spawn = chooseSpawn(map);
  actor = createTestActor(spawn);
  setPlayerDamageReduction(actor, playerDamageReduction);
  if (previousActor) {
    actor.health = previousActor.health;
    actor.oxygen = previousActor.oxygen;
    actor.energy = previousActor.energy;
    actor.lives = previousActor.lives;
    actor.maxLives = previousActor.maxLives;
    actor.deathCount = previousActor.deathCount;
  }
  syncPlayCombatBuild(combatState, actor);
  actor.oxygen = Math.min(actor.oxygen, actor.derivedStats?.maxOxygen ?? MAX_OXYGEN);
  enemies = createPlayEnemies(map, mapPart, 'chapter1', origin);
  bossRoomState = createPlayBossRoomState(map);
  syncKatanaState();
  if (!previousActor) worldTime = 0;
  awakeningState = createPlayAwakeningState({
    enabled: mapPart === 1 && !previousActor,
    reducedMotion: window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false,
  });
  camera = { x: 0, y: 0, edgeX: '中段', edgeY: '中段' };
  aimPoint = null;
  trajectory = [];
  activeCollisionSoundKeys.clear();
  discoverySession.activeByGuideKey.clear();
  discoverySession.pendingByGuideKey.clear();
  discoveryAcknowledgementTargets = [];
  const encounterGroupCount = new Set(enemies.map((enemy) => enemy.anchorCellKey)).size;
  const mapDefinition = getMapDefinition();
  eventLog = [
    '拖曳潛水夫，放開即可彈射。',
    `${mapDefinition.label} 已載入。`,
    `已生成 ${enemies.length} 名敵人（${encounterGroupCount} 個遭遇群）。`,
    `目前 Build：${combatState.build.weapons.map((entry) => `${WEAPONS[entry.id]?.name ?? entry.id} Lv.${entry.level}`).join('、')}。`,
  ];
  mapTitle.textContent = `${mapDefinition.label} · ${map.layout.width} × ${map.layout.height}`;
  updateAwakeningPresentation();
  updateCamera();
  updateVisibleRenderEntries(true);
  hudUpdateGate.reset();
  updateHud();
  loadingMask.classList.add('is-hidden');
}

function refillUnlimitedResources() {
  if (!unlimitedResources || !actor) return;
  actor.oxygen = actor.derivedStats?.maxOxygen ?? MAX_OXYGEN;
  actor.energy = MAX_ENERGY;
}

async function loadMap(part, { preserveRun = false, arc = mapArc } = {}) {
  const previousActor = preserveRun ? actor : null;
  if (!preserveRun) {
    combatState = createPlayCombatState();
    runCompleted = false;
    completionOverlay.hidden = true;
  }
  mapArc = MAP_ROUTES[arc] ? arc : 'descent';
  mapPart = MAP_ROUTES[mapArc]?.[Number(part)] ? Number(part) : 1;
  mapSelect.value = mapSelectionValue();
  loadingMask.classList.remove('is-hidden');
  loadingMask.textContent = mapPart === 1 && !preserveRun ? '' : mapArc === 'ascent' ? '正在逆游上升…' : '正在潛入水域…';
  try {
    const response = await fetch(getMapDefinition().path);
    if (!response.ok) throw new Error(`map ${response.status}`);
    setupWorld(await response.json(), { previousActor });
  } catch (error) {
    awakeningState.active = false;
    updateAwakeningPresentation();
    eventLog = [`地圖載入失敗：${error.message}`];
    eventsList.innerHTML = `<li>${eventLog[0]}</li>`;
    loadingMask.classList.remove('is-hidden');
    loadingMask.textContent = '地圖載入失敗';
    console.error('Play map setup failed.', error);
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

function updateVisibleRenderEntries(force = false) {
  if (!renderIndex) return;
  const viewport = { width: canvas.width / SCALE, height: canvas.height / SCALE };
  const bucketSize = 8;
  const indexedCamera = {
    x: Math.floor(camera.x / bucketSize) * bucketSize,
    y: Math.floor(camera.y / bucketSize) * bucketSize,
  };
  const key = `${indexedCamera.x}:${indexedCamera.y}:${viewport.width}:${viewport.height}`;
  if (!force && key === visibleRenderKey) return;
  visibleRenderKey = key;
  visibleRenderCells = getVisiblePlayCells(renderIndex, indexedCamera, viewport, 56);
  visibleRenderEdges = getVisiblePlayEdges(renderIndex, indexedCamera, viewport, 60);
}

function buildBackgroundLayer() {
  const layer = document.createElement('canvas');
  layer.width = canvas.width;
  layer.height = canvas.height;
  const layerContext = layer.getContext('2d');
  const gradient = layerContext.createLinearGradient(0, 0, layer.width, layer.height);
  gradient.addColorStop(0, '#0c3155'); gradient.addColorStop(.5, '#061a31'); gradient.addColorStop(1, '#030e1d');
  layerContext.fillStyle = gradient; layerContext.fillRect(0, 0, layer.width, layer.height);
  layerContext.save(); layerContext.globalAlpha = .13; layerContext.strokeStyle = '#6ee8ff'; layerContext.lineWidth = 1;
  for (let x = -layer.height; x < layer.width + layer.height; x += 88) { layerContext.beginPath(); layerContext.moveTo(x, 0); layerContext.lineTo(x - layer.height * .25, layer.height); layerContext.stroke(); }
  layerContext.restore();
  return layer;
}

function renderBackground() {
  if (!backgroundLayer || backgroundLayer.width !== canvas.width || backgroundLayer.height !== canvas.height) backgroundLayer = buildBackgroundLayer();
  context.drawImage(backgroundLayer, 0, 0);
}

function renderCell(cell, key, geometry = null) {
  const center = geometry?.center ?? getHexCenter(cell, origin);
  context.save();
  hexPath(context, cell, 0, geometry);
  context.clip();
  drawImage(activeTilePath(cell), center.x, center.y, TILE_SIZE * 1.78, TILE_SIZE * 2.03, cell.terrain === 'blocked' ? .98 : .86);
  if (cell.waterLayer === 'T2' && cell.terrain !== 'blocked') { context.fillStyle = 'rgba(11, 16, 49, .24)'; context.fillRect(center.x - TILE_SIZE, center.y - TILE_SIZE, TILE_SIZE * 2, TILE_SIZE * 2); }
  if (cell.terrain === 'water') drawWaterMotion(cell, center);
  (cell.overlays ?? []).forEach((kind) => {
    const visual = getPlayOverlayVisual(kind);
    drawImage(visual.assetPath, center.x, center.y, TILE_SIZE * 1.8, TILE_SIZE * 1.8, .62);
  });
  context.restore();
  if (cell.conditionalGate && !cell.conditionalGate.opened) {
    context.save();
    hexPath(context, cell, 1.3, geometry);
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
  const time = renderClock;
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
  visibleRenderCells.forEach((geometry) => {
    const key = geometry.key;
    const cell = getActiveCell(map, key, 'chapter1');
    const vertices = geometry.vertices;
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

function drawRazorObject(object, x, y, size, outlineColour) {
  const visual = getPlayObjectVisual('razor');
  const blade = images.get(visual.assetPath);
  const axis = images.get(visual.componentAssetPaths[0]);
  if (!blade?.complete || !blade.naturalWidth || !axis?.complete || !axis.naturalWidth) return false;
  const rotationSpeed = getFreeObjectSetting(object, 'rotationSpeed') ?? 180;
  const count = clamp(Math.round(getFreeObjectSetting(object, 'count') ?? 1), 1, 4);
  const rotation = worldTime * rotationSpeed * Math.PI / 180;
  const bladeSize = size;
  const axisSize = size * .26;
  context.save();
  context.translate(x, y);
  context.globalAlpha = .96;
  if (outlineColour) context.filter = silhouetteFilter(outlineColour, .75);
  for (let index = 0; index < count; index += 1) {
    context.save();
    context.rotate(rotation + index * Math.PI * 2 / count);
    context.drawImage(blade, -bladeSize * .08, -bladeSize / 2, bladeSize, bladeSize);
    context.restore();
  }
  context.filter = 'none';
  context.drawImage(axis, -axisSize / 2, -axisSize / 2, axisSize, axisSize);
  context.restore();
  return true;
}

function drawButtonObject(object, x, y, size) {
  const pressed = Boolean(object.pressed);
  const radius = size * .42;
  context.save();
  context.globalAlpha = .96;
  context.fillStyle = 'rgba(11, 23, 38, .9)';
  context.strokeStyle = '#c7efff';
  context.lineWidth = 1.2;
  context.beginPath();
  context.roundRect(x - size * .5, y - size * .23, size, size * .46, size * .12);
  context.fill();
  context.stroke();
  context.fillStyle = pressed ? '#6fd1c0' : '#f3b95f';
  context.beginPath();
  context.arc(x, y + (pressed ? size * .06 : -size * .01), radius, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = pressed ? '#d9fff6' : '#fff0b2';
  context.stroke();
  context.restore();
}

function drawObject(object, x, y) {
  const size = getFreeObjectSetting(object, 'size');
  const guide = getObjectDiscoveryGuide(object.kind);
  const visual = object.kind === 'ink' ? getPlayOverlayVisual('ink') : getPlayObjectVisual(object.kind);
  if (object.kind === 'razor' && drawRazorObject(object, x, y, size, guide?.colour)) return;
  if (object.kind === 'button') {
    drawButtonObject(object, x, y, size);
    return;
  }
  if (!drawImage(visual.assetPath, x, y, size, size, .95, 0, guide?.colour)) { context.save(); context.fillStyle = visual.color ?? '#f5d967'; context.strokeStyle = guide?.colour ?? '#081526'; context.lineWidth = 1; context.beginPath(); context.arc(x, y, size * .42, 0, Math.PI * 2); context.fill(); context.stroke(); context.fillStyle = '#071629'; context.font = `bold ${Math.max(7, size * .42)}px sans-serif`; context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillText(visual.label ?? objectGlyphs[object.kind] ?? '?', x, y); context.restore(); }
}

function drawProgrammaticEdge(visual, geometry, edge, size) {
  if (visual.shape === 'current-chevrons') {
    const direction = getDirectionVector(edge.currentDirection ?? 0);
    context.save();
    context.translate(geometry.midpoint.x, geometry.midpoint.y);
    context.rotate(Math.atan2(direction.y, direction.x));
    context.strokeStyle = visual.color;
    context.shadowColor = visual.color;
    context.shadowBlur = 4;
    context.lineWidth = Math.max(1.1, size * .045);
    [-size * .26, 0, size * .26].forEach((offset) => {
      context.beginPath();
      context.moveTo(offset - size * .12, -size * .16);
      context.lineTo(offset + 1, 0);
      context.lineTo(offset - size * .12, size * .16);
      context.stroke();
    });
    context.restore();
    return;
  }
  if (visual.shape === 'double-barrier') {
    const dx = geometry.edgeEnd.x - geometry.edgeStart.x;
    const dy = geometry.edgeEnd.y - geometry.edgeStart.y;
    const length = Math.hypot(dx, dy) || 1;
    const tangent = { x: dx / length, y: dy / length };
    const normal = { x: -dy / length, y: dx / length };
    const start = { x: geometry.midpoint.x - tangent.x * size * .5, y: geometry.midpoint.y - tangent.y * size * .5 };
    const end = { x: geometry.midpoint.x + tangent.x * size * .5, y: geometry.midpoint.y + tangent.y * size * .5 };
    context.save();
    context.strokeStyle = visual.color;
    context.lineWidth = Math.max(1.15, size * .045);
    [-size * .07, size * .07].forEach((offset) => {
      context.beginPath();
      context.moveTo(start.x + normal.x * offset, start.y + normal.y * offset);
      context.lineTo(end.x + normal.x * offset, end.y + normal.y * offset);
      context.stroke();
    });
    context.restore();
  }
}

function drawEdges() {
  visibleRenderEdges.forEach(({ a, b, key, from, to }) => {
    const edge = getActiveEdge(map, key, 'chapter1') ?? getEdgeBetween(map, a, b, 'chapter1');
    if (!edge || edge.type === 'none') return;
    const fromCell = getActiveCell(map, a, 'chapter1');
    const toCell = getActiveCell(map, b, 'chapter1');
    const geometry = getEdgeAttachmentGeometry(from, to, fromCell?.terrain, toCell?.terrain, {
      edgeLength: HEX_SIZE,
      blockedInset: 1.25,
    });
    if (!geometry) return;
    const mid = geometry.midpoint;
    const visual = getPlayEdgeVisual(edge.type);
    const size = getEdgeSetting(edge, 'size');
    const color = visual.color ?? '#bcecff';
    context.save(); context.strokeStyle = color; context.lineWidth = (edge.type === 'multiPortal' ? 1.5 : 1.05) / SCALE; context.globalAlpha = .84; context.setLineDash(edge.type === 'current' ? [3 / SCALE, 3 / SCALE] : []);
    context.beginPath(); context.moveTo(geometry.edgeStart.x, geometry.edgeStart.y); context.lineTo(geometry.edgeEnd.x, geometry.edgeEnd.y); context.stroke(); context.restore();
    const asset = visual.assetPath;
    if (!asset) {
      drawProgrammaticEdge(visual, geometry, edge, size);
      return;
    }
    const isPortal = edge.type === 'multiPortal' || edge.type === 'layerPortal';
    const isAnchoredPlant = visual.anchoredPlant;
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
    const edgeImage = images.get(asset);
    const aspect = edgeImage?.complete && edgeImage.naturalWidth > 0 && edgeImage.naturalHeight > 0
      ? edgeImage.naturalWidth / edgeImage.naturalHeight
      : 1;
    const width = aspect >= 1 ? size : size * aspect;
    const height = aspect >= 1 ? size / aspect : size;
    drawImage(asset, renderX, renderY, width, height, .92, rotation, getEdgeDiscoveryGuide(edge.type)?.colour);
  });
}

function updateAwakeningPresentation() {
  const awakening = getPlayAwakeningRenderState(awakeningState);
  stageFrame.classList.toggle('is-awakening', awakening.active);
  stageFrame.style.setProperty('--awakening-attempt-opacity', String(awakening.attemptOpacity));
  stageFrame.style.setProperty('--awakening-hud-opacity', String(awakening.hudOpacity));
  return awakening;
}

function drawAwakeningMask() {
  const awakening = updateAwakeningPresentation();
  if (!awakening.maskVisible) return;
  const openness = clamp(awakening.eyeOpenRatio, 0, 1);
  context.save();
  context.fillStyle = '#000000';
  if (openness <= .001) {
    context.fillRect(0, 0, canvas.width, canvas.height);
  } else {
    context.beginPath();
    context.rect(0, 0, canvas.width, canvas.height);
    context.ellipse(
      canvas.width * .5,
      canvas.height * .5,
      canvas.width * .59,
      Math.max(1, canvas.height * .46 * openness),
      0,
      0,
      Math.PI * 2,
    );
    context.fill('evenodd');
    context.beginPath();
    context.ellipse(canvas.width * .5, canvas.height * .5, canvas.width * .59, Math.max(1, canvas.height * .46 * openness), 0, 0, Math.PI * 2);
    context.strokeStyle = `rgba(0, 0, 0, ${.45 + (1 - openness) * .45})`;
    context.lineWidth = 18;
    context.stroke();
  }
  context.restore();
}

function applyPlayEnemyDamage(amount, source, damageType = 'generic') {
  if (!actor || unlimitedResources) return;
  const result = applyDamage(actor, amount, source, damageType);
  if (result.applied > 0) eventLog.push(`受到 ${Math.round(result.applied)} 傷害 · ${source}`);
}

function stepPlayerStatusEffects(dt) {
  if (!actor?.activeEffects) return;
  Object.entries(actor.activeEffects).forEach(([effectId, effectState]) => {
    const remaining = typeof effectState === 'number' ? effectState : Number(effectState?.remaining ?? 0);
    if (effectId === 'venom' && remaining > 0 && !unlimitedResources) {
      applyDamage(actor, getEnemyDamageToPlayer(4 * dt), '毒刺持續傷害', 'ranged');
    }
    const nextRemaining = Math.max(0, remaining - dt);
    if (nextRemaining <= 0) {
      delete actor.activeEffects[effectId];
    } else if (typeof effectState === 'number') {
      actor.activeEffects[effectId] = nextRemaining;
    } else {
      effectState.remaining = nextRemaining;
    }
  });
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
  const animationPath = PLAYER_ANIMATION_ASSETS[animationState]?.[frameIndex] ?? PLAYER_ASSET;
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

function drawExperienceOrbs() {
  combatState.experienceOrbs.forEach((orb, index) => {
    const pulse = 0.72 + Math.sin(worldTime * 4.2 + index) * 0.16;
    context.save();
    context.globalCompositeOperation = 'lighter';
    context.shadowColor = '#b5f7ff';
    context.shadowBlur = 9;
    context.fillStyle = `rgba(133, 237, 255, ${pulse})`;
    context.beginPath();
    context.arc(orb.x, orb.y, (orb.radius ?? 7) * (0.82 + pulse * 0.2), 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = 'rgba(239, 255, 255, .92)';
    context.lineWidth = 0.8;
    context.stroke();
    context.restore();
  });
}

function drawCombatProjectiles() {
  combatState.projectiles.forEach((projectile) => {
    const visual = projectile.visual ?? {};
    if (projectile.weaponId === 'trident') {
      const trailLength = visual.trailLength ?? 28;
      context.save();
      context.globalCompositeOperation = 'lighter';
      context.strokeStyle = visual.colour ?? '#73e6ff';
      context.shadowColor = visual.glowColour ?? '#d9fbff';
      context.shadowBlur = 8;
      context.lineWidth = visual.trailWidth ?? 2.4;
      context.beginPath();
      context.moveTo(projectile.x - Math.cos(projectile.angle) * trailLength, projectile.y - Math.sin(projectile.angle) * trailLength);
      context.lineTo(projectile.x, projectile.y);
      context.stroke();
      context.restore();
      const size = 31 * (visual.spriteScale ?? 0.72);
      if (!drawImage(visual.sprite, projectile.x, projectile.y, size, size * 0.34, 1, projectile.angle)) {
        context.save(); context.translate(projectile.x, projectile.y); context.rotate(projectile.angle); context.fillStyle = visual.colour ?? '#73e6ff'; context.fillRect(-size * .5, -1.2, size, 2.4); context.restore();
      }
      return;
    }
    const length = visual.bulletLength ?? 18;
    const width = visual.bulletWidth ?? 5;
    const colour = visual.bulletColour ?? visual.colour ?? '#8fe8ff';
    context.save();
    context.translate(projectile.x, projectile.y);
    context.rotate(projectile.angle);
    context.globalCompositeOperation = 'lighter';
    context.shadowColor = visual.bulletGlow ?? colour;
    context.shadowBlur = 7;
    context.fillStyle = colour;
    context.strokeStyle = visual.bulletOutline ?? '#efffff';
    context.lineWidth = visual.bulletStyle === 'outlined' ? 1.6 : 0.7;
    context.beginPath();
    context.roundRect(-length * .5, -width * .5, length, width, width * .5);
    if (visual.bulletStyle !== 'outlined') context.fill();
    context.stroke();
    context.restore();
  });
}

function drawCombatEffects() {
  combatState.effects.forEach((effect) => {
    const progress = clamp(effect.elapsed / Math.max(effect.duration, 0.001), 0, 1);
    const alpha = Math.max(0, 1 - progress);
    if (effect.type === 'knifePath' || effect.type === 'knifeSidePath') {
      context.save();
      context.globalCompositeOperation = 'lighter';
      context.globalAlpha = effect.type === 'knifeSidePath' ? alpha * .58 : alpha * .88;
      context.strokeStyle = effect.level >= 3 ? '#eaa7ff' : effect.level >= 2 ? '#ffbd6e' : '#8fe8ff';
      context.shadowColor = context.strokeStyle;
      context.shadowBlur = 8;
      context.lineWidth = effect.type === 'knifeSidePath' ? 2.2 : 5.2;
      context.lineCap = 'round';
      context.beginPath();
      context.moveTo(effect.start.x, effect.start.y);
      context.lineTo(effect.end.x, effect.end.y);
      context.stroke();
      context.restore();
      return;
    }
    if (effect.type === 'knifeStationaryArea') {
      context.save();
      context.globalCompositeOperation = 'lighter';
      context.globalAlpha = .18 + alpha * .24;
      context.fillStyle = '#d6b5ff';
      context.strokeStyle = '#f1d7ff';
      context.lineWidth = 1.2;
      context.beginPath();
      context.arc(effect.x, effect.y, effect.radius * (0.92 + progress * .08), 0, Math.PI * 2);
      context.fill();
      context.stroke();
      context.restore();
      return;
    }
    if (effect.type === 'weaponHit' || effect.type === 'weaponBlocked') {
      context.save();
      context.globalCompositeOperation = 'lighter';
      context.globalAlpha = alpha;
      context.strokeStyle = effect.type === 'weaponBlocked' ? '#78ffc2' : '#fff4cf';
      context.lineWidth = 1.5;
      context.beginPath();
      context.arc(effect.x, effect.y, 4 + progress * 13, 0, Math.PI * 2);
      context.stroke();
      context.restore();
      return;
    }
    if (effect.type === 'lightMachineGunBurst') {
      const weapon = getWeaponStats('lightMachineGun', effect.level);
      const visual = weapon.effect ?? {};
      const sprite = visual.sprite;
      const size = (visual.gunLength ?? 66) * .62;
      drawImage(sprite, effect.x + Math.cos(effect.angle) * 8, effect.y + Math.sin(effect.angle) * 8, size, (visual.gunWidth ?? 14) * .62, Math.max(.3, alpha), effect.angle);
    }
  });
}

function drawStageExit() {
  const stageExit = getPlayStageExitState({ map, mapPart, actor, enemies, origin });
  if (!stageExit.exit) return;
  const { x, y } = stageExit.exit;
  const colour = stageExit.unlocked ? '#7cf2ff' : '#ff9d78';
  const pulse = 1 + Math.sin(worldTime * 2.4) * .08;
  context.save();
  context.globalCompositeOperation = 'lighter';
  context.strokeStyle = colour;
  context.shadowColor = colour;
  context.shadowBlur = 10;
  context.lineWidth = 1.4;
  context.setLineDash(stageExit.unlocked ? [3, 2] : [1, 2]);
  context.beginPath();
  context.arc(x, y, 11 * pulse, 0, Math.PI * 2);
  context.stroke();
  context.setLineDash([]);
  context.font = 'bold 5px system-ui';
  context.textAlign = 'center';
  context.fillStyle = colour;
  context.fillText(stageExit.unlocked ? 'EXIT' : 'BOSS', x, y + 1.8);
  context.restore();
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
  context.strokeStyle = enemy.linkedProtection ? '#78ffc2' : 'rgba(255, 255, 255, .55)';
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

function drawEnemyResonanceBar(enemy, x, y, width, height) {
  const required = Math.max(1, Number(enemy.resonanceRequired) || 1);
  const ratio = enemy.resonanceNeutral ? 1 : clamp((Number(enemy.resonanceProgress) || 0) / required, 0, 1);
  context.save();
  context.globalAlpha = enemy.resonanceNeutral ? 1 : .92;
  context.fillStyle = 'rgba(2, 18, 15, .92)';
  context.fillRect(x - width * .5, y - height * .5, width, height);
  if (ratio > 0) {
    context.fillStyle = enemy.resonanceNeutral ? '#a4ffbb' : '#49e783';
    context.shadowColor = '#52ff96';
    context.shadowBlur = enemy.resonanceNeutral ? 5 : 2;
    context.fillRect(x - width * .5 + .6, y - height * .5 + .6, Math.max(0, (width - 1.2) * ratio), height - 1.2);
  }
  context.shadowBlur = 0;
  context.strokeStyle = enemy.resonanceSource || enemy.resonanceNeutral ? '#a4ffbb' : 'rgba(128, 255, 173, .5)';
  context.lineWidth = .65;
  context.strokeRect(x - width * .5, y - height * .5, width, height);
  context.restore();
}

function drawEnemyResonanceRange(enemy, x, y) {
  if (enemy.resonanceNeutral) return;
  const radius = (enemy.radius ?? 0) + (actor?.radius ?? 0) + RESONANCE_RULES.bodyGrazePadding;
  context.save();
  context.globalCompositeOperation = 'source-over';
  context.fillStyle = 'rgba(73, 231, 131, .09)';
  context.strokeStyle = 'rgba(164, 255, 187, .52)';
  context.lineWidth = .85;
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.restore();
}

function drawEnemies() {
  const viewport = { width: canvas.width / SCALE, height: canvas.height / SCALE };
  enemies.forEach((enemy) => {
    if (enemy.defeated || !isPlayEnemyVisible(enemy, camera, viewport)) return;
    const pose = getPlayEnemyPose(enemy, worldTime);
    const guide = getEnemyDiscoveryGuide(enemy.enemyId);
    const visualState = getPlayEnemyFrameState(enemy, worldTime);
    const image = images.get(visualState.path);
    const imageReady = image?.complete && image.naturalWidth > 0 && image.naturalHeight > 0;
    const height = enemy.renderSize;
    const rawRatio = imageReady ? image.naturalWidth / image.naturalHeight : 1;
    const width = height * clamp(rawRatio, 0.72, 1.65);
    const barWidth = Math.max(18, width * .72);
    const healthBarY = pose.y - height * .62;
    drawEnemyResonanceRange(enemy, pose.x, pose.y);
    drawEnemyHealthBar(enemy, pose.x, healthBarY, barWidth, 3.1);
    drawEnemyResonanceBar(enemy, pose.x, healthBarY + 4.2, barWidth, 2.4);

    context.save();
    context.globalCompositeOperation = 'screen';
    context.globalAlpha = .2;
    context.fillStyle = enemy.resonanceNeutral ? '#62ff9f' : enemy.tier >= 3 ? '#a785ff' : '#4edcff';
    context.beginPath();
    context.ellipse(pose.x, pose.y + height * .25, width * .42, height * .24, 0, 0, Math.PI * 2);
    context.fill();
    context.restore();

    if (imageReady) {
      drawImageWithSilhouetteOutline(image, pose.x, pose.y, width, height, .96, .75, enemy.resonanceNeutral ? '#8dffb5' : guide?.colour, enemySpriteScaleX(enemy.facing));
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

function drawEnemyCombatRuntime() {
  const runtime = getPlayEnemyRenderState(enemies, worldTime);
  runtime.zones.forEach((zone) => {
    const duration = zone.phase === 'bubble'
      ? zone.bubbleLifetime
      : zone.phase === 'oxygenZone'
        ? zone.oxygenZoneDuration
        : zone.duration ?? .28;
    const progress = 1 - clamp(zone.remaining / Math.max(duration ?? .28, .001), 0, 1);
    context.save();
    context.globalCompositeOperation = 'lighter';
    context.globalAlpha = .28 + progress * .35;
    context.fillStyle = zone.type === 'corruptOxygen' ? (zone.phase === 'bubble' ? '#8c63d6' : '#55218a') : '#9d78ff';
    context.strokeStyle = zone.type === 'corruptOxygen' ? '#d9a8ff' : '#e0cfff';
    context.lineWidth = 1.2;
    if (zone.type === 'reflectedBeam') {
      context.setLineDash([5, 2]);
      context.shadowColor = '#bfefff';
      context.shadowBlur = 8;
      context.lineWidth = 2.4;
      context.beginPath();
      context.moveTo(zone.x, zone.y);
      context.lineTo(zone.targetX, zone.targetY);
      context.stroke();
      context.restore();
      return;
    }
    if (zone.phase === 'oxygenZone') context.setLineDash([3, 2]);
    context.beginPath();
    context.arc(zone.x, zone.y, zone.radius, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.restore();
  });
  runtime.rules.forEach((rule) => {
    const owner = enemies.find((enemy) => enemy.instanceId === rule.ownerId && !enemy.defeated);
    if (!owner) return;
    const duration = Math.max(rule.duration ?? rule.remaining ?? 1, .001);
    const progress = 1 - clamp(rule.remaining / duration, 0, 1);
    const colour = rule.type === 'speedForm' ? '#ff90d8'
      : rule.type === 'rebuildArena' ? '#7fffc4'
        : rule.type === 'tidalLaw' ? '#6de5ff'
          : '#c59cff';
    context.save();
    context.globalCompositeOperation = 'lighter';
    context.globalAlpha = .28 + (1 - progress) * .38;
    context.strokeStyle = colour;
    context.shadowColor = colour;
    context.shadowBlur = 8;
    context.lineWidth = 1.4;
    context.setLineDash([3, 2]);
    context.beginPath();
    context.arc(rule.x ?? owner.x, rule.y ?? owner.y, rule.radius ?? owner.radius + 8 + Math.sin(worldTime * 4) * 2, 0, Math.PI * 2);
    context.stroke();
    context.restore();
  });
  runtime.summons.filter((summon) => summon.status === 'active').forEach((summon) => {
    const owner = enemies.find((enemy) => enemy.instanceId === summon.ownerId && !enemy.defeated);
    if (!owner) return;
    context.save();
    context.globalCompositeOperation = 'lighter';
    context.globalAlpha = .32;
    context.strokeStyle = '#72e8ff';
    context.lineWidth = .8;
    (summon.spawnedIds ?? []).forEach((targetId) => {
      const target = enemies.find((enemy) => enemy.instanceId === targetId && !enemy.defeated);
      if (!target) return;
      context.beginPath();
      context.moveTo(owner.x, owner.y);
      context.lineTo(target.x, target.y);
      context.stroke();
    });
    context.restore();
  });
  runtime.effects.forEach((effect) => {
    const progress = clamp(effect.elapsed / Math.max(effect.duration, .001), 0, 1);
    const alpha = Math.max(0, 1 - progress);
    if (['telegraph', 'lockedTarget', 'detonationTelegraph'].includes(effect.type)) {
      context.save();
      context.globalCompositeOperation = 'lighter';
      context.globalAlpha = .28 + alpha * .45;
      context.strokeStyle = effect.type === 'lockedTarget' ? '#ff8f78' : '#e5b2ff';
      context.lineWidth = 1.2;
      context.setLineDash([3, 2]);
      context.beginPath();
      context.arc(effect.x, effect.y, Math.min(effect.radius ?? 24, 92), 0, Math.PI * 2);
      context.stroke();
      context.restore();
      return;
    }
    if (['detonation', 'areaImpact', 'areaStun', 'gravityField', 'supportPulse', 'summon', 'resonanceComplete'].includes(effect.type)) {
      context.save();
      context.globalCompositeOperation = 'lighter';
      context.globalAlpha = alpha * .72;
      context.strokeStyle = effect.type === 'resonanceComplete' ? '#76ffa8' : effect.type === 'supportPulse' ? '#7fffc4' : effect.type === 'summon' ? '#8fe8ff' : '#ff9d78';
      context.shadowColor = context.strokeStyle;
      context.shadowBlur = 10;
      context.lineWidth = 2;
      context.beginPath();
      context.arc(effect.x, effect.y, (effect.radius ?? 20) * (.35 + progress * .8), 0, Math.PI * 2);
      context.stroke();
      context.restore();
      return;
    }
    if (['resourceDrain', 'tidalLaw', 'sacrifice', 'rebuildArena', 'speedForm', 'gravityDominion', 'corruptedOxygenBubble', 'corruptedOxygenExplosion', 'tidalShield', 'abyssAwakening'].includes(effect.type)) {
      const colour = ['resourceDrain', 'corruptedOxygenBubble', 'corruptedOxygenExplosion'].includes(effect.type) ? '#d08cff'
        : ['sacrifice', 'speedForm', 'abyssAwakening'].includes(effect.type) ? '#ff8acb'
          : ['rebuildArena', 'tidalShield'].includes(effect.type) ? '#78ffc2'
            : '#7ee8ff';
      context.save();
      context.globalCompositeOperation = 'lighter';
      context.globalAlpha = alpha * .76;
      context.strokeStyle = colour;
      context.shadowColor = colour;
      context.shadowBlur = 9;
      context.lineWidth = 1.8;
      context.setLineDash(effect.type === 'gravityDominion' || effect.type === 'tidalLaw' ? [3, 2] : []);
      context.beginPath();
      context.arc(effect.x, effect.y, (effect.radius ?? 18) * (.5 + progress * .9), 0, Math.PI * 2);
      context.stroke();
      context.restore();
      return;
    }
    if (effect.type === 'unsupportedSkill') {
      context.save();
      context.globalAlpha = alpha * .8;
      context.strokeStyle = '#f6d979';
      context.lineWidth = 1;
      context.setLineDash([2, 2]);
      context.beginPath();
      context.moveTo(effect.x, effect.y);
      context.lineTo(effect.targetX, effect.targetY);
      context.stroke();
      context.restore();
    }
  });
  runtime.enemies.forEach((entry) => {
    const source = enemies.find((enemy) => enemy.instanceId === entry.instanceId);
    if (!source || !entry.linkedTargets.length) return;
    context.save();
    context.globalCompositeOperation = 'lighter';
    context.strokeStyle = '#78ffc2';
    context.globalAlpha = .58;
    context.lineWidth = 1;
    entry.linkedTargets.forEach((targetId) => {
      const target = enemies.find((enemy) => enemy.instanceId === targetId && !enemy.defeated);
      if (!target) return;
      context.beginPath();
      context.moveTo(source.x, source.y);
      context.lineTo(target.x, target.y);
      context.stroke();
    });
    context.restore();
  });
  runtime.projectiles.forEach((projectile) => {
    const length = 12;
    context.save();
    context.translate(projectile.x, projectile.y);
    context.rotate(projectile.angle);
    context.globalCompositeOperation = 'lighter';
    context.shadowColor = projectile.colour ?? '#a5e8ff';
    context.shadowBlur = 7;
    context.strokeStyle = projectile.colour ?? '#a5e8ff';
    context.lineWidth = Math.max(2, projectile.radius * .7);
    context.lineCap = 'round';
    context.beginPath();
    context.moveTo(-length, 0);
    context.lineTo(length * .4, 0);
    context.stroke();
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
  visibleRenderCells.forEach(({ key: cellKey, center }) => {
    const cell = getActiveCell(map, cellKey, 'chapter1');
    if (cell.conditionalGate && !cell.conditionalGate.opened && isWorldTargetVisible(center.x, center.y, TILE_SIZE)) {
      targets.push({ instanceId: `gate:${cellKey}`, guideKey: 'gate:conditional', guide: CONDITIONAL_GATE_GUIDE, x: center.x, y: center.y, size: TILE_SIZE });
    }
    (cell.objects ?? []).forEach((object, index) => {
      const guide = getObjectDiscoveryGuide(object.kind);
      if (!guide) return;
      const x = center.x + Math.cos(index * 2.5) * 2;
      const y = center.y + Math.sin(index * 2.5) * 2;
      const size = getFreeObjectSetting(object, 'size');
      if (isWorldTargetVisible(x, y, size)) targets.push({ instanceId: `cell-object:${cellKey}:${index}`, guideKey: `object:${object.kind}`, guide, x, y, size });
    });
    (cell.freeObjects ?? []).forEach((object, index) => {
      const guide = getObjectDiscoveryGuide(object.kind);
      if (!guide) return;
      const offset = object.offset ?? { x: 0, y: 0 };
      const x = center.x + offset.x;
      const y = center.y + offset.y;
      const size = getFreeObjectSetting(object, 'size');
      if (isWorldTargetVisible(x, y, size)) targets.push({ instanceId: `free-object:${cellKey}:${index}`, guideKey: `object:${object.kind}`, guide, x, y, size });
    });
  });

  visibleRenderEdges.forEach(({ a, b, key, x, y }) => {
    const edge = getActiveEdge(map, key, 'chapter1') ?? getEdgeBetween(map, a, b, 'chapter1');
    const guide = getEdgeDiscoveryGuide(edge?.type);
    if (!guide) return;
    const size = getEdgeSetting(edge, 'size');
    if (isWorldTargetVisible(x, y, size)) targets.push({ instanceId: `edge:${key}`, guideKey: `edge:${edge.type}`, guide, x, y, size });
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

function drawInkVisibilityMask() {
  if (!actor?.inInk) return;
  const centerX = (actor.x - camera.x) * SCALE;
  const centerY = (actor.y - camera.y) * SCALE;
  const radius = Math.max(36, (actor.inkVisionRange ?? 42) * SCALE);
  context.save();
  context.fillStyle = 'rgba(2, 5, 16, .9)';
  context.beginPath();
  context.rect(0, 0, canvas.width, canvas.height);
  context.arc(centerX, centerY, radius, 0, Math.PI * 2, true);
  context.fill('evenodd');
  context.strokeStyle = 'rgba(122, 94, 184, .52)';
  context.lineWidth = 7;
  context.shadowColor = '#7159ad';
  context.shadowBlur = 18;
  context.beginPath();
  context.arc(centerX, centerY, radius, 0, Math.PI * 2);
  context.stroke();
  context.restore();
}

function render() {
  renderBackground();
  if (!map || !actor) return;
  updateVisibleRenderEntries();
  context.save(); context.scale(SCALE, SCALE); context.translate(-camera.x, -camera.y);
  visibleRenderCells.forEach((geometry) => renderCell(getActiveCell(map, geometry.key, 'chapter1'), geometry.key, geometry));
  drawTerrainBoundaries(); drawEdges(); drawStageExit(); drawExperienceOrbs(); drawCombatEffects(); drawEnemyCombatRuntime(); drawEnemies(); drawCombatProjectiles(); drawTrajectory(); drawActor(); drawKatanaEffects();
  const activeGuides = updateDiscoverySession(discoverySession, collectVisibleDiscoverables(), worldTime);
  discoveryAcknowledgementTargets = drawDiscoveryGuides(context, activeGuides, camera, { width: canvas.width / SCALE, height: canvas.height / SCALE }, worldTime);
  context.restore();
  drawInkVisibilityMask();
  drawAwakeningMask();
}

function updateHud() {
  if (!actor) return;
  updateHudIconSlots();
  updateUpgradeOverlay();
  const combatRenderState = getPlayCombatHudState(combatState);
  const progress = combatRenderState.progression;
  const firstRowCenterY = (mapBounds?.top ?? origin.y) + HEX_SIZE;
  const lastRowCenterY = (mapBounds?.bottom ?? origin.y) - HEX_SIZE;
  const routeMeters = mapArc === 'ascent'
    ? Math.max(0, Math.round((lastRowCenterY - actor.y) / (HEX_SIZE * 1.5)))
    : Math.max(0, Math.round((actor.y - firstRowCenterY) / (HEX_SIZE * 1.5)));
  depthReadout.previousElementSibling.textContent = mapArc === 'ascent' ? 'ASCENT' : 'DEPTH';
  depthReadout.textContent = `${String(routeMeters).padStart(3, '0')} m`;
  depthReadout.setAttribute('aria-label', `目前${mapArc === 'ascent' ? '上升' : '下沉'} ${routeMeters} 公尺`);
  levelReadout.textContent = String(progress.level).padStart(2, '0');
  experienceReadout.textContent = progress.atMaxLevel
    ? `EXP ${String(Math.floor(progress.current)).padStart(3, '0')} / MAX`
    : `EXP ${String(Math.floor(progress.current)).padStart(3, '0')} / ${progress.required}`;
  experienceFill.style.width = `${progress.ratio * 100}%`;
  updateResonancePanel(combatRenderState.resonance);
  const attempt = getPlayAttemptState(actor);
  attemptsReadout.textContent = attempt.label;
  attemptsReadout.setAttribute('aria-label', `剩餘嘗試次數 ${attempt.remaining}，共 ${attempt.maximum} 次`);
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
  speedReadout.textContent = `速度 ${Math.round(Math.hypot(actor.vx, actor.vy))} m/s`;
  const nextEventLogMarkup = eventLog.slice(-5).reverse().map((message) => `<li>${message}</li>`).join('');
  if (nextEventLogMarkup !== eventLogMarkup) {
    eventLogMarkup = nextEventLogMarkup;
    eventsList.innerHTML = nextEventLogMarkup;
  }
}

function updateHudIfDue(now) {
  if (hudUpdateGate.shouldUpdate(now)) updateHud();
}

let resonanceUiSignature = '';
function setResonancePanelOpen(open) {
  if (!resonancePanel || !levelInspect) return;
  resonancePanel.hidden = !open;
  levelInspect.setAttribute('aria-expanded', String(open));
  if (open) {
    resonanceUiSignature = '';
    updateResonancePanel(getPlayCombatRenderState(combatState).resonance);
  }
}

function updateResonancePanel(resonance) {
  if (!resonanceCount || !resonanceBuffs) return;
  const buffs = resonance?.buffs ?? [];
  resonanceCount.textContent = `RESONANCE ${resonance?.totalStacks ?? 0}`;
  const signature = JSON.stringify(buffs.map(({ enemyId, stacks, maxStacks }) => [enemyId, stacks, maxStacks]));
  if (signature === resonanceUiSignature) return;
  resonanceUiSignature = signature;
  resonanceBuffs.innerHTML = buffs.length ? buffs.map((entry) => `
    <article class="resonance-buff${entry.atCap ? ' is-capped' : ''}">
      <strong>${entry.name}<small>${entry.combatStyle === 'melee' ? '近戰快速共鳴' : '遠程擦彈共鳴'}</small></strong>
      <b>×${entry.stacks}/${entry.maxStacks}</b>
      <p>${entry.description}</p>
    </article>`).join('') : '<p class="resonance-empty">尚未取得 Resonance Buff。</p>';
}

function updateHudIconSlots() {
  const slots = getPlayerHudSlots(combatState.build);
  const signature = slots.map(({ key, id, level, path }) => `${key}:${id ?? ''}:${level ?? 0}:${path ?? ''}`).join('|');
  if (signature === hudSlotSignature) return;
  hudSlotSignature = signature;
  const slotRoot = document.querySelector('.visor-icon-slots');
  if (slotRoot) {
    if (!slotRoot.querySelector('[data-visor-group-label="weapon"]')) {
      const label = document.createElement('span');
      label.className = 'visor-group-label visor-group-label-weapon';
      label.dataset.visorGroupLabel = 'weapon';
      label.textContent = '武器\n槽位';
      slotRoot.append(label);
    }
    if (!slotRoot.querySelector('[data-visor-group-label="passive"]')) {
      const label = document.createElement('span');
      label.className = 'visor-group-label visor-group-label-passive';
      label.dataset.visorGroupLabel = 'passive';
      label.textContent = '被動\n能力';
      slotRoot.append(label);
    }
  }
  visorSlots.forEach((slotElement, index) => {
    const slot = slots[index];
    const icon = slotElement.querySelector('[data-visor-icon]');
    if (!slot || !icon) return;
    let label = slotElement.querySelector('[data-visor-slot-label]');
    if (!label) {
      label = document.createElement('small');
      label.className = 'visor-slot-label';
      label.dataset.visorSlotLabel = '';
      slotElement.append(label);
    }
    const filled = Boolean(slot.path);
    slotElement.dataset.visorFilled = String(filled);
    label.hidden = !filled;
    label.textContent = getPlayerHudSlotLabel(slot);
    if (!filled) {
      icon.hidden = true;
      icon.removeAttribute('src');
      slotElement.setAttribute('aria-label', `${slotElement.dataset.visorSlotKind === 'weapon' ? '主動武器' : '被動能力'}空槽`);
      return;
    }
    icon.src = slot.path;
    icon.alt = getPlayerHudSlotLabel(slot);
    icon.hidden = false;
    slotElement.setAttribute('aria-label', getPlayerHudSlotLabel(slot));
  });
}

let upgradeUiSignature = '';

function createUpgradeDeckButton(category) {
  const isWeapon = category === 'weapon';
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `upgrade-deck upgrade-deck-${category}`;
  button.dataset.upgradeCategory = category;
  button.setAttribute('aria-label', isWeapon ? '選定武器牌組並抽取兩張卡' : '選定被動牌組並抽取兩張卡');

  const cardFan = document.createElement('span');
  cardFan.className = 'upgrade-deck-fan';
  cardFan.setAttribute('aria-hidden', 'true');
  cardFan.append(document.createElement('i'), document.createElement('i'), document.createElement('i'));

  const copy = document.createElement('span');
  copy.className = 'upgrade-deck-copy';
  const overline = document.createElement('small');
  overline.textContent = isWeapon ? 'ARSENAL FATE' : 'BIOLOGICAL FATE';
  const title = document.createElement('strong');
  title.textContent = isWeapon ? '武器牌組' : '被動牌組';
  const detail = document.createElement('span');
  detail.textContent = isWeapon ? '抽取兩張武器進化卡' : '抽取兩張被動進化卡';
  copy.append(overline, title, detail);

  const commit = document.createElement('span');
  commit.className = 'upgrade-deck-commit';
  commit.textContent = '選定牌組';
  button.append(cardFan, copy, commit);
  return button;
}

function createLockedUpgradeDeck(category) {
  const isWeapon = category === 'weapon';
  const locked = document.createElement('div');
  locked.className = `upgrade-deck-lock upgrade-deck-lock-${category}`;
  locked.dataset.upgradeLockedCategory = category;
  const seal = document.createElement('span');
  seal.className = 'upgrade-deck-seal';
  seal.setAttribute('aria-hidden', 'true');
  seal.textContent = '✦';
  const copy = document.createElement('span');
  const label = document.createElement('small');
  label.textContent = 'FATE SEALED';
  const title = document.createElement('strong');
  title.textContent = isWeapon ? '武器牌組已鎖定' : '被動牌組已鎖定';
  copy.append(label, title);
  const rule = document.createElement('span');
  rule.textContent = '本次抽取不可切換牌組';
  locked.append(seal, copy, rule);
  return locked;
}

function createUpgradeCard(choice, index) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `upgrade-card upgrade-card-${choice.category}`;
  button.style.setProperty('--deal-index', String(index));
  button.dataset.upgradeChoice = 'true';
  button.dataset.upgradeCategory = choice.category;
  button.dataset.upgradeAction = choice.action;
  button.dataset.upgradeId = choice.id;
  button.dataset.upgradeLevel = String(choice.level);
  button.setAttribute('aria-label', `${choice.label}：${choice.detail}`);

  const inner = document.createElement('span');
  inner.className = 'upgrade-card-inner';
  const back = document.createElement('span');
  back.className = 'upgrade-card-face upgrade-card-back';
  const backMark = document.createElement('b');
  backMark.textContent = 'O₂';
  const backTitle = document.createElement('small');
  backTitle.textContent = 'ABYSSAL EVOLUTION';
  back.append(backMark, backTitle);

  const front = document.createElement('span');
  front.className = 'upgrade-card-face upgrade-card-front';
  const level = document.createElement('span');
  level.className = 'upgrade-card-level';
  level.textContent = `LEVEL ${String(choice.level).padStart(2, '0')}`;
  const iconFrame = document.createElement('span');
  iconFrame.className = 'upgrade-card-icon';
  const icon = document.createElement('img');
  icon.src = choice.icon;
  icon.alt = choice.label;
  iconFrame.append(icon);
  const kind = document.createElement('small');
  kind.className = 'upgrade-card-kind';
  kind.textContent = choice.action === 'acquire' ? 'NEW EVOLUTION' : 'EVOLUTION';
  const title = document.createElement('strong');
  title.textContent = choice.name ?? choice.label;
  const detail = document.createElement('span');
  detail.className = 'upgrade-card-detail';
  detail.textContent = choice.detail;
  const choose = document.createElement('span');
  choose.className = 'upgrade-card-select';
  choose.textContent = '選擇此卡';
  front.append(level, iconFrame, kind, title, detail, choose);
  inner.append(back, front);
  button.append(inner);
  return button;
}

function updateUpgradeOverlay() {
  if (!combatState.awaitingUpgrade) {
    upgradeOverlay.hidden = true;
    upgradeUiSignature = '';
    return;
  }
  upgradeOverlay.hidden = false;
  const signature = JSON.stringify({
    category: combatState.upgradeCategory,
    categories: combatState.upgradeCategories,
    choices: combatState.upgradeChoices,
    pending: combatState.progression.pendingLevelUps,
  });
  if (signature === upgradeUiSignature) return;
  upgradeUiSignature = signature;
  upgradeNote.textContent = combatState.upgradeCategory
    ? `${combatState.upgradeCategory === 'weapon' ? '武器' : '被動'}牌組已封印。從翻開的兩張卡中選擇一張。`
    : `還有 ${combatState.progression.pendingLevelUps} 次升級待選；選定一個牌組，選定後本次不可更換。`;
  upgradeCategories.classList.toggle('is-locked', Boolean(combatState.upgradeCategory));
  upgradeCategories.replaceChildren(...(
    combatState.upgradeCategory
      ? [createLockedUpgradeDeck(combatState.upgradeCategory)]
      : combatState.upgradeCategories.map(createUpgradeDeckButton)
  ));
  if (!combatState.upgradeCategory) {
    upgradeChoices.replaceChildren();
    upgradeChoices.classList.remove('is-dealt');
    return;
  }
  upgradeChoices.classList.add('is-dealt');
  upgradeChoices.replaceChildren(...combatState.upgradeChoices.map(createUpgradeCard));
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
  if (paused || awakeningState.active || actor.dead || (actor.stunnedUntil ?? 0) > worldTime || combatState.awaitingUpgrade || (actor.launchLockTimer ?? 0) > 0) return;
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
canvas.addEventListener('pointerup', (event) => { if (!dragging) return; dragging = false; if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId); aimPoint = screenToWorld(canvasPoint(event)); if ((actor.stunnedUntil ?? 0) > worldTime) { eventLog.push('暈眩中，暫時無法彈射。'); trajectory = []; updateHud(); return; } refillUnlimitedResources(); const result = launchActor(actor, aimPoint); if (result.launched) { sfxController.play('launch'); eventLog.push(`彈射 ${Math.round(result.distance)} px · 初速度 ${Math.round(result.speed)} · 能量 -${Math.ceil(result.costs.energy)} · 氧氣持續倒數`); } else { sfxController.play('button', { volumeMultiplier: .55 }); eventLog.push(result.reason === 'energy' ? '能量不足，無法彈射。' : result.reason === 'bubbleLock' ? '光合作用氣泡作用中，暫時無法彈射。' : '這次彈射距離太短。'); } trajectory = []; updateHud(); });
canvas.addEventListener('pointercancel', () => { dragging = false; trajectory = []; lastTrajectoryAt = -Infinity; });
canvas.addEventListener('lostpointercapture', () => { dragging = false; trajectory = []; lastTrajectoryAt = -Infinity; });
resetButton.addEventListener('click', () => { if (!actor || actor.gameOver) return; sfxController.play('button'); activeCollisionSoundKeys.clear(); const resetActor = createTestActor(actor.spawn ?? spawn); resetActor.lives = actor.lives; resetActor.maxLives = actor.maxLives; setPlayerDamageReduction(resetActor, playerDamageReduction); Object.assign(actor, resetActor, { activeEffects: {}, stunnedUntil: 0 }); syncPlayCombatBuild(combatState, actor); syncKatanaState(); eventLog.push('主角已回到最近的安全水域；Build、減傷與篇章進度保留。'); updateCamera(); updateHud(); });
pauseButton.addEventListener('click', () => { sfxController.play('menuSelection'); paused = !paused; pauseButton.textContent = paused ? '▶ 繼續' : 'Ⅱ 暫停'; pauseButton.setAttribute('aria-pressed', String(paused)); });
unlimitedResourcesButton.addEventListener('click', () => { sfxController.play('button'); unlimitedResources = !unlimitedResources; unlimitedResourcesButton.classList.toggle('is-active', unlimitedResources); unlimitedResourcesButton.setAttribute('aria-pressed', String(unlimitedResources)); unlimitedResourcesButton.textContent = unlimitedResources ? '∞ 無限氧氣／能量：開' : '∞ 無限氧氣／能量：關'; refillUnlimitedResources(); updateHud(); });
damageReductionSelect.addEventListener('change', () => {
  const requestedReduction = Number(damageReductionSelect.value);
  playerDamageReduction = DAMAGE_REDUCTION_OPTIONS.has(requestedReduction) ? requestedReduction : DAMAGE_REDUCTION_DEFAULT;
  damageReductionSelect.value = String(playerDamageReduction);
  if (actor) setPlayerDamageReduction(actor, playerDamageReduction);
  try { localStorage.setItem(DAMAGE_REDUCTION_STORAGE_KEY, String(playerDamageReduction)); } catch { /* Storage may be disabled; the current run still keeps the selection. */ }
  sfxController.play('menuSelection');
  eventLog.push(`玩家減傷已調整為 ${Math.round(playerDamageReduction * 100)}%。`);
  updateHud();
});
ambientToggle.addEventListener('click', () => { ambientEnabled = !ambientEnabled; ambientToggle.setAttribute('aria-pressed', String(ambientEnabled)); ambientToggle.textContent = `${ambientEnabled ? '◉' : '○'} 潛水環境音（240 秒循環）：${ambientEnabled ? '開' : '關'}`; if (ambientEnabled) sfxController.startAmbient(); else sfxController.stopAmbient(); });
settingsToggle.addEventListener('click', () => { sfxController.play('menuSelection'); setSettingsOpen(settingsPanel.hidden); });
settingsClose.addEventListener('click', () => { sfxController.play('button'); setSettingsOpen(false); });
levelInspect?.addEventListener('click', () => { sfxController.play('menuSelection'); setResonancePanelOpen(resonancePanel?.hidden ?? true); });
resonanceClose?.addEventListener('click', () => { sfxController.play('button'); setResonancePanelOpen(false); levelInspect?.focus(); });
exitButton.addEventListener('click', () => { sfxController.play('button'); window.location.href = '/home.html'; });
function syncMusicTrack() {
  musicController.setTrack(getMusicTrack({ part: mapPart, arc: musicArcSelect.value, mode: musicModeSelect.value }));
}

function beginStageTransition(nextPart) {
  if (transitioning || !getMapDefinition(mapArc, nextPart)) return;
  transitioning = true;
  accumulator = 0;
  loadingMask.classList.remove('is-hidden');
  loadingMask.textContent = `前往${getMapDefinition(mapArc, nextPart).label}…`;
  mapSelect.value = mapSelectionValue(mapArc, nextPart);
  mapPart = nextPart;
  syncMusicTrack();
  loadMap(nextPart, { preserveRun: true, arc: mapArc })
    .then(() => { eventLog.push('跨段完成：生命、氧氣、能量、經驗與 Build 已保留。'); })
    .finally(() => { transitioning = false; });
}

function beginArcTransition(nextArc, nextPart = 1) {
  if (transitioning || !getMapDefinition(nextArc, nextPart)) return;
  transitioning = true;
  accumulator = 0;
  mapArc = nextArc;
  mapPart = nextPart;
  mapSelect.value = mapSelectionValue(mapArc, mapPart);
  musicArcSelect.value = mapArc === 'ascent' ? 'ascent20' : 'descent';
  syncMusicTrack();
  loadingMask.classList.remove('is-hidden');
  loadingMask.textContent = `共鳴能力保留，前往${getMapDefinition().label}…`;
  loadMap(mapPart, { preserveRun: true, arc: mapArc })
    .then(() => { eventLog.push('下沉→上升：生命、資源、Build 與 Resonance 永久 Buff 全數保留。'); })
    .finally(() => { transitioning = false; });
}
mapSelect.addEventListener('change', () => {
  sfxController.play('menuSelection');
  const selection = parseMapSelection(mapSelect.value);
  mapArc = selection.arc;
  mapPart = selection.part;
  musicArcSelect.value = mapArc === 'ascent' ? 'ascent20' : 'descent';
  syncMusicTrack();
  loadMap(mapPart, { arc: mapArc });
});
upgradeCategories.addEventListener('click', (event) => {
  const button = event.target.closest('[data-upgrade-category]');
  if (!button) return;
  sfxController.play('menuSelection');
  choosePlayUpgradeCategory(combatState, button.dataset.upgradeCategory);
  upgradeUiSignature = '';
  updateHud();
});
upgradeChoices.addEventListener('click', (event) => {
  const button = event.target.closest('[data-upgrade-choice]');
  if (!button) return;
  sfxController.play('button');
  const result = choosePlayUpgrade(combatState, {
    category: button.dataset.upgradeCategory,
    action: button.dataset.upgradeAction,
    id: button.dataset.upgradeId,
    level: Number(button.dataset.upgradeLevel),
  }, actor);
  if (result.ok) {
    syncKatanaState();
    eventLog.push(`Build 已更新：${result.choice.label}。`);
  }
  upgradeUiSignature = '';
  updateHud();
});
musicArcSelect.addEventListener('change', () => { sfxController.play('menuSelection'); syncMusicTrack(); });
musicModeSelect.addEventListener('change', () => { sfxController.play('menuSelection'); syncMusicTrack(); });
window.addEventListener('keydown', (event) => {
  if (event.key.toLowerCase() === 'r') resetButton.click();
  if (event.key.toLowerCase() === 'e' && map && actor && !actor.gameOver) {
    const result = toggleSeaweedAttachment(actor, map, 'chapter1', origin);
    eventLog.push(result.message);
    updateHud();
  }
  if (event.code === 'Space') { event.preventDefault(); pauseButton.click(); }
  if (event.key === 'Escape') {
    if (!settingsPanel.hidden) setSettingsOpen(false);
    if (resonancePanel && !resonancePanel.hidden) setResonancePanelOpen(false);
  }
});

function simulate(elapsed, now = performance.now()) {
  const scaledElapsed = scaleSimulationDelta(elapsed, dragging);
  renderClock += scaledElapsed;
  if (awakeningState.active) {
    stepPlayAwakening(awakeningState, scaledElapsed);
    updateAwakeningPresentation();
    updateHudIfDue(now);
    return;
  }
  if (!paused && !transitioning && !runCompleted && map && actor && !actor.gameOver) {
    if (combatState.awaitingUpgrade) {
      accumulator = 0;
      updateHudIfDue(now);
      return;
    }
    accumulator += Math.min(.1, scaledElapsed);
    while (accumulator >= FIXED_STEP) {
      worldTime += FIXED_STEP;
      refillUnlimitedResources();
      const previousPosition = { x: actor.x, y: actor.y };
      addEvents(stepPhysics({ map, chapter: 'chapter1', actor, dt: FIXED_STEP, origin, bounds: physicsBounds, mutateMap: true, time: now / 1000 }));
      if (actor.launchLockTimer > 0 && dragging) {
        dragging = false;
        aimPoint = null;
        trajectory = [];
        lastTrajectoryAt = -Infinity;
      }
      const katanaEntry = syncKatanaState();
      if (katanaEntry) markPlayKatanaMovement(katanaState, Math.hypot(actor.x - previousPosition.x, actor.y - previousPosition.y));
      const enemyResult = updatePlayEnemies(enemies, actor, FIXED_STEP, worldTime, applyPlayEnemyDamage, physicsBounds, {
        map,
        chapter: 'chapter1',
        origin,
        resonanceState: combatState.resonance,
      });
      if (enemyResult?.resonanceEvents?.length) {
        syncPlayCombatBuild(combatState, actor);
        enemyResult.resonanceEvents.forEach((entry) => {
          eventLog.push(entry.stackGained && entry.buff
            ? `RESONANCE 完成：${entry.enemyName}成為中立夥伴；「${entry.buff.name}」提升至 ${entry.stackCount}/${entry.maxStacks} 層，不提供 EXP。`
            : `RESONANCE 完成：${entry.enemyName}成為中立夥伴；Buff 已達 ${entry.stackCount}/${entry.maxStacks} 層上限，不提供 EXP。`);
        });
      }
      stepPlayerStatusEffects(FIXED_STEP);
      if (katanaEntry) {
        stepPlayKatana(katanaState, FIXED_STEP);
        const katanaWeapon = getWeaponStats('katana', katanaEntry.level);
        const energyCost = katanaWeapon.energyCost * (actor.derivedStats?.weaponEnergyCostMultiplier ?? 1);
        if (actor.energy >= energyCost) {
          const katanaAttack = resolvePlayKatanaSlash({
            state: katanaState,
            actor,
            enemies,
            damageMultiplier: actor.derivedStats?.currentDamageMultiplier ?? 1,
          });
          if (katanaAttack.ok && katanaAttack.hit) {
            actor.energy = Math.max(0, actor.energy - energyCost);
            recordPlayEnemyDefeats(combatState, enemies, actor);
            eventLog.push(`武士刀 Lv.${katanaState.level}${katanaAttack.empowered ? ' 強化' : ''}斬擊命中 ${katanaAttack.hitCount} 隻，造成 ${katanaAttack.totalDamage} 傷害。`);
          }
        }
      }
      const combatResult = stepPlayCombat(combatState, {
        actor,
        enemies,
        previousPosition,
        dt: FIXED_STEP,
        aiming: dragging,
      });
      if (combatResult.ok && combatResult.collected.collected.length) {
        const gained = combatResult.collected.collected.reduce((total, orb) => total + (orb.value ?? 0), 0);
        eventLog.push(`拾取 ${gained} EXP${combatResult.collected.levelUps ? `，提升 ${combatResult.collected.levelUps} 級` : ''}。`);
      }
      const bossRoomResult = stepPlayBossRoom(bossRoomState, { map, actor, enemies, origin, chapter: 'chapter1' });
      if (bossRoomResult.changed) visibleRenderKey = '';
      addEvents(bossRoomResult.events);
      enemies.forEach((enemy) => {
        enemy.hitFlash = Math.max(0, (enemy.hitFlash ?? 0) - FIXED_STEP);
      });
      if (actor.health <= 0) {
        const cause = '生命歸零';
        const death = registerPlayerDeath(actor, cause);
        if (death.gameOver) {
          sfxController.play('gameOver');
          eventLog.push(`${cause}：${getPlayAttemptState(actor).label}，本次航線結束。`);
        } else {
          sfxController.play('impactWet');
          respawnActor(actor, actor.spawn ?? spawn);
          syncPlayCombatBuild(combatState, actor);
          eventLog.push(`${cause}：${getPlayAttemptState(actor).label}，已回到最近啟用的 Checkpoint。`);
        }
      }
      const stageExit = getPlayStageExitState({ map, mapPart, actor, enemies, origin });
      if (!actor.dead && stageExit.arrived) {
        if (stageExit.nextPart) {
          beginStageTransition(stageExit.nextPart);
          accumulator = 0;
          break;
        }
        if (stageExit.completed) {
          if (mapArc === 'descent') {
            eventLog.push('下沉篇完成：正在把 Resonance 永久能力帶入上升篇。');
            beginArcTransition('ascent', 1);
            accumulator = 0;
            break;
          }
          runCompleted = true;
          completionOverlay.querySelector('.eyebrow').textContent = `${mapArc.toUpperCase()} COMPLETE`;
          completionOverlay.querySelector('#play-completion-title').textContent = `${ARC_LABELS[mapArc]}航線完成`;
          completionOverlay.querySelector('[data-completion-copy]').textContent = mapArc === 'ascent'
            ? '潛水員完成強化後的逆重力返航，從第三部分抵達海面出口。'
            : '深淵抹香鯨已被擊敗，潛水員抵達第三部分終點。';
          completionOverlay.hidden = false;
          eventLog.push(`深淵抹香鯨已擊敗：${ARC_LABELS[mapArc]}完成。`);
          accumulator = 0;
          break;
        }
      }
      refillUnlimitedResources();
      accumulator -= FIXED_STEP;
    }
    updateCamera();
    updateHudIfDue(now);
  }
}

window.render_game_to_text = () => {
  const combat = getPlayCombatRenderState(combatState);
  const stageExit = getPlayStageExitState({ map, mapPart, actor, enemies, origin });
  return JSON.stringify({
    coordinateSystem: 'world origin is top-left; x right, y down',
    map: getMapDefinition()?.label ?? 'loading',
    mapArc,
    mapPart,
    camera: { x: Math.round(camera.x), y: Math.round(camera.y), horizontal: camera.edgeX },
    player: actor ? { x: Math.round(actor.x), y: Math.round(actor.y), vx: Math.round(actor.vx), vy: Math.round(actor.vy), health: Math.round(actor.health), oxygen: Math.round(actor.oxygen), energy: Math.round(actor.energy), animation: getPlayerAnimationState(actor), facing: getPlayerFacingDirection(actor), dragging, weapon: actor.activeWeapon, stunnedRemaining: Math.max(0, (actor.stunnedUntil ?? 0) - worldTime), launchLockedRemaining: Math.max(0, actor.launchLockTimer ?? 0), gravityImmuneRemaining: Math.max(0, actor.gravityImmunity ?? 0), activeEffects: actor.activeEffects ?? {} } : null,
    attempt: actor ? getPlayAttemptState(actor) : null,
    awakening: getPlayAwakeningRenderState(awakeningState),
    hudLoadout: getPlayerHudSlots(combatState.build).map(({ key, kind, id, level, path }) => ({ key, kind, id, level, path })),
    combat,
    enemyCombat: getPlayEnemyRenderState(enemies, worldTime),
    katana: equippedWeapon('katana') ? { level: katanaState.level, cooldown: Math.round(katanaState.cooldown * 100) / 100, empowerNextSlash: katanaState.empowerNextSlash, slashCount: katanaState.slashCount, lastHitCount: katanaState.lastHitCount, lastDamage: katanaState.lastDamage, effects: katanaState.effects.map((effect) => ({ type: effect.type, persistent: effect.persistent, empowered: effect.empowered ?? false, hitCount: effect.hitCount ?? 0, damage: effect.damage ?? 0 })) } : null,
    enemies: enemies.filter((enemy) => isPlayEnemyVisible(enemy, camera, { width: canvas.width / SCALE, height: canvas.height / SCALE })).map((enemy) => ({ id: enemy.enemyId, name: enemy.name, markerKind: enemy.markerKind, x: Math.round(enemy.x), y: Math.round(enemy.y), health: Math.round(enemy.health), maxHealth: Math.round(enemy.maxHealth), defeated: Boolean(enemy.defeated), resonance: { progress: Math.round((enemy.resonanceProgress ?? 0) * 10) / 10, required: enemy.resonanceRequired ?? 0, source: enemy.resonanceSource ?? null, neutral: Boolean(enemy.resonanceNeutral) }, hitFlash: Math.round((enemy.hitFlash ?? 0) * 100) / 100, state: enemy.state, facing: enemy.facing, spawnPattern: enemy.spawnPattern, visual: getPlayEnemyFrameState(enemy, worldTime), pendingSkill: enemy.pendingSkill ? { id: enemy.pendingSkill.skillId, remaining: Math.round(enemy.pendingSkill.remaining * 100) / 100 } : null })),
    totalEnemySpawns: enemies.length,
    totalEncounterGroups: new Set(enemies.map((enemy) => enemy.anchorCellKey)).size,
    totalClusteredSpawns: enemies.filter((enemy) => enemy.spawnPattern === 'cluster').length,
    stageExit,
    bossRoom: getPlayBossRoomRenderState(bossRoomState, map),
    runCompleted,
    transitioning,
    discoveries: {
      seen: [...discoverySession.seenGuideKeys],
      active: [...discoverySession.activeByGuideKey.values()].map((entry) => ({ id: entry.guideKey, title: entry.guide.title, category: entry.guide.categoryLabel })),
      pending: [...discoverySession.pendingByGuideKey.values()].map((entry) => ({ id: entry.guideKey, title: entry.guide.title, category: entry.guide.categoryLabel })),
    },
    unlimitedResources,
    damageReductionPercent: Math.round(playerDamageReduction * 100),
    paused,
    aiming: dragging,
    timeScale: getAimTimeScale(dragging),
  });
};
window.advanceTime = (milliseconds) => { const steps = Math.max(1, Math.round(Math.max(0, milliseconds) / (1000 / 60))); for (let index = 0; index < steps; index += 1) simulate(FIXED_STEP, performance.now()); render(); };

function frame(now) { const elapsed = Math.min(.1, Math.max(0, (now - lastFrame) / 1000)); lastFrame = now; simulate(elapsed, now); render(); requestAnimationFrame(frame); }

if (MAP_ROUTES[requestedRoute]) mapArc = requestedRoute;
if (requestedPart && MAP_ROUTES[mapArc]?.[requestedPart]) mapPart = Number(requestedPart);
mapSelect.value = mapSelectionValue();
const requestedArc = new URLSearchParams(window.location.search).get('arc');
const requestedMode = new URLSearchParams(window.location.search).get('mode');
if (requestedArc === 'ascent20' || mapArc === 'ascent') musicArcSelect.value = 'ascent20';
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
installLiveLocalization(document);
bindLanguageSelect(document.querySelector('#play-language'));
loadMap(mapPart, { arc: mapArc });
requestAnimationFrame(frame);
