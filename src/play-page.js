import {
  allMapEdges,
  getActiveCell,
  getActiveEdge,
  getHexCenter,
  getHexVertices,
  getOddRRectangularBounds,
  getEdgeBetween,
} from './map-model.js';
import {
  FIXED_STEP,
  MAX_ENERGY,
  MAX_HEALTH,
  MAX_OXYGEN,
  createTestActor,
  launchActor,
  predictTrajectory,
  stepPhysics,
} from './physics.js';

const MAPS = {
  1: { path: '/maps/下沉篇/下沉篇-第1部分.json', label: '下沉篇・第一部分（輕）' },
  2: { path: '/maps/下沉篇/下沉篇-第2部分.json', label: '下沉篇・第二部分（中）' },
  3: { path: '/maps/下沉篇/下沉篇-第3部分.json', label: '下沉篇・第三部分（範本）' },
};
const SCALE = 2;
const TILE_SIZE = 24;
const TILE_ASSETS = {
  'L-1': '/assets/editor/water/L-1.png', L0: '/assets/editor/water/L0.png', L1: '/assets/editor/water/L1.png', L2: '/assets/editor/water/L2.png', L3: '/assets/editor/water/L3.png',
  blocked: '/assets/editor/terrain/blocked-dark-stone.png',
};
const OBJECT_ASSETS = {
  coralCluster: '/assets/editor/objects/coral-cluster.png', mine: '/assets/editor/objects/deep-sea-mine.png', weightStone: '/assets/editor/objects/heavy-stone.png', seaweed: '/assets/editor/objects/sea-grass.png', oxygen: '/assets/editor/objects/oxygen-ore.png', checkpoint: '/assets/editor/objects/checkpoint.png', bubble: '/assets/editor/objects/photosynthesis-bubble.png', torricelli: '/assets/editor/objects/torricelli-space.png', razor: '/assets/editor/objects/razor-blade.png', button: '/assets/editor/objects/button.png',
};
const EDGE_ASSETS = { springJelly: '/assets/editor/edges/spring-jellyfish.png', spike: '/assets/editor/edges/edge-spike-barrier.png', barrier: '/assets/editor/edges/edge-spike-barrier.png', current: '/assets/editor/edges/edge-spike-barrier.png', layerPortal: '/assets/editor/edges/layer-portal-stair.png', multiPortal: '/assets/editor/edges/multi-portal.png', seaweed: OBJECT_ASSETS.seaweed, coralCluster: OBJECT_ASSETS.coralCluster };
const objectGlyphs = { mine: '✹', weightStone: '●', oxygen: 'O₂', checkpoint: '◎', bubble: '○', torricelli: 'T', razor: '╱', button: 'B' };
const edgeColors = { springJelly: '#e77dff', spike: '#ff8394', barrier: '#ff9e78', current: '#6fe5ff', layerPortal: '#f4d56d', multiPortal: '#8cc7ff', seaweed: '#76e49c', coralCluster: '#f1a0ff' };

const canvas = document.querySelector('#play-canvas');
const context = canvas.getContext('2d');
const mapSelect = document.querySelector('#play-map-select');
const resetButton = document.querySelector('#play-reset');
const pauseButton = document.querySelector('#play-pause');
const loadingMask = document.querySelector('#play-loading');
const mapTitle = document.querySelector('#play-map-title');
const cameraReadout = document.querySelector('#play-camera-readout');
const speedReadout = document.querySelector('#play-speed');
const help = document.querySelector('#play-help');
const eventsList = document.querySelector('#play-events');
const resourceBars = { health: document.querySelector('#play-health'), oxygen: document.querySelector('#play-oxygen'), energy: document.querySelector('#play-energy') };
const resourceValues = { health: document.querySelector('#play-health-value'), oxygen: document.querySelector('#play-oxygen-value'), energy: document.querySelector('#play-energy-value') };
const images = new Map();
Object.values({ ...TILE_ASSETS, ...OBJECT_ASSETS, ...EDGE_ASSETS }).forEach((path) => { if (images.has(path)) return; const image = new Image(); image.src = path; images.set(path, image); });

let map = null;
let mapPart = 3;
let origin = { x: 40, y: 40 };
let mapBounds = null;
let physicsBounds = null;
let actor = null;
let spawn = null;
let camera = { x: 0, y: 0, edgeX: '中段', edgeY: '中段' };
let dragging = false;
let aimPoint = null;
let trajectory = [];
let paused = false;
let lastFrame = performance.now();
let accumulator = 0;
let eventLog = ['拖曳主角，放開即可彈射。'];

function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
function activeTilePath(cell) { return TILE_ASSETS[cell.terrain === 'blocked' ? 'blocked' : (cell.gravityLevel ?? 'L0')]; }
function cellCenter(key) { return getHexCenter(getActiveCell(map, key, 'chapter1'), origin); }
function hexPath(ctx, cell, pad = 0) { const center = getHexCenter(cell, origin); const vertices = getHexVertices(cell, origin); ctx.beginPath(); vertices.forEach((point, index) => { const dx = point.x - center.x; const dy = point.y - center.y; const length = Math.hypot(dx, dy) || 1; const x = center.x + dx * (1 - pad / length); const y = center.y + dy * (1 - pad / length); if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }); ctx.closePath(); }
function drawImage(path, x, y, width, height, alpha = 1) { const image = images.get(path); if (!image?.complete || !image.naturalWidth) return false; context.save(); context.globalAlpha = alpha; context.drawImage(image, x - width / 2, y - height / 2, width, height); context.restore(); return true; }
function visibleCell(cell) { return cell.q !== undefined && cell.r !== undefined && cellCenter(cell.key ?? `${cell.q},${cell.r}`).y > camera.y - 40 && cellCenter(cell.key ?? `${cell.q},${cell.r}`).y < camera.y + canvas.height / SCALE + 40; }

function chooseSpawn(nextMap) {
  const midRow = Math.floor((nextMap.layout?.height ?? 1) / 2);
  const safe = Object.values(nextMap.cells).filter((cell) => cell.terrain === 'water').sort((a, b) => Math.abs(a.r - midRow) - Math.abs(b.r - midRow) || Math.abs(a.q) - Math.abs(b.q));
  return getHexCenter(safe[0] ?? Object.values(nextMap.cells)[0], origin);
}

function setupWorld(nextMap) {
  map = nextMap;
  origin = { x: 36, y: 36 };
  mapBounds = getOddRRectangularBounds(map, origin);
  physicsBounds = { minX: mapBounds.left + 7, maxX: mapBounds.right - 7, minY: mapBounds.top + 8, maxY: mapBounds.bottom - 8 };
  spawn = chooseSpawn(map);
  actor = createTestActor(spawn);
  camera = { x: 0, y: 0, edgeX: '中段', edgeY: '中段' };
  aimPoint = null;
  trajectory = [];
  eventLog = ['拖曳主角，放開即可彈射。', `${MAPS[mapPart].label} 已載入。`];
  mapTitle.textContent = `${MAPS[mapPart].label} · ${map.layout.width} × ${map.layout.height}`;
  help.textContent = '按住 P 圓形主角並拖曳，放開即可彈射。短距離與長距離的初速度會有明顯差異；相機在地圖左右外緣自動固定。';
  loadingMask.classList.add('is-hidden');
  updateCamera();
  updateHud();
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
    help.textContent = '請先執行 npm run generate:maps，確認 maps/下沉篇 目錄存在。';
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
  context.restore();
  context.save();
  hexPath(context, cell, .35);
  context.strokeStyle = cell.terrain === 'blocked' ? 'rgba(1, 5, 12, .94)' : 'rgba(3, 13, 28, .42)';
  context.lineWidth = cell.terrain === 'blocked' ? 1.25 : .72;
  context.stroke();
  context.restore();
  (cell.objects ?? []).forEach((object, index) => drawObject(object, center.x + Math.cos(index * 2.5) * 2, center.y + Math.sin(index * 2.5) * 2));
  (cell.freeObjects ?? []).forEach((object) => { const offset = object.offset ?? { x: 0, y: 0 }; drawObject(object, center.x + offset.x, center.y + offset.y); });
}

function drawObject(object, x, y) {
  const size = Math.min(21, Math.max(10, Number(object.size) || 16));
  if (!drawImage(OBJECT_ASSETS[object.kind], x, y, size, size, .95)) { context.save(); context.fillStyle = '#f5d967'; context.strokeStyle = '#081526'; context.lineWidth = 1; context.beginPath(); context.arc(x, y, size * .42, 0, Math.PI * 2); context.fill(); context.stroke(); context.fillStyle = '#071629'; context.font = `bold ${Math.max(7, size * .42)}px sans-serif`; context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillText(objectGlyphs[object.kind] ?? '?', x, y); context.restore(); }
}

function drawEdges() {
  allMapEdges(map).forEach(({ a, b, key }) => {
    const edge = getActiveEdge(map, key, 'chapter1') ?? getEdgeBetween(map, a, b, 'chapter1');
    if (!edge || edge.type === 'none') return;
    const from = cellCenter(a); const to = cellCenter(b); const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
    if (mid.y < camera.y - 45 || mid.y > camera.y + canvas.height / SCALE + 45) return;
    const color = edgeColors[edge.type] ?? '#bcecff';
    context.save(); context.strokeStyle = color; context.lineWidth = edge.type === 'multiPortal' ? 1.5 : 1.05; context.globalAlpha = .84; context.setLineDash(edge.type === 'current' ? [3, 3] : []);
    context.beginPath(); context.moveTo(from.x, from.y); context.lineTo(to.x, to.y); context.stroke(); context.restore();
    const asset = EDGE_ASSETS[edge.type];
    if (asset) drawImage(asset, mid.x, mid.y, edge.type === 'multiPortal' ? 20 : 16, edge.type === 'multiPortal' ? 16 : 16, .92);
  });
}

function drawTrajectory() {
  if (!dragging || !trajectory.length) return;
  context.save(); context.strokeStyle = 'rgba(247, 220, 120, .78)'; context.fillStyle = 'rgba(247, 220, 120, .76)'; context.lineWidth = 1.1; context.setLineDash([2.5, 3]); context.beginPath(); trajectory.forEach((point, index) => { if (index === 0) context.moveTo(point.x, point.y); else context.lineTo(point.x, point.y); }); context.stroke(); context.setLineDash([]); trajectory.filter((_, index) => index % 12 === 0).forEach((point) => { context.beginPath(); context.arc(point.x, point.y, 1.6, 0, Math.PI * 2); context.fill(); }); context.restore();
}

function drawActor() {
  if (!actor) return;
  context.save(); const pulse = 1 + Math.sin(performance.now() / 260) * .06; context.shadowColor = '#ffe68a'; context.shadowBlur = 14; context.fillStyle = '#fff7ca'; context.beginPath(); context.arc(actor.x, actor.y, 8 * pulse, 0, Math.PI * 2); context.fill(); context.shadowBlur = 0; context.strokeStyle = '#b98c36'; context.lineWidth = 1; context.stroke(); context.fillStyle = '#10233a'; context.font = 'bold 8px sans-serif'; context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillText('P', actor.x, actor.y + .3); if (dragging && aimPoint) { context.strokeStyle = '#f7dc78'; context.lineWidth = 1; context.beginPath(); context.moveTo(actor.x, actor.y); context.lineTo(aimPoint.x, aimPoint.y); context.stroke(); } context.restore();
}

function render() {
  renderBackground();
  if (!map || !actor) return;
  context.save(); context.scale(SCALE, SCALE); context.translate(-camera.x, -camera.y);
  Object.entries(map.cells).forEach(([key, cell]) => renderCell(getActiveCell(map, key, 'chapter1'), key));
  drawEdges(); drawTrajectory(); drawActor(); context.restore();
}

function updateHud() {
  if (!actor) return;
  const resources = { health: actor.health, oxygen: actor.oxygen, energy: actor.energy };
  Object.entries(resources).forEach(([key, value]) => { const maximum = key === 'health' ? MAX_HEALTH : key === 'oxygen' ? MAX_OXYGEN : MAX_ENERGY; resourceBars[key].style.width = `${clamp(value / maximum, 0, 1) * 100}%`; resourceValues[key].textContent = Math.round(value); });
  speedReadout.textContent = `速度 ${Math.round(Math.hypot(actor.vx, actor.vy))}`;
  eventsList.innerHTML = eventLog.slice(-5).reverse().map((message) => `<li>${message}</li>`).join('');
}

function addEvents(events) { events.forEach((event) => { if (event?.message) eventLog.push(event.message); }); if (eventLog.length > 12) eventLog = eventLog.slice(-12); }
function canvasPoint(event) { const rect = canvas.getBoundingClientRect(); return { x: (event.clientX - rect.left) * canvas.width / rect.width, y: (event.clientY - rect.top) * canvas.height / rect.height }; }
function screenToWorld(point) { return { x: point.x / SCALE + camera.x, y: point.y / SCALE + camera.y }; }
function actorCanvasPoint() { return { x: (actor.x - camera.x) * SCALE, y: (actor.y - camera.y) * SCALE }; }

canvas.addEventListener('pointerdown', (event) => { if (!actor || paused || actor.dead) return; const point = canvasPoint(event); const actorPoint = actorCanvasPoint(); if (Math.hypot(point.x - actorPoint.x, point.y - actorPoint.y) > 35) return; dragging = true; canvas.setPointerCapture(event.pointerId); aimPoint = screenToWorld(point); trajectory = predictTrajectory({ map, chapter: 'chapter1', actor, pointer: aimPoint, origin, steps: 110, time: performance.now() / 1000 }); });
canvas.addEventListener('pointermove', (event) => { if (!dragging) return; aimPoint = screenToWorld(canvasPoint(event)); trajectory = predictTrajectory({ map, chapter: 'chapter1', actor, pointer: aimPoint, origin, steps: 110, time: performance.now() / 1000 }); });
canvas.addEventListener('pointerup', (event) => { if (!dragging) return; dragging = false; canvas.releasePointerCapture(event.pointerId); aimPoint = screenToWorld(canvasPoint(event)); const result = launchActor(actor, aimPoint); if (result.launched) eventLog.push(`彈射 ${Math.round(result.distance)} px · 初速度 ${Math.round(result.speed)}`); else eventLog.push(result.reason === 'energy' ? '能量不足，無法彈射。' : '這次彈射距離太短。'); trajectory = []; updateHud(); });
canvas.addEventListener('pointercancel', () => { dragging = false; trajectory = []; });
resetButton.addEventListener('click', () => { if (!actor) return; Object.assign(actor, createTestActor(spawn)); eventLog.push('主角已回到中央安全水域。'); updateCamera(); updateHud(); });
pauseButton.addEventListener('click', () => { paused = !paused; pauseButton.textContent = paused ? '▶ 繼續' : 'Ⅱ 暫停'; pauseButton.setAttribute('aria-pressed', String(paused)); });
mapSelect.addEventListener('change', () => loadMap(mapSelect.value));
window.addEventListener('keydown', (event) => { if (event.key.toLowerCase() === 'r') resetButton.click(); if (event.code === 'Space') { event.preventDefault(); pauseButton.click(); } if (event.key === 'Escape') window.location.href = '/home.html'; });

function frame(now) {
  const elapsed = Math.min(.1, Math.max(0, (now - lastFrame) / 1000)); lastFrame = now;
  if (!paused && map && actor) { accumulator += elapsed; while (accumulator >= FIXED_STEP) { addEvents(stepPhysics({ map, chapter: 'chapter1', actor, dt: FIXED_STEP, origin, bounds: physicsBounds, mutateMap: true, time: now / 1000 })); accumulator -= FIXED_STEP; } updateCamera(); updateHud(); }
  render(); requestAnimationFrame(frame);
}

const requestedPart = new URLSearchParams(window.location.search).get('part');
if (requestedPart && MAPS[requestedPart]) { mapSelect.value = requestedPart; mapPart = Number(requestedPart); }
loadMap(mapPart);
requestAnimationFrame(frame);
