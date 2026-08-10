import { getDiscoveryTypedDescription } from './visor-discovery.js';
import { translateGameplayText } from './i18n-gameplay.js';

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

export function getDiscoveryGuideLayout(active, index, camera, viewport) {
  const half = Math.max(7, active.size * .58);
  const placeOnRight = active.x < camera.x + viewport.width * .56;
  const panelWidth = 66;
  const panelHeight = 28;
  const rawPanelX = placeOnRight ? active.x + half + 8 : active.x - half - panelWidth - 8;
  const panelX = clamp(rawPanelX, camera.x + 3, camera.x + viewport.width - panelWidth - 3);
  const panelY = clamp(active.y - panelHeight * .5 + (index % 3) * 4, camera.y + 3, camera.y + viewport.height - panelHeight - 3);
  return {
    half,
    placeOnRight,
    panelX,
    panelY,
    panelWidth,
    panelHeight,
    panel: { x: panelX, y: panelY, width: panelWidth, height: panelHeight },
    ok: { x: panelX + panelWidth - 14, y: panelY + panelHeight - 7, width: 11, height: 4.5 },
  };
}

export function hitTestDiscoveryAcknowledgement(hitTargets, point) {
  return [...hitTargets].reverse().find((target) => (
    point.x >= target.x
    && point.x <= target.x + target.width
    && point.y >= target.y
    && point.y <= target.y + target.height
  )) ?? null;
}

export function drawDiscoveryGuides(context, activeGuides, camera, viewport, timeSeconds) {
  if (!activeGuides.length) return [];
  const hitTargets = [];
  const active = activeGuides[0];
  {
    const { half, placeOnRight, panelX, panelY, panelWidth, panelHeight, panel, ok } = getDiscoveryGuideLayout(active, 0, camera, viewport);
    const lineEndX = placeOnRight ? panelX : panelX + panelWidth;
    const typedDescription = getDiscoveryTypedDescription(active, timeSeconds, 24, translateGameplayText);
    const descriptionLines = splitText(typedDescription);
    const categoryLabel = translateGameplayText(active.guide.categoryLabel);
    const title = translateGameplayText(active.guide.title);

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
    context.fillText(categoryLabel, panelX + 4, panelY + 2.2);
    context.font = '700 3.4px system-ui, sans-serif';
    context.fillStyle = '#effff8';
    context.fillText(title, panelX + 4, panelY + 6.2);
    context.font = '2.7px system-ui, sans-serif';
    context.fillStyle = '#bcefd5';
    descriptionLines.forEach((line, lineIndex) => context.fillText(line, panelX + 4, panelY + 11.4 + lineIndex * 4.1));

    context.fillStyle = 'rgba(141, 255, 196, .14)';
    context.strokeStyle = VISOR_GREEN;
    context.lineWidth = .45;
    context.fillRect(ok.x, ok.y, ok.width, ok.height);
    context.strokeRect(ok.x, ok.y, ok.width, ok.height);
    context.font = '700 2.7px system-ui, sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillStyle = '#effff8';
    context.fillText('OK', ok.x + ok.width * .5, ok.y + ok.height * .5 + .1);
    context.restore();
    hitTargets.push({ guideKey: active.guideKey, ...panel });
  }
  return hitTargets;
}
