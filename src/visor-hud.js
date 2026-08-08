export const VISOR_HUD_ASSET = '/assets/editor/hud/visor-frame-balanced.png';
export const ENERGY_SLOT_COUNT = 5;
export const ENERGY_STEP_COUNT = ENERGY_SLOT_COUNT * 2;
export const HEALTH_SEGMENT_COUNT = 10;

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function formatHalf(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function getHealthColor(ratio) {
  const hue = Math.round(clamp(ratio, 0, 1) * 120);
  return Object.freeze({
    color: `hsl(${hue} 84% 68%)`,
    glow: `hsla(${hue} 90% 65% / 0.92)`,
  });
}

export function getOxygenHud(value, maximum) {
  const safeMaximum = Math.max(1, Number(maximum) || 1);
  const safeValue = clamp(Number(value) || 0, 0, safeMaximum);
  const ratio = safeValue / safeMaximum;
  return Object.freeze({
    value: safeValue,
    ratio,
    label: `${Math.round(ratio * 100)}%`,
  });
}

export function getEnergyHud(value, maximum) {
  const safeMaximum = Math.max(1, Number(maximum) || 1);
  const safeValue = clamp(Number(value) || 0, 0, safeMaximum);
  const ratio = safeValue / safeMaximum;
  const level = Math.round(ratio * ENERGY_STEP_COUNT) / 2;
  const fills = Array.from({ length: ENERGY_SLOT_COUNT }, (_, index) => clamp(level - (ENERGY_SLOT_COUNT - 1 - index), 0, 1));
  return Object.freeze({
    value: safeValue,
    ratio,
    level,
    label: `${formatHalf(level)}/${ENERGY_SLOT_COUNT}`,
    fills: Object.freeze(fills),
  });
}

export function getHealthHud(value, maximum) {
  const safeMaximum = Math.max(1, Number(maximum) || 1);
  const safeValue = clamp(Number(value) || 0, 0, safeMaximum);
  const ratio = safeValue / safeMaximum;
  const fills = Array.from({ length: HEALTH_SEGMENT_COUNT }, (_, index) => clamp(ratio * HEALTH_SEGMENT_COUNT - index, 0, 1));
  const tone = safeValue >= safeMaximum ? 'full' : safeValue > safeMaximum * 0.3 ? 'warning' : 'critical';
  const colours = getHealthColor(ratio);
  return Object.freeze({
    value: safeValue,
    ratio,
    label: `${Math.round(safeValue)}`,
    tone,
    color: colours.color,
    glow: colours.glow,
    fills: Object.freeze(fills),
  });
}
