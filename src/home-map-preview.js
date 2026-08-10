import {
  HEX_SIZE,
  getActiveCell,
  getActiveEdge,
  getDirectionVector,
  getHexCenter,
  getHexVertices,
  getOddRRectangularBounds,
} from './map-model.js';
import { getEdgeAttachmentGeometry } from './edge-attachment.js';
import { getEdgeSetting, getFreeObjectSetting } from './map-object-settings.js';
import {
  getPlayEdgeVisual,
  getPlayObjectVisual,
  getPlayOverlayVisual,
  getPlayWorldAssetPaths,
} from './play-world-visuals.js';
import { PLAYER_ANIMATION_ASSETS } from './player-animation.js';
import { getLanguage, subscribeLanguage, translateText } from './i18n.js';

const TILE_SIZE = 24;
const PREVIEW_WIDTH = 720;
const PREVIEW_HEIGHT = 760;
const TRANSITION_SECONDS = 1.15;
const SECONDS_PER_ROW = 0.18;

export const HOME_LENS_WARP = Object.freeze({
  horizontalEdgeScale: 0.82,
  horizontalCenterScale: 1.16,
  verticalEdgeScale: 0.84,
  verticalCenterScale: 1.13,
});

const TILE_ASSETS = Object.freeze({
  'L-1': '/assets/editor/water/L-1.png',
  L0: '/assets/editor/water/L0.png',
  L1: '/assets/editor/water/L1.png',
  L2: '/assets/editor/water/L2.png',
  L3: '/assets/editor/water/L3.png',
  blocked: '/assets/editor/terrain/blocked-dark-stone.png',
});

const DESCENT_MAP_URLS = Object.freeze({
  1: new URL('../maps/下沉篇/下沉篇-第1部分.json', import.meta.url).href,
  2: new URL('../maps/下沉篇/下沉篇-第2部分.json', import.meta.url).href,
  3: new URL('../maps/下沉篇/下沉篇-第3部分.json', import.meta.url).href,
});
const ASCENT_MAP_URLS = Object.freeze({
  1: new URL('../maps/上升篇/上升篇-第1部分.json', import.meta.url).href,
  2: new URL('../maps/上升篇/上升篇-第2部分.json', import.meta.url).href,
  3: new URL('../maps/上升篇/上升篇-第3部分.json', import.meta.url).href,
});

export const HOME_PREVIEW_ROUTES = Object.freeze({
  descent: Object.freeze([
    Object.freeze({
      part: 1,
      label: '第一部分｜深海森林入口',
      labelKey: 'home.map.partOne',
      path: '/maps/下沉篇/下沉篇-第1部分.json',
      url: DESCENT_MAP_URLS[1],
    }),
    Object.freeze({
      part: 2,
      label: '第二部分｜穿越熱泉',
      labelKey: 'home.map.partTwo',
      path: '/maps/下沉篇/下沉篇-第2部分.json',
      url: DESCENT_MAP_URLS[2],
    }),
    Object.freeze({
      part: 3,
      label: '第三部分｜深淵遺跡',
      labelKey: 'home.map.partThree',
      path: '/maps/下沉篇/下沉篇-第3部分.json',
      url: DESCENT_MAP_URLS[3],
    }),
  ]),
  ascent: Object.freeze([
    Object.freeze({
      part: 1,
      label: '第一部分｜逆游深海遺跡',
      labelKey: 'home.map.ascentPartOne',
      path: '/maps/上升篇/上升篇-第1部分.json',
      url: ASCENT_MAP_URLS[1],
    }),
    Object.freeze({
      part: 2,
      label: '第二部分｜逆穿熱泉',
      labelKey: 'home.map.ascentPartTwo',
      path: '/maps/上升篇/上升篇-第2部分.json',
      url: ASCENT_MAP_URLS[2],
    }),
    Object.freeze({
      part: 3,
      label: '第三部分｜重返森林出口',
      labelKey: 'home.map.ascentPartThree',
      path: '/maps/上升篇/上升篇-第3部分.json',
      url: ASCENT_MAP_URLS[3],
    }),
  ]),
});

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function getHomePreviewDurations(routes) {
  return routes.map((route) => ({
    ...route,
    moveSeconds: clamp((route.height ?? 96) * SECONDS_PER_ROW, 14, 28),
    transitionSeconds: TRANSITION_SECONDS,
  }));
}

export function getHomePreviewPlaybackState(elapsedSeconds, routes) {
  const timedRoutes = getHomePreviewDurations(routes);
  const totalSeconds = timedRoutes.reduce((total, route) => (
    total + route.moveSeconds + route.transitionSeconds
  ), 0);
  if (!timedRoutes.length || totalSeconds <= 0) {
    return { partIndex: 0, progress: 0, transition: 0, totalSeconds: 0 };
  }

  let cursor = ((elapsedSeconds % totalSeconds) + totalSeconds) % totalSeconds;
  for (let partIndex = 0; partIndex < timedRoutes.length; partIndex += 1) {
    const route = timedRoutes[partIndex];
    if (cursor <= route.moveSeconds) {
      return {
        partIndex,
        progress: clamp(cursor / route.moveSeconds, 0, 1),
        transition: 0,
        totalSeconds,
      };
    }
    cursor -= route.moveSeconds;
    if (cursor <= route.transitionSeconds) {
      return {
        partIndex,
        progress: 1,
        transition: clamp(cursor / route.transitionSeconds, 0, 1),
        totalSeconds,
      };
    }
    cursor -= route.transitionSeconds;
  }

  return {
    partIndex: timedRoutes.length - 1,
    progress: 1,
    transition: 1,
    totalSeconds,
  };
}

function createBuffer(width = PREVIEW_WIDTH, height = PREVIEW_HEIGHT) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function loadImage(path) {
  return new Promise((resolve) => {
    const image = new Image();
    image.addEventListener('load', () => resolve([path, image]), { once: true });
    image.addEventListener('error', () => resolve([path, null]), { once: true });
    image.src = path;
  });
}

function drawImage(context, images, path, x, y, width, height, alpha = 1, rotation = 0) {
  const image = images.get(path);
  if (!image?.naturalWidth) return false;
  context.save();
  context.globalAlpha = alpha;
  context.translate(x, y);
  context.rotate(rotation);
  context.drawImage(image, -width / 2, -height / 2, width, height);
  context.restore();
  return true;
}

function hexPath(context, cell, origin) {
  const vertices = getHexVertices(cell, origin);
  context.beginPath();
  vertices.forEach((point, index) => {
    if (index === 0) context.moveTo(point.x, point.y);
    else context.lineTo(point.x, point.y);
  });
  context.closePath();
}

function drawFallbackObject(context, visual, x, y, size) {
  context.save();
  context.fillStyle = visual?.color ?? '#8cefff';
  context.strokeStyle = 'rgba(232, 250, 255, .88)';
  context.lineWidth = 0.7;
  context.beginPath();
  context.arc(x, y, size * 0.32, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.restore();
}

function drawMapObject(context, images, object, x, y) {
  if (typeof object === 'string') object = { kind: object };
  if (!object?.kind) return;
  const visual = object.kind === 'ink'
    ? getPlayOverlayVisual('ink')
    : getPlayObjectVisual(object.kind);
  const size = getFreeObjectSetting(object, 'size');
  if (object.kind === 'button') {
    context.save();
    context.fillStyle = object.pressed ? '#70ead0' : '#f1b85b';
    context.strokeStyle = '#d9f8ff';
    context.lineWidth = 0.8;
    context.beginPath();
    context.arc(x, y, size * 0.28, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.restore();
    return;
  }
  if (!drawImage(context, images, visual.assetPath, x, y, size, size, 0.94)) {
    drawFallbackObject(context, visual, x, y, size);
  }
}

function drawCurrent(context, edge, geometry, colour, size) {
  const direction = getDirectionVector(edge.currentDirection ?? 0);
  context.save();
  context.translate(geometry.midpoint.x, geometry.midpoint.y);
  context.rotate(Math.atan2(direction.y, direction.x));
  context.strokeStyle = colour;
  context.lineWidth = Math.max(0.8, size * .04);
  [-size * .2, size * .14].forEach((offset) => {
    context.beginPath();
    context.moveTo(offset - size * .12, -size * .16);
    context.lineTo(offset + 1, 0);
    context.lineTo(offset - size * .12, size * .16);
    context.stroke();
  });
  context.restore();
}

function drawMapEdge(context, images, map, edge, origin, cameraTop, viewWorldHeight) {
  if (!edge || edge.type === 'none' || !Array.isArray(edge.cells)) return;
  const [a, b] = edge.cells;
  const fromCell = getActiveCell(map, a, 'chapter1');
  const toCell = getActiveCell(map, b, 'chapter1');
  if (!fromCell || !toCell) return;
  const from = getHexCenter(fromCell, origin);
  const to = getHexCenter(toCell, origin);
  const geometry = getEdgeAttachmentGeometry(from, to, fromCell.terrain, toCell.terrain, {
    edgeLength: HEX_SIZE,
    blockedInset: 1.25,
  });
  if (!geometry || geometry.midpoint.y < cameraTop - 45 || geometry.midpoint.y > cameraTop + viewWorldHeight + 45) return;

  const visual = getPlayEdgeVisual(edge.type);
  const size = getEdgeSetting(edge, 'size');
  const colour = visual.color ?? '#bcecff';
  context.save();
  context.globalAlpha = 0.82;
  context.strokeStyle = colour;
  context.lineWidth = edge.type === 'multiPortal' ? 1.4 : 0.9;
  context.beginPath();
  context.moveTo(geometry.edgeStart.x, geometry.edgeStart.y);
  context.lineTo(geometry.edgeEnd.x, geometry.edgeEnd.y);
  context.stroke();
  context.restore();

  if (!visual.assetPath) {
    if (edge.type === 'current') drawCurrent(context, edge, geometry, colour, size);
    return;
  }

  const isPortal = edge.type === 'multiPortal' || edge.type === 'layerPortal' || edge.type === 'wallGillGate';
  const isPlant = visual.anchoredPlant;
  const pointsIntoWater = edge.type === 'spike' || edge.type === 'barrier';
  const renderPoint = pointsIntoWater || edge.type === 'springJelly'
    ? geometry.attachmentPoint
    : geometry.midpoint;
  const rotation = pointsIntoWater
    ? geometry.pointsIntoOpenAngle
    : isPlant
      ? geometry.growsIntoOpenAngle
      : geometry.tangentAngle;
  const image = images.get(visual.assetPath);
  const aspect = image?.complete && image.naturalWidth > 0 && image.naturalHeight > 0
    ? image.naturalWidth / image.naturalHeight
    : 1;
  const width = aspect >= 1 ? size : size * aspect;
  const height = aspect >= 1 ? size / aspect : size;
  drawImage(context, images, visual.assetPath, renderPoint.x, renderPoint.y, width, height, 0.9, rotation);
}

function drawActorMarker(context, images, actor, center) {
  if (actor.kind === 'playerStart') {
    if (!drawImage(context, images, PLAYER_ANIMATION_ASSETS.swim[0], center.x, center.y, 15, 22, 0.98)) {
      drawFallbackObject(context, { color: '#8cefff' }, center.x, center.y, 15);
    }
    return;
  }
  const colours = {
    enemySpawn: '#ffcf73',
    miniBossSpawn: '#d8a4ff',
    bossSpawn: '#ff756d',
  };
  context.save();
  context.fillStyle = colours[actor.kind] ?? '#eaf8ff';
  context.strokeStyle = 'rgba(2, 9, 18, .88)';
  context.lineWidth = 0.8;
  context.beginPath();
  context.arc(center.x, center.y, actor.kind === 'bossSpawn' ? 4.6 : 3.2, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.restore();
}

function renderMapToBuffer(buffer, preparedRoute, images, progress) {
  const context = buffer.getContext('2d');
  const { map, bounds } = preparedRoute;
  const origin = { x: 0, y: 0 };
  const mapWidth = Math.max(1, bounds.right - bounds.left);
  const mapHeight = Math.max(1, bounds.bottom - bounds.top);
  const scale = buffer.width / (mapWidth + HEX_SIZE * 2.5);
  const viewWorldHeight = buffer.height / scale;
  const travelDistance = Math.max(0, mapHeight - viewWorldHeight);
  const cameraTop = bounds.top + travelDistance * clamp(progress, 0, 1);
  const offsetX = (buffer.width - mapWidth * scale) / 2 - bounds.left * scale;

  const background = context.createLinearGradient(0, 0, 0, buffer.height);
  background.addColorStop(0, '#0a3156');
  background.addColorStop(0.55, '#061a31');
  background.addColorStop(1, '#020b16');
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.fillStyle = background;
  context.fillRect(0, 0, buffer.width, buffer.height);

  context.save();
  context.setTransform(scale, 0, 0, scale, offsetX, -cameraTop * scale);

  Object.entries(map.cells).forEach(([key]) => {
    const cell = getActiveCell(map, key, 'chapter1');
    const center = getHexCenter(cell, origin);
    if (center.y < cameraTop - 40 || center.y > cameraTop + viewWorldHeight + 40) return;
    const tilePath = TILE_ASSETS[cell.terrain === 'blocked' ? 'blocked' : (cell.gravityLevel ?? 'L0')];
    context.save();
    hexPath(context, cell, origin);
    context.clip();
    drawImage(context, images, tilePath, center.x, center.y, TILE_SIZE * 1.78, TILE_SIZE * 2.03, cell.terrain === 'blocked' ? 0.98 : 0.88);
    if (cell.waterLayer === 'T2' && cell.terrain !== 'blocked') {
      context.fillStyle = 'rgba(6, 10, 43, .26)';
      context.fillRect(center.x - TILE_SIZE, center.y - TILE_SIZE, TILE_SIZE * 2, TILE_SIZE * 2);
    }
    (cell.overlays ?? []).forEach((kind) => {
      const visual = getPlayOverlayVisual(kind);
      drawImage(context, images, visual.assetPath, center.x, center.y, TILE_SIZE * 1.8, TILE_SIZE * 1.8, 0.56);
    });
    context.restore();

    context.save();
    hexPath(context, cell, origin);
    context.strokeStyle = cell.terrain === 'blocked'
      ? 'rgba(1, 6, 12, .72)'
      : 'rgba(115, 214, 255, .08)';
    context.lineWidth = cell.terrain === 'blocked' ? 0.9 : 0.35;
    context.stroke();
    context.restore();

    if (cell.conditionalGate && !cell.conditionalGate.opened) {
      context.save();
      context.strokeStyle = '#93dff5';
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(center.x - 6, center.y - 7);
      context.lineTo(center.x + 6, center.y + 7);
      context.moveTo(center.x + 6, center.y - 7);
      context.lineTo(center.x - 6, center.y + 7);
      context.stroke();
      context.restore();
    }

    (cell.objects ?? []).forEach((object, index) => {
      drawMapObject(context, images, object, center.x + Math.cos(index * 2.5) * 2, center.y + Math.sin(index * 2.5) * 2);
    });
    (cell.freeObjects ?? []).forEach((object) => {
      const offset = object.offset ?? { x: 0, y: 0 };
      drawMapObject(context, images, object, center.x + offset.x, center.y + offset.y);
    });
    (cell.actors ?? []).forEach((actor, index) => {
      drawActorMarker(context, images, actor, {
        x: center.x + Math.cos(index * 2.3) * 3,
        y: center.y + Math.sin(index * 2.3) * 3,
      });
    });
  });

  Object.entries(map.edges ?? {}).forEach(([key]) => {
    drawMapEdge(context, images, map, getActiveEdge(map, key, 'chapter1'), origin, cameraTop, viewWorldHeight);
  });

  context.restore();

  context.setTransform(1, 0, 0, 1, 0, 0);
  const depthVeil = context.createLinearGradient(0, 0, 0, buffer.height);
  depthVeil.addColorStop(0, 'rgba(72, 180, 255, .06)');
  depthVeil.addColorStop(0.55, 'rgba(2, 16, 34, 0)');
  depthVeil.addColorStop(1, `rgba(0, 4, 12, ${0.08 + progress * 0.2})`);
  context.fillStyle = depthVeil;
  context.fillRect(0, 0, buffer.width, buffer.height);
}

// The map is first pinched/stretched horizontally by scanline and then
// vertically by column. Unlike a subtle zoom, this compresses the perimeter
// below 1x while enlarging the centre above 1x, so straight hex rows visibly
// bow around the helmet's convex glass.
function drawConvexMap(output, source, rowWarp, opacity = 1) {
  const rowContext = rowWarp.getContext('2d');
  rowContext.setTransform(1, 0, 0, 1, 0, 0);
  rowContext.clearRect(0, 0, rowWarp.width, rowWarp.height);
  rowContext.imageSmoothingEnabled = true;
  for (let y = 0; y < source.height; y += 1) {
    const normalizedY = (y + 0.5) / source.height * 2 - 1;
    const curve = 1 - normalizedY * normalizedY;
    const magnification = HOME_LENS_WARP.horizontalEdgeScale
      + (HOME_LENS_WARP.horizontalCenterScale - HOME_LENS_WARP.horizontalEdgeScale) * curve;
    const width = source.width * magnification;
    rowContext.drawImage(source, 0, y, source.width, 1, (source.width - width) / 2, y, width, 1);
  }

  const context = output.getContext('2d');
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, output.width, output.height);
  context.save();
  context.globalAlpha = opacity;
  context.imageSmoothingEnabled = true;
  for (let x = 0; x < rowWarp.width; x += 1) {
    const normalizedX = (x + 0.5) / rowWarp.width * 2 - 1;
    const curve = 1 - normalizedX * normalizedX;
    const magnification = HOME_LENS_WARP.verticalEdgeScale
      + (HOME_LENS_WARP.verticalCenterScale - HOME_LENS_WARP.verticalEdgeScale) * curve;
    const height = rowWarp.height * magnification;
    context.drawImage(rowWarp, x, 0, 1, rowWarp.height, x, (rowWarp.height - height) / 2, 1, height);
  }
  context.restore();
}

async function loadPreparedRoutes(routes) {
  const prepared = await Promise.all(routes.map(async (route) => {
    const response = await fetch(route.url ?? route.path);
    if (!response.ok) throw new Error(`${route.label} ${response.status}`);
    const map = await response.json();
    return {
      ...route,
      height: map.layout?.height ?? 96,
      map,
      bounds: getOddRRectangularBounds(map, { x: 0, y: 0 }),
    };
  }));
  return prepared;
}

export async function attachHomeMapPreview(root) {
  if (!root) return null;
  const canvas = root.querySelector('#home-map-preview');
  const loading = root.querySelector('#home-preview-loading');
  const partLabel = root.querySelector('#home-preview-part');
  const directionLabel = root.querySelector('#home-preview-direction');
  const pauseButton = root.querySelector('#home-preview-toggle');
  const partMarkers = [...root.querySelectorAll('[data-preview-part]')];
  if (!canvas || !loading || !partLabel || !pauseButton) return null;

  canvas.width = PREVIEW_WIDTH;
  canvas.height = PREVIEW_HEIGHT;
  const source = createBuffer();
  const rowWarp = createBuffer();
  let preparedRoutes = [];
  let elapsedSeconds = 0;
  let lastFrameAt = performance.now();
  let paused = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let currentPartIndex = -1;
  let animationFrame = 0;
  let language = getLanguage();

  pauseButton.setAttribute('aria-pressed', String(paused));
  const localize = (key, values = {}) => Object.entries(values).reduce(
    (result, [name, value]) => result.replaceAll(`{${name}}`, String(value)),
    translateText(key, language),
  );
  const getRouteLabel = (route) => translateText(route.labelKey ?? '', language) || route.label;

  const assetPaths = [
    ...Object.values(TILE_ASSETS),
    ...getPlayWorldAssetPaths(),
    PLAYER_ANIMATION_ASSETS.swim[0],
  ];

  try {
    const [routes, imageEntries] = await Promise.all([
      loadPreparedRoutes(HOME_PREVIEW_ROUTES.descent),
      Promise.all([...new Set(assetPaths)].map(loadImage)),
    ]);
    preparedRoutes = routes;
    const images = new Map(imageEntries.filter(([, image]) => image));
    loading.hidden = true;

    function renderCurrentFrame() {
      const state = getHomePreviewPlaybackState(elapsedSeconds, preparedRoutes);
      const route = preparedRoutes[state.partIndex];
      if (!route) return;
      if (currentPartIndex !== state.partIndex) {
        currentPartIndex = state.partIndex;
        partLabel.textContent = getRouteLabel(route);
        directionLabel.textContent = state.partIndex === preparedRoutes.length - 1
          ? localize('home.map.toCore')
          : localize('home.map.nextPart', { part: state.partIndex + 2 });
        partMarkers.forEach((marker, index) => {
          marker.classList.toggle('is-active', index === state.partIndex);
          marker.setAttribute('aria-current', index === state.partIndex ? 'step' : 'false');
        });
      }
      renderMapToBuffer(source, route, images, state.progress);
      drawConvexMap(canvas, source, rowWarp, 1 - state.transition * 0.92);
      root.style.setProperty('--preview-depth', state.progress.toFixed(3));
      root.dataset.previewPart = String(route.part);
      root.dataset.previewProgress = state.progress.toFixed(3);
    }

    function frame(now) {
      const delta = Math.min(0.1, Math.max(0, (now - lastFrameAt) / 1000));
      lastFrameAt = now;
      if (!paused) elapsedSeconds += delta;
      renderCurrentFrame();
      animationFrame = requestAnimationFrame(frame);
    }

    pauseButton.addEventListener('click', () => {
      paused = !paused;
      pauseButton.setAttribute('aria-pressed', String(paused));
      pauseButton.textContent = paused ? localize('home.map.resume') : localize('home.map.pauseTour');
    });

    const updateLanguage = (nextLanguage) => {
      language = nextLanguage;
      currentPartIndex = -1;
      renderCurrentFrame();
      pauseButton.textContent = paused ? localize('home.map.resume') : localize('home.map.pauseTour');
    };
    const unsubscribeLanguage = subscribeLanguage(updateLanguage);
    pauseButton.textContent = paused ? localize('home.map.resume') : localize('home.map.pauseTour');

    window.render_home_preview_to_text = () => JSON.stringify({
      arc: 'descent',
      source: 'authored playable map JSON',
      routeOrder: preparedRoutes.map((route) => route.part),
      currentPart: preparedRoutes[currentPartIndex]?.part ?? 1,
      progress: Number(root.dataset.previewProgress ?? 0),
      direction: 'down',
      paused,
      ascentAvailable: HOME_PREVIEW_ROUTES.ascent.length > 0,
    });
    window.advanceHomePreview = (milliseconds) => {
      elapsedSeconds += Math.max(0, Number(milliseconds) || 0) / 1000;
      renderCurrentFrame();
    };
    window.addEventListener('pagehide', unsubscribeLanguage, { once: true });

    renderCurrentFrame();
    animationFrame = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(animationFrame);
  } catch (error) {
    loading.hidden = false;
    loading.textContent = `真實地圖讀取失敗：${error.message}`;
    root.classList.add('has-preview-error');
    return null;
  }
}
