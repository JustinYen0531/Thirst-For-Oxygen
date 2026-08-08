const BLOCKED_TERRAIN = 'blocked';

export function getEdgeAttachmentGeometry(centerA, centerB, terrainA, terrainB, options = {}) {
  const dx = centerB.x - centerA.x;
  const dy = centerB.y - centerA.y;
  const centerDistance = Math.hypot(dx, dy);
  if (!Number.isFinite(centerDistance) || centerDistance <= 0) return null;

  const normal = { x: dx / centerDistance, y: dy / centerDistance };
  const tangent = { x: -normal.y, y: normal.x };
  const midpoint = {
    x: (centerA.x + centerB.x) / 2,
    y: (centerA.y + centerB.y) / 2,
  };
  const halfEdgeLength = Math.max(0, Number(options.edgeLength) || 0) / 2;
  const edgeStart = {
    x: midpoint.x - tangent.x * halfEdgeLength,
    y: midpoint.y - tangent.y * halfEdgeLength,
  };
  const edgeEnd = {
    x: midpoint.x + tangent.x * halfEdgeLength,
    y: midpoint.y + tangent.y * halfEdgeLength,
  };

  const aIsBlocked = terrainA === BLOCKED_TERRAIN;
  const bIsBlocked = terrainB === BLOCKED_TERRAIN;
  const hasOneBlockedSide = aIsBlocked !== bIsBlocked;
  const blockedDirection = hasOneBlockedSide
    ? (aIsBlocked ? { x: -normal.x, y: -normal.y } : normal)
    : { x: 0, y: 0 };
  const openDirection = { x: -blockedDirection.x, y: -blockedDirection.y };
  const blockedInset = hasOneBlockedSide ? Math.max(0, Number(options.blockedInset) || 0) : 0;
  const attachmentPoint = {
    x: midpoint.x + blockedDirection.x * blockedInset,
    y: midpoint.y + blockedDirection.y * blockedInset,
  };
  const tangentAngle = Math.atan2(tangent.y, tangent.x);
  const openAngle = hasOneBlockedSide ? Math.atan2(openDirection.y, openDirection.x) : null;

  return {
    midpoint,
    edgeStart,
    edgeEnd,
    attachmentPoint,
    blockedDirection,
    openDirection,
    tangentAngle,
    // The spike art points toward local +Y; plants grow toward local -Y.
    pointsIntoOpenAngle: openAngle === null ? tangentAngle : openAngle - Math.PI / 2,
    growsIntoOpenAngle: openAngle === null ? tangentAngle : openAngle + Math.PI / 2,
  };
}
