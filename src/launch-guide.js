// Keep the visible range in lockstep with physics.js launchDistance(). The
// solid pull line may still follow the pointer farther than this cap, while
// the dashed preview stops where a real launch can actually reach.
export const MAX_LAUNCH_GUIDE_DISTANCE = 420;

export function getLaunchGuideGeometry(from, to, steps = 48) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const pullDistance = Math.hypot(dx, dy);
  const distance = Math.min(pullDistance, MAX_LAUNCH_GUIDE_DISTANCE);
  const safeDistance = pullDistance || 1;
  const pullDirection = { x: dx / safeDistance, y: dy / safeDistance };
  const normal = { x: -dy / safeDistance, y: dx / safeDistance };
  const launchDirection = { x: -dx / safeDistance, y: -dy / safeDistance };
  const projectedTo = {
    x: from.x + launchDirection.x * distance,
    y: from.y + launchDirection.y * distance,
  };
  const count = Math.max(1, Math.floor(steps));
  const points = Array.from({ length: count }, (_, index) => {
    const progress = (index + 1) / count;
    return {
      x: from.x + dx * progress,
      y: from.y + dy * progress,
    };
  });
  const markerCount = Math.max(3, Math.min(8, Math.floor(distance / 54) + 2));
  const markers = Array.from({ length: markerCount }, (_, index) => {
    const progress = (index + 1) / (markerCount + 1);
    return {
      x: from.x + (projectedTo.x - from.x) * progress,
      y: from.y + (projectedTo.y - from.y) * progress,
      progress,
      side: index % 2 === 0 ? 1 : -1,
    };
  });
  const forwardPoints = Array.from({ length: count }, (_, index) => {
    const progress = (index + 1) / count;
    return {
      x: from.x + (projectedTo.x - from.x) * progress,
      y: from.y + (projectedTo.y - from.y) * progress,
    };
  });
  return {
    distance,
    pullDistance,
    dx,
    dy,
    angle: Math.atan2(launchDirection.y, launchDirection.x),
    normal,
    pullDirection,
    launchDirection,
    projectedTo,
    points,
    forwardPoints,
    markers,
  };
}

function drawHexagon(context, x, y, radius, rotation) {
  context.beginPath();
  for (let index = 0; index < 6; index += 1) {
    const angle = rotation + (Math.PI * 2 * index) / 6;
    const point = { x: x + Math.cos(angle) * radius, y: y + Math.sin(angle) * radius };
    if (index === 0) context.moveTo(point.x, point.y);
    else context.lineTo(point.x, point.y);
  }
  context.closePath();
}

export function drawLaunchGuide(context, geometry, from, to, timeSeconds = 0) {
  if (!geometry?.distance) return;
  const pulse = ((timeSeconds * 1.8) % 1 + 1) % 1;
  const direction = geometry.pullDirection ?? { x: geometry.dx, y: geometry.dy };
  context.save();
  context.globalCompositeOperation = 'screen';
  context.lineCap = 'round';
  context.lineJoin = 'round';

  // The pull is a solid line behind the diver. The launch preview is a
  // separate dashed line in front, so the player can read both force and
  // straight-line range without seeing a gravity-adjusted trajectory.
  context.strokeStyle = 'rgba(64, 224, 255, 0.2)';
  context.lineWidth = 5.5;
  context.beginPath();
  context.moveTo(from.x, from.y);
  context.lineTo(to.x, to.y);
  context.stroke();

  context.strokeStyle = 'rgba(255, 235, 117, 0.96)';
  context.lineWidth = 2.05;
  context.setLineDash([]);
  context.beginPath();
  context.moveTo(from.x, from.y);
  context.lineTo(to.x, to.y);
  context.stroke();

  context.strokeStyle = 'rgba(103, 239, 255, 0.28)';
  context.lineWidth = 4.5;
  context.setLineDash([7, 8]);
  context.beginPath();
  context.moveTo(from.x, from.y);
  context.lineTo(geometry.projectedTo.x, geometry.projectedTo.y);
  context.stroke();

  context.strokeStyle = 'rgba(255, 235, 117, 0.96)';
  context.lineWidth = 1.35;
  context.setLineDash([5, 7]);
  context.beginPath();
  context.moveTo(from.x, from.y);
  context.lineTo(geometry.projectedTo.x, geometry.projectedTo.y);
  context.stroke();
  context.setLineDash([]);

  geometry.markers.forEach((marker, index) => {
    const markerPulse = (pulse + marker.progress * 0.9) % 1;
    const radius = 2.35 + Math.sin(markerPulse * Math.PI * 2) * 0.65;
    const finLength = 3.5 + markerPulse * 2.6;
    const side = marker.side;
    const finStart = {
      x: marker.x - direction.x * 2.5,
      y: marker.y - direction.y * 2.5,
    };
    const finTip = {
      x: marker.x + geometry.normal.x * finLength * side,
      y: marker.y + geometry.normal.y * finLength * side,
    };
    context.strokeStyle = `rgba(103, 239, 255, ${0.4 + markerPulse * 0.35})`;
    context.lineWidth = 0.9;
    context.beginPath();
    context.moveTo(finStart.x, finStart.y);
    context.lineTo(finTip.x, finTip.y);
    context.lineTo(marker.x + direction.x * 2.5, marker.y + direction.y * 2.5);
    context.stroke();

    context.fillStyle = 'rgba(255, 235, 117, 0.94)';
    drawHexagon(context, marker.x, marker.y, radius, geometry.angle + (index % 2 ? 0.25 : -0.25));
    context.fill();
  });

  const startRadius = 5 + Math.sin(timeSeconds * 4) * 0.75;
  context.strokeStyle = 'rgba(112, 242, 255, 0.88)';
  context.lineWidth = 1.1;
  context.beginPath();
  context.arc(from.x, from.y, startRadius, 0, Math.PI * 2);
  context.stroke();

  // The pull handle gets its own small gyro ring so it remains visually
  // distinct from the forward range preview.
  context.strokeStyle = 'rgba(255, 235, 117, 0.9)';
  context.lineWidth = 0.9;
  context.beginPath();
  context.arc(to.x, to.y, 3.4 + Math.sin(timeSeconds * 4 + 1) * 0.45, 0, Math.PI * 2);
  context.stroke();

  drawDiverShadow(context, geometry.projectedTo, geometry.angle, timeSeconds);

  const endRadius = 6 + Math.sin(timeSeconds * 3 + 0.8) * 0.75;
  context.strokeStyle = 'rgba(255, 235, 117, 0.98)';
  context.lineWidth = 1.25;
  drawHexagon(context, geometry.projectedTo.x, geometry.projectedTo.y, endRadius, geometry.angle);
  context.stroke();
  context.strokeStyle = 'rgba(103, 239, 255, 0.72)';
  context.lineWidth = 0.75;
  drawHexagon(context, geometry.projectedTo.x, geometry.projectedTo.y, endRadius + 3.2, geometry.angle + Math.PI / 6);
  context.stroke();
  context.beginPath();
  context.moveTo(geometry.projectedTo.x - geometry.normal.x * 4, geometry.projectedTo.y - geometry.normal.y * 4);
  context.lineTo(geometry.projectedTo.x + geometry.normal.x * 4, geometry.projectedTo.y + geometry.normal.y * 4);
  context.stroke();
  context.restore();
}

function drawDiverShadow(context, position, angle, timeSeconds) {
  const breathing = 1 + Math.sin(timeSeconds * 3.2 + 0.4) * 0.045;
  const alpha = 0.2 + (Math.sin(timeSeconds * 2.4) + 1) * 0.025;
  context.save();
  context.translate(position.x, position.y);
  context.rotate(angle);
  context.scale(breathing, breathing);
  context.globalCompositeOperation = 'source-over';
  context.globalAlpha = alpha;
  context.fillStyle = '#aab9bd';
  context.strokeStyle = '#d4e2df';
  context.lineWidth = 0.65;
  context.beginPath();
  context.arc(2.5, -3.8, 2.7, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.beginPath();
  context.ellipse(0, 2, 3.7, 6.2, 0, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.beginPath();
  context.moveTo(-2.5, 5.4);
  context.lineTo(-6.4, 8.2);
  context.lineTo(-1.2, 7.1);
  context.closePath();
  context.fill();
  context.stroke();
  context.beginPath();
  context.moveTo(1.8, 5.4);
  context.lineTo(5.7, 8.2);
  context.lineTo(1.1, 7.1);
  context.closePath();
  context.fill();
  context.stroke();
  context.restore();
}
