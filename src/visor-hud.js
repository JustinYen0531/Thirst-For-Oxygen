export const VISOR_HUD_ASSET = '/assets/editor/hud/visor-frame-balanced.png';
export const ENERGY_SLOT_COUNT = 5;
export const ENERGY_STEP_COUNT = ENERGY_SLOT_COUNT * 2;
export const HEALTH_SEGMENT_COUNT = 10;
export const PLAYER_HUD_SLOT_LAYOUT = Object.freeze([
  Object.freeze({ key: 'weapon-0', kind: 'weapon', index: 0 }),
  Object.freeze({ key: 'weapon-1', kind: 'weapon', index: 1 }),
  Object.freeze({ key: 'weapon-2', kind: 'weapon', index: 2 }),
  Object.freeze({ key: 'passive-0', kind: 'passive', index: 0 }),
  Object.freeze({ key: 'passive-1', kind: 'passive', index: 1 }),
  Object.freeze({ key: 'passive-2', kind: 'passive', index: 2 }),
]);

export const PLAYER_HUD_ICON_FAMILIES = Object.freeze({
  weapon: Object.freeze({
    knife: Object.freeze({ name: '小刀', basePath: '/assets/editor/icons/weapons/knife' }),
    katana: Object.freeze({ name: '武士刀', basePath: '/assets/editor/icons/weapons/katana' }),
    trident: Object.freeze({ name: '三叉戟', basePath: '/assets/editor/icons/weapons/trident' }),
    lightMachineGun: Object.freeze({ name: '輕量機槍', basePath: '/assets/editor/icons/weapons/lightMachineGun' }),
  }),
  passive: Object.freeze({
    oxygenCirculator: Object.freeze({ name: '氧循環器', basePath: '/assets/editor/icons/passives/oxygenCirculator' }),
    pressureStabilizer: Object.freeze({ name: '潮壓穩定器', basePath: '/assets/editor/icons/passives/pressureStabilizer' }),
    ecologicalCarapace: Object.freeze({ name: '生態甲殼', basePath: '/assets/editor/icons/passives/ecologicalCarapace' }),
    abyssalAmplifier: Object.freeze({ name: '深淵增幅器', basePath: '/assets/editor/icons/passives/abyssalAmplifier' }),
  }),
});

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function formatHalf(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function getPlayerHudIconPath(kind, id, level = 1) {
  const family = PLAYER_HUD_ICON_FAMILIES[kind]?.[id];
  if (!family) return null;
  const safeLevel = clamp(Math.round(Number(level) || 1), 1, 3);
  return `${family.basePath}/lv${safeLevel}.png`;
}

export function getPlayerHudSlots(loadout = {}) {
  return PLAYER_HUD_SLOT_LAYOUT.map((slot) => {
    const item = (loadout[slot.kind === 'weapon' ? 'weapons' : 'passives'] ?? [])[slot.index];
    const family = PLAYER_HUD_ICON_FAMILIES[slot.kind]?.[item?.id];
    const level = clamp(Math.round(Number(item?.level) || 1), 1, 3);
    return Object.freeze({
      ...slot,
      id: family ? item.id : null,
      level: family ? level : null,
      name: family?.name ?? '空槽',
      path: family ? getPlayerHudIconPath(slot.kind, item.id, level) : null,
    });
  });
}

export function getPlayerHudSlotLabel(slot) {
  return slot?.path ? `Level ${slot.level} · ${slot.name}` : '';
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
