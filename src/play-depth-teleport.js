import {
  HEX_SIZE,
  getActiveCell,
  getHexCenter,
  getOddRRectangularBounds,
} from './map-model.js';

const DEPTH_METERS_PER_ROW = HEX_SIZE * 1.5;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function getPlayDepthRange(map, origin = { x: 0, y: 0 }) {
  if (!map || !Object.keys(map.cells ?? {}).length) return Object.freeze({ min: 0, max: 0 });
  const bounds = getOddRRectangularBounds(map, origin);
  const firstRowCenterY = bounds.top + HEX_SIZE;
  const lastRowCenterY = bounds.bottom - HEX_SIZE;
  return Object.freeze({
    min: 0,
    max: Math.max(0, Math.round((lastRowCenterY - firstRowCenterY) / DEPTH_METERS_PER_ROW)),
  });
}

export function getPlayDepthMeters({ map, mapArc = 'descent', actorY, origin = { x: 0, y: 0 } } = {}) {
  if (!map || !Number.isFinite(Number(actorY))) return 0;
  const bounds = getOddRRectangularBounds(map, origin);
  const firstRowCenterY = bounds.top + HEX_SIZE;
  const lastRowCenterY = bounds.bottom - HEX_SIZE;
  const distance = mapArc === 'ascent'
    ? lastRowCenterY - Number(actorY)
    : Number(actorY) - firstRowCenterY;
  return clamp(Math.round(distance / DEPTH_METERS_PER_ROW), 0, getPlayDepthRange(map, origin).max);
}

export function findPlayDepthTeleportTarget(map, {
  mapArc = 'descent',
  requestedDepth = 0,
  currentX = 0,
  origin = { x: 0, y: 0 },
  chapter = 'chapter1',
} = {}) {
  if (!map || !Object.keys(map.cells ?? {}).length) {
    return Object.freeze({ ok: false, error: 'noTraversableWater', requestedDepth: 0, maxDepth: 0 });
  }
  const parsedDepth = Number(requestedDepth);
  if (!Number.isFinite(parsedDepth)) {
    return Object.freeze({ ok: false, error: 'depthMustBeNumber' });
  }
  const range = getPlayDepthRange(map, origin);
  const requested = Math.max(0, Math.round(parsedDepth));
  const clampedDepth = clamp(requested, range.min, range.max);
  const bounds = getOddRRectangularBounds(map, origin);
  const firstRowCenterY = bounds.top + HEX_SIZE;
  const lastRowCenterY = bounds.bottom - HEX_SIZE;
  const targetY = mapArc === 'ascent'
    ? lastRowCenterY - clampedDepth * DEPTH_METERS_PER_ROW
    : firstRowCenterY + clampedDepth * DEPTH_METERS_PER_ROW;
  const targetX = Number.isFinite(Number(currentX)) ? Number(currentX) : origin.x;
  const candidates = Object.entries(map?.cells ?? {}).flatMap(([key]) => {
    const cell = getActiveCell(map, key, chapter);
    if (!cell || cell.terrain !== 'water') return [];
    const center = getHexCenter(cell, origin);
    return [{
      key,
      cell,
      x: center.x,
      y: center.y,
      verticalDistance: Math.abs(center.y - targetY),
      horizontalDistance: Math.abs(center.x - targetX),
    }];
  }).sort((left, right) => (
    left.verticalDistance - right.verticalDistance
    || left.horizontalDistance - right.horizontalDistance
    || left.key.localeCompare(right.key)
  ));
  const target = candidates[0];
  if (!target) return Object.freeze({ ok: false, error: 'noTraversableWater', requestedDepth: requested, maxDepth: range.max });
  const depth = getPlayDepthMeters({ map, mapArc, actorY: target.y, origin });
  return Object.freeze({
    ok: true,
    requestedDepth: requested,
    clampedDepth,
    depth,
    maxDepth: range.max,
    clamped: requested !== clampedDepth || depth !== requested,
    key: target.key,
    x: target.x,
    y: target.y,
    waterLayer: target.cell.waterLayer ?? 'T1',
  });
}
