import {
  allMapEdges,
  getHexCenter,
  getHexVertices,
} from './map-model.js';

function lowerBoundByY(entries, minimumY) {
  let low = 0;
  let high = entries.length;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (entries[middle].y < minimumY) low = middle + 1;
    else high = middle;
  }
  return low;
}

function visibleEntries(entries, camera, viewport, padding) {
  const minimumX = camera.x - padding;
  const maximumX = camera.x + viewport.width + padding;
  const minimumY = camera.y - padding;
  const maximumY = camera.y + viewport.height + padding;
  const visible = [];
  for (let index = lowerBoundByY(entries, minimumY); index < entries.length; index += 1) {
    const entry = entries[index];
    if (entry.y > maximumY) break;
    if (entry.x >= minimumX && entry.x <= maximumX) visible.push(entry);
  }
  return visible;
}

export function createPlayRenderIndex(map, origin = { x: 0, y: 0 }) {
  const cells = Object.entries(map?.cells ?? {}).map(([key, cell]) => {
    const center = getHexCenter(cell, origin);
    return {
      key,
      x: center.x,
      y: center.y,
      center,
      vertices: getHexVertices(cell, origin),
    };
  }).sort((left, right) => left.y - right.y || left.x - right.x);

  const edges = allMapEdges(map).map(({ a, b, key }) => {
    const from = getHexCenter(map.cells[a], origin);
    const to = getHexCenter(map.cells[b], origin);
    return {
      a,
      b,
      key,
      from,
      to,
      x: (from.x + to.x) * 0.5,
      y: (from.y + to.y) * 0.5,
    };
  }).sort((left, right) => left.y - right.y || left.x - right.x);

  return { cells, edges };
}

export function getVisiblePlayCells(index, camera, viewport, padding = 48) {
  return visibleEntries(index?.cells ?? [], camera, viewport, Math.max(0, padding));
}

export function getVisiblePlayEdges(index, camera, viewport, padding = 52) {
  return visibleEntries(index?.edges ?? [], camera, viewport, Math.max(0, padding));
}

export function createPlayUpdateGate(intervalMs) {
  const interval = Math.max(0, Number(intervalMs) || 0);
  let lastUpdateAt = -Infinity;
  return {
    reset() { lastUpdateAt = -Infinity; },
    shouldUpdate(now, force = false) {
      const time = Number(now) || 0;
      if (!force && time - lastUpdateAt < interval) return false;
      lastUpdateAt = time;
      return true;
    },
  };
}
