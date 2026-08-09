const freezeFields = (fields) => Object.freeze(fields.map((field) => Object.freeze(field)));
export const MAP_OBJECT_SIZE = 30;
const FREE_OBJECT_COLLISION_DIAMETERS = Object.freeze({
  ink: 22,
  mine: 17,
  razor: 48,
  button: 24,
  weightStone: 17,
  oxygen: 17,
  bubble: 17,
  torricelli: 17,
  checkpoint: 17,
  seaweed: 17,
  coralCluster: 17,
});

const fixedSizeField = (label = '大小') => ({
  key: 'size',
  label,
  unit: 'px',
  min: MAP_OBJECT_SIZE,
  max: MAP_OBJECT_SIZE,
  step: 1,
  defaultValue: MAP_OBJECT_SIZE,
});

// These are the editor's official starting values. They are written onto new
// instances, displayed in the Inspector, and available again through Reset.
// A saved map may override them per object without changing later placements.
export const FREE_OBJECT_SETTING_FIELDS = Object.freeze({
  ink: freezeFields([
    fixedSizeField(),
    { key: 'visibilityRadius', label: '可見範圍', unit: 'px', min: 24, max: 360, step: 1, defaultValue: 110 },
  ]),
  mine: freezeFields([
    fixedSizeField(),
    { key: 'damage', label: '傷害', unit: 'HP', min: 0, max: 100, step: 1, defaultValue: 24 },
  ]),
  razor: freezeFields([
    fixedSizeField(),
    { key: 'count', label: '剃刀數量', unit: '個', min: 1, max: 4, step: 1, defaultValue: 1 },
    { key: 'damage', label: '傷害', unit: 'HP', min: 0, max: 100, step: 1, defaultValue: 20 },
    { key: 'knockbackSpeed', label: '強制位移', unit: 'px/s', min: 0, max: 140, step: 1, defaultValue: 58 },
    { key: 'rotationSpeed', label: '旋轉速度', unit: '度/s', min: 0, max: 720, step: 1, defaultValue: 180 },
  ]),
  button: freezeFields([
    fixedSizeField(),
  ]),
  weightStone: freezeFields([
    fixedSizeField(),
    { key: 'breakSpeed', label: '破壞所需速度', unit: 'px/s', min: 1, max: 140, step: 1, defaultValue: 31 },
    { key: 'weight', label: '重量下壓', unit: 'px/s', min: 0, max: 30, step: 1, defaultValue: 4 },
  ]),
  oxygen: freezeFields([
    fixedSizeField(),
    { key: 'oxygenAmount', label: '提供氧氣', unit: 'O₂', min: 0, max: 100, step: 1, defaultValue: 100 },
    { key: 'activationSpeed', label: '釋放所需速度', unit: 'px/s', min: 0, max: 140, step: 1, defaultValue: 31 },
  ]),
  bubble: freezeFields([
    fixedSizeField(),
    { key: 'oxygenAmount', label: '提供氧氣', unit: 'O₂', min: 0, max: 100, step: 1, defaultValue: 20 },
    { key: 'gravityImmunitySeconds', label: '免疫重力時間', unit: '秒', min: 0, max: 12, step: 0.1, defaultValue: 2.5 },
  ]),
  torricelli: freezeFields([
    fixedSizeField(),
    { key: 'oxygenRecoveryPerSecond', label: '氧氣恢復速度', unit: 'O₂/s', min: 0, max: 100, step: 1, defaultValue: 20 },
  ]),
  checkpoint: freezeFields([
    fixedSizeField(),
  ]),
  seaweed: freezeFields([
    fixedSizeField(),
  ]),
  coralCluster: freezeFields([
    fixedSizeField(),
  ]),
});

export const EDGE_SETTING_FIELDS = Object.freeze({
  springJelly: freezeFields([
    fixedSizeField(),
    { key: 'bounceMultiplier', label: '彈力倍率', unit: '倍', min: 0.1, max: 3, step: 0.01, defaultValue: 1.08 },
  ]),
  spike: freezeFields([
    fixedSizeField(),
    { key: 'damage', label: '傷害', unit: 'HP', min: 0, max: 100, step: 1, defaultValue: 20 },
  ]),
  barrier: freezeFields([
    fixedSizeField(),
  ]),
  current: freezeFields([
    fixedSizeField('箭頭大小'),
  ]),
  seaweed: freezeFields([
    fixedSizeField(),
  ]),
  coralCluster: freezeFields([
    fixedSizeField(),
  ]),
  layerPortal: freezeFields([
    fixedSizeField('階梯大小'),
  ]),
  multiPortal: freezeFields([
    fixedSizeField('傳送門大小'),
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
  return FREE_OBJECT_SETTING_FIELDS[kind] ?? freezeFields([fixedSizeField()]);
}

export function getEdgeFields(type) {
  return EDGE_SETTING_FIELDS[type] ?? freezeFields([fixedSizeField()]);
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
  // Rendering is uniformly 30 px, while authored contact footprints stay
  // independent so adjacent 24 px hexes do not activate each other's objects.
  return (FREE_OBJECT_COLLISION_DIAMETERS[object?.kind] ?? 17) / 2;
}

export function normalizeMapObjectSizes(map) {
  if (!map || typeof map !== 'object') return map;
  const normalizeCells = (cells = {}) => {
    Object.values(cells).forEach((cell) => {
      if (Array.isArray(cell?.objects)) cell.objects.forEach((object) => { object.size = MAP_OBJECT_SIZE; });
      if (Array.isArray(cell?.freeObjects)) cell.freeObjects.forEach((object) => { object.size = MAP_OBJECT_SIZE; });
    });
  };
  const normalizeEdges = (edges = {}) => {
    Object.values(edges).forEach((edge) => {
      if (edge && edge.type !== 'none') edge.size = MAP_OBJECT_SIZE;
    });
  };
  normalizeCells(map.cells);
  normalizeEdges(map.edges);
  Object.values(map.chapterStates ?? {}).forEach((chapter) => {
    normalizeCells(chapter?.cells);
    normalizeEdges(chapter?.edges);
  });
  return map;
}
