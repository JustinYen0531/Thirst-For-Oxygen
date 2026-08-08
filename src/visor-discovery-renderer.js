import { getDiscoveryTypedDescription } from './visor-discovery.js';

const VISOR_GREEN = '#8dffc4';

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function splitText(text, limit = 22) {
  if (!text) return [''];
  const lines = [];
  let remaining = text;
  while (remaining.length > limit && lines.length < 2) {
    let splitAt = limit;
    const punctuation = ['。', '；', '，', '、'].map((mark) => remaining.lastIndexOf(mark, limit)).filter((index) => index > limit * .45);
    if (punctuation.length) splitAt = Math.max(...punctuation) + 1;
    lines.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt);
  }
  if (lines.length < 2) lines.push(remaining);
  else if (remaining) lines[1] = `${lines[1].slice(0, Math.max(0, limit - 1))}…`;
  return lines.filter(Boolean);
}

function drawCornerReticle(context, x, y, half, cornerLength) {
  const left = x - half;
  const right = x + half;
  const top = y - half;
  const bottom = y + half;
  context.beginPath();
  context.moveTo(left + cornerLength, top); context.lineTo(left, top); context.lineTo(left, top + cornerLength);
  context.moveTo(right - cornerLength, top); context.lineTo(right, top); context.lineTo(right, top + cornerLength);
  context.moveTo(left, bottom - cornerLength); context.lineTo(left, bottom); context.lineTo(left + cornerLength, bottom);
  context.moveTo(right, bottom - cornerLength); context.lineTo(right, bottom); context.lineTo(right - cornerLength, bottom);
  context.stroke();
}

export function drawDiscoveryGuides(context, activeGuides, camera, viewport, timeSeconds) {
  if (!activeGuides.length) return;
  const viewLeft = camera.x;
  const viewTop = camera.y;
  const viewRight = camera.x + viewport.width;
  const viewBottom = camera.y + viewport.height;

  activeGuides.forEach((active, index) => {
    const half = Math.max(7, active.size * .58);
    const placeOnRight = active.x < camera.x + viewport.width * .56;
    const panelWidth = 66;
    const panelHeight = 24;
    const rawPanelX = placeOnRight ? active.x + half + 8 : active.x - half - panelWidth - 8;
    const panelX = clamp(rawPanelX, viewLeft + 3, viewRight - panelWidth - 3);
    const panelY = clamp(active.y - panelHeight * .5 + (index % 3) * 4, viewTop + 3, viewBottom - panelHeight - 3);
    const lineEndX = placeOnRight ? panelX : panelX + panelWidth;
    const typedDescription = getDiscoveryTypedDescription(active, timeSeconds);
    const descriptionLines = splitText(typedDescription);

    context.save();
    context.lineWidth = .75;
    context.strokeStyle = VISOR_GREEN;
    context.shadowColor = VISOR_GREEN;
    context.shadowBlur = 3;
    drawCornerReticle(context, active.x, active.y, half, Math.min(4.5, half * .45));

    context.beginPath();
    context.moveTo(active.x + (placeOnRight ? half : -half), active.y);
    context.lineTo(lineEndX, panelY + 7);
    context.stroke();

    context.shadowBlur = 0;
    context.fillStyle = 'rgba(2, 20, 29, .9)';
    context.strokeStyle = 'rgba(141, 255, 196, .92)';
    context.lineWidth = .45;
    context.fillRect(panelX, panelY, panelWidth, panelHeight);
    context.strokeRect(panelX, panelY, panelWidth, panelHeight);
    context.fillStyle = active.guide.colour;
    context.fillRect(panelX, panelY, 1.6, panelHeight);

    context.textBaseline = 'top';
    context.textAlign = 'left';
    context.font = '600 2.65px system-ui, sans-serif';
    context.fillStyle = active.guide.colour;
    context.fillText(active.guide.categoryLabel, panelX + 4, panelY + 2.2);
    context.font = '700 3.4px system-ui, sans-serif';
    context.fillStyle = '#effff8';
    context.fillText(active.guide.title, panelX + 4, panelY + 6.2);
    context.font = '2.7px system-ui, sans-serif';
    context.fillStyle = '#bcefd5';
    descriptionLines.forEach((line, lineIndex) => context.fillText(line, panelX + 4, panelY + 11.4 + lineIndex * 4.1));
    context.restore();
  });
}
