import {
  allMapEdges,
  getActiveEdge,
  getHexCenter,
  patchEdge,
} from './map-model.js';

export const MULTI_PORTAL_EDGE_TYPE = 'multiPortal';

function activePortalEntries(map, chapter = 'chapter1') {
  return allMapEdges(map)
    .map((target) => ({ ...target, edge: getActiveEdge(map, target.key, chapter) }))
    .filter(({ edge }) => edge?.type === MULTI_PORTAL_EDGE_TYPE);
}

export function getPortalGroupId(edge) {
  return edge?.type === MULTI_PORTAL_EDGE_TYPE ? edge.portalGroupId ?? null : null;
}

export function getPortalGroupEdges(map, groupId, chapter = 'chapter1') {
  if (!groupId) return [];
  return activePortalEntries(map, chapter)
    .filter(({ edge }) => edge.portalGroupId === groupId)
    .sort((left, right) => (Number(left.edge.portalSlot) || 0) - (Number(right.edge.portalSlot) || 0));
}

export function getPortalGroupMidpoint(map, groupId, chapter = 'chapter1', origin = { x: 0, y: 0 }) {
  const entries = getPortalGroupEdges(map, groupId, chapter);
  if (!entries.length) return null;
  const points = entries.map(({ a, b }) => {
    const centerA = getHexCenter(map.cells[a], origin);
    const centerB = getHexCenter(map.cells[b], origin);
    return { x: (centerA.x + centerB.x) / 2, y: (centerA.y + centerB.y) / 2 };
  });
  return points.reduce((sum, point) => ({ x: sum.x + point.x / points.length, y: sum.y + point.y / points.length }), { x: 0, y: 0 });
}

export function getPortalGroupAnchor(map, groupId, chapter = 'chapter1', origin = { x: 0, y: 0 }) {
  const entries = getPortalGroupEdges(map, groupId, chapter);
  const blockedCenters = [];
  entries.forEach(({ a, b }) => {
    [a, b].forEach((key) => {
      const cell = map.cells[key];
      if (cell?.terrain === 'blocked') blockedCenters.push(getHexCenter(cell, origin));
    });
  });
  if (!blockedCenters.length) return getPortalGroupMidpoint(map, groupId, chapter, origin);
  return blockedCenters.reduce((sum, point) => ({
    x: sum.x + point.x / blockedCenters.length,
    y: sum.y + point.y / blockedCenters.length,
  }), { x: 0, y: 0 });
}

export function getPortalPartnerEdge(map, edgeTarget, chapter = 'chapter1') {
  const edge = edgeTarget?.edge ?? getActiveEdge(map, edgeTarget?.key, chapter);
  const targetKey = edge?.portalTargetKey;
  if (!targetKey) return null;
  const target = allMapEdges(map).find((candidate) => candidate.key === targetKey);
  if (!target) return null;
  const targetEdge = getActiveEdge(map, target.key, chapter);
  if (targetEdge?.type !== MULTI_PORTAL_EDGE_TYPE) return null;
  return { ...target, edge: targetEdge };
}

export function connectPortalGroups(map, firstGroupId, secondGroupId, chapter = 'chapter1') {
  if (!firstGroupId || !secondGroupId || firstGroupId === secondGroupId) return { ok: false, reason: 'sameGroup' };
  const first = getPortalGroupEdges(map, firstGroupId, chapter);
  const second = getPortalGroupEdges(map, secondGroupId, chapter);
  if (!first.length || !second.length) return { ok: false, reason: 'missingGroup' };
  if (first.length !== second.length) return { ok: false, reason: 'countMismatch', firstCount: first.length, secondCount: second.length };
  first.forEach((entry, index) => {
    patchEdge(map, entry.a, entry.b, { portalTargetKey: second[index].key }, chapter);
    patchEdge(map, second[index].a, second[index].b, { portalTargetKey: entry.key }, chapter);
  });
  return { ok: true, count: first.length };
}

export function disconnectPortalGroup(map, groupId, chapter = 'chapter1') {
  const entries = getPortalGroupEdges(map, groupId, chapter);
  entries.forEach((entry) => patchEdge(map, entry.a, entry.b, { portalTargetKey: null }, chapter));
  activePortalEntries(map, chapter).forEach((entry) => {
    if (entry.edge.portalTargetKey && entries.some((candidate) => candidate.key === entry.edge.portalTargetKey)) {
      patchEdge(map, entry.a, entry.b, { portalTargetKey: null }, chapter);
    }
  });
  return entries.length;
}
