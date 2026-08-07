const freezeFields = (fields) => Object.freeze(fields.map((field) => Object.freeze(field)));

// These are the editor's official starting values. They are written onto new
// instances, displayed in the Inspector, and available again through Reset.
// A saved map may override them per object without changing later placements.
export const FREE_OBJECT_SETTING_FIELDS = Object.freeze({
  ink: freezeFields([
    { key: 'size', label: '大小', unit: 'px', min: 8, max: 96, step: 1, defaultValue: 22 },
    { key: 'visibilityRadius', label: '可見範圍', unit: 'px', min: 24, max: 360, step: 1, defaultValue: 110 },
  ]),
  mine: freezeFields([
    { key: 'size', label: '大小', unit: 'px', min: 8, max: 96, step: 1, defaultValue: 17 },
    { key: 'damage', label: '傷害', unit: 'HP', min: 0, max: 100, step: 1, defaultValue: 24 },
  ]),
  razor: freezeFields([
    { key: 'size', label: '大小', unit: 'px', min: 20, max: 180, step: 1, defaultValue: 48 },
    { key: 'count', label: '剃刀數量', unit: '個', min: 1, max: 4, step: 1, defaultValue: 1 },
    { key: 'damage', label: '傷害', unit: 'HP', min: 0, max: 100, step: 1, defaultValue: 20 },
    { key: 'knockbackSpeed', label: '強制位移', unit: 'px/s', min: 0, max: 140, step: 1, defaultValue: 58 },
    { key: 'rotationSpeed', label: '旋轉速度', unit: '度/s', min: 0, max: 720, step: 1, defaultValue: 180 },
  ]),
  button: freezeFields([
    { key: 'size', label: '大小', unit: 'px', min: 12, max: 72, step: 1, defaultValue: 24 },
  ]),
  weightStone: freezeFields([
    { key: 'size', label: '大小', unit: 'px', min: 8, max: 120, step: 1, defaultValue: 17 },
    { key: 'breakSpeed', label: '破壞所需速度', unit: 'px/s', min: 1, max: 140, step: 1, defaultValue: 31 },
    { key: 'weight', label: '重量下壓', unit: 'px/s', min: 0, max: 30, step: 1, defaultValue: 4 },
  ]),
  oxygen: freezeFields([
    { key: 'size', label: '大小', unit: 'px', min: 8, max: 96, step: 1, defaultValue: 17 },
    { key: 'oxygenAmount', label: '提供氧氣', unit: 'O₂', min: 0, max: 100, step: 1, defaultValue: 100 },
    { key: 'activationSpeed', label: '釋放所需速度', unit: 'px/s', min: 0, max: 140, step: 1, defaultValue: 31 },
  ]),
  bubble: freezeFields([
    { key: 'size', label: '大小', unit: 'px', min: 8, max: 96, step: 1, defaultValue: 17 },
    { key: 'oxygenAmount', label: '提供氧氣', unit: 'O₂', min: 0, max: 100, step: 1, defaultValue: 20 },
    { key: 'gravityImmunitySeconds', label: '免疫重力時間', unit: '秒', min: 0, max: 12, step: 0.1, defaultValue: 2.5 },
  ]),
  torricelli: freezeFields([
    { key: 'size', label: '大小', unit: 'px', min: 8, max: 120, step: 1, defaultValue: 17 },
    { key: 'oxygenRecoveryPerSecond', label: '氧氣恢復速度', unit: 'O₂/s', min: 0, max: 100, step: 1, defaultValue: 20 },
  ]),
  checkpoint: freezeFields([
    { key: 'size', label: '大小', unit: 'px', min: 8, max: 96, step: 1, defaultValue: 17 },
  ]),
  seaweed: freezeFields([
    { key: 'size', label: '大小', unit: 'px', min: 8, max: 120, step: 1, defaultValue: 17 },
  ]),
  coralCluster: freezeFields([
    { key: 'size', label: '大小', unit: 'px', min: 8, max: 120, step: 1, defaultValue: 17 },
  ]),
});

export const EDGE_SETTING_FIELDS = Object.freeze({
  springJelly: freezeFields([
    { key: 'size', label: '大小', unit: '倍率', min: 0.5, max: 2.5, step: 0.1, defaultValue: 1 },
    { key: 'bounceMultiplier', label: '彈力倍率', unit: '倍', min: 0.1, max: 3, step: 0.01, defaultValue: 1.08 },
  ]),
  spike: freezeFields([
    { key: 'size', label: '大小', unit: '倍率', min: 0.5, max: 2.5, step: 0.1, defaultValue: 1 },
    { key: 'damage', label: '傷害', unit: 'HP', min: 0, max: 100, step: 1, defaultValue: 20 },
  ]),
  barrier: freezeFields([
    { key: 'size', label: '大小', unit: '倍率', min: 0.5, max: 2.5, step: 0.1, defaultValue: 1 },
  ]),
  current: freezeFields([
    { key: 'size', label: '箭頭大小', unit: '倍率', min: 0.5, max: 2.5, step: 0.1, defaultValue: 1 },
  ]),
  seaweed: freezeFields([
    { key: 'size', label: '大小', unit: '倍率', min: 0.5, max: 2.5, step: 0.1, defaultValue: 1 },
  ]),
  coralCluster: freezeFields([
    { key: 'size', label: '大小', unit: '倍率', min: 0.5, max: 2.5, step: 0.1, defaultValue: 1 },
  ]),
  layerPortal: freezeFields([
    { key: 'size', label: '階梯大小', unit: '倍率', min: 0.5, max: 2.5, step: 0.1, defaultValue: 1 },
  ]),
  multiPortal: freezeFields([
    { key: 'size', label: '傳送門大小', unit: '倍率', min: 0.5, max: 2.5, step: 0.1, defaultValue: 1 },
  ]),
});

function setting(fields, key) {
  return fields.find((field) => field.key === key) ?? null;
}

function valueFor(fields, source, key) {
  const field = setting(fields, key);
  if (!field) return undefined;
  const raw = key === 'size' ? source?.size : source?.params?.[key];
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return field.defaultValue;
  return Math.min(field.max, Math.max(field.min, parsed));
}

function officialState(fields) {
  const params = {};
  let size = 1;
  fields.forEach((field) => {
    if (field.key === 'size') size = field.defaultValue;
    else params[field.key] = field.defaultValue;
  });
  return { size, params };
}

export function getFreeObjectFields(kind) {
  return FREE_OBJECT_SETTING_FIELDS[kind] ?? freezeFields([{ key: 'size', label: '大小', unit: 'px', min: 8, max: 120, step: 1, defaultValue: 17 }]);
}

export function getEdgeFields(type) {
  return EDGE_SETTING_FIELDS[type] ?? freezeFields([{ key: 'size', label: '大小', unit: '倍率', min: 0.5, max: 2.5, step: 0.1, defaultValue: 1 }]);
}

export function getOfficialFreeObjectState(kind) {
  return officialState(getFreeObjectFields(kind));
}

export function getOfficialEdgeState(type) {
  return officialState(getEdgeFields(type));
}

export function getFreeObjectSetting(object, key) {
  return valueFor(getFreeObjectFields(object?.kind), object, key);
}

export function getEdgeSetting(edge, key) {
  return valueFor(getEdgeFields(edge?.type), edge, key);
}

export function getFreeObjectHitRadius(object) {
  return getFreeObjectSetting(object, 'size') / 2;
}
