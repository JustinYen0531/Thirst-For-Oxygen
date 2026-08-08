export function getLaunchGuideGeometry(from, to, steps = 48) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.hypot(dx, dy);
  const safeDistance = distance || 1;
  const normal = { x: -dy / safeDistance, y: dx / safeDistance };
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
      x: from.x + dx * progress,
      y: from.y + dy * progress,
      progress,
      side: index % 2 === 0 ? 1 : -1,
    };
  });
  return { distance, dx, dy, angle: Math.atan2(dy, dx), normal, points, markers };
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
  const direction = { x: geometry.dx / geometry.distance, y: geometry.dy / geometry.distance };
  context.save();
  context.globalCompositeOperation = 'screen';
  context.lineCap = 'round';
  context.lineJoin = 'round';

  // A soft cyan pressure wake makes the guide readable without becoming the
  // twin solid beams used by the reference image.
  context.strokeStyle = 'rgba(64, 224, 255, 0.2)';
  context.lineWidth = 5.5;
  context.beginPath();
  context.moveTo(from.x, from.y);
  context.lineTo(to.x, to.y);
  context.stroke();

  context.strokeStyle = 'rgba(255, 235, 117, 0.96)';
  context.lineWidth = 1.45;
  context.setLineDash([8, 5]);
  context.beginPath();
  context.moveTo(from.x, from.y);
  context.lineTo(to.x, to.y);
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

  const endRadius = 6 + Math.sin(timeSeconds * 3 + 0.8) * 0.75;
  context.strokeStyle = 'rgba(255, 235, 117, 0.98)';
  context.lineWidth = 1.25;
  drawHexagon(context, to.x, to.y, endRadius, geometry.angle);
  context.stroke();
  context.strokeStyle = 'rgba(103, 239, 255, 0.72)';
  context.lineWidth = 0.75;
  drawHexagon(context, to.x, to.y, endRadius + 3.2, geometry.angle + Math.PI / 6);
  context.stroke();
  context.beginPath();
  context.moveTo(to.x - geometry.normal.x * 4, to.y - geometry.normal.y * 4);
  context.lineTo(to.x + geometry.normal.x * 4, to.y + geometry.normal.y * 4);
  context.stroke();
  context.restore();
}
