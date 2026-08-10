export const DAMAGE_REDUCTION_STORAGE_KEY = 'thirst-for-oxygen-play-damage-reduction';
export const RESOURCE_COST_REDUCTION_STORAGE_KEY = 'thirst-for-oxygen-play-resource-cost-reduction';
export const AMBIENT_ENABLED_STORAGE_KEY = 'thirst-for-oxygen-ambient-enabled';

export const DAMAGE_REDUCTION_OPTIONS = Object.freeze([0, 0.3, 0.5, 0.75, 0.9]);
export const DAMAGE_REDUCTION_DEFAULT = 0.5;
export const RESOURCE_COST_REDUCTION_DEFAULT = 0.3;
export const AMBIENT_ENABLED_DEFAULT = true;

function resolveStorage(storage) {
  if (storage !== undefined) return storage;
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function readStoredNumber(storage, key, options, defaultValue) {
  try {
    const stored = storage?.getItem?.(key);
    if (stored === null || stored === undefined || stored === '') return defaultValue;
    const value = Number(stored);
    return options.includes(value) ? value : defaultValue;
  } catch {
    return defaultValue;
  }
}

function writeStoredValue(storage, key, value) {
  try {
    storage?.setItem?.(key, String(value));
  } catch {
    // Settings still apply to the current page when storage is unavailable.
  }
  return value;
}

export function getPlayerDamageReduction(storage = undefined) {
  return readStoredNumber(
    resolveStorage(storage),
    DAMAGE_REDUCTION_STORAGE_KEY,
    DAMAGE_REDUCTION_OPTIONS,
    DAMAGE_REDUCTION_DEFAULT,
  );
}

export function setPlayerDamageReduction(value, storage = undefined) {
  const nextValue = DAMAGE_REDUCTION_OPTIONS.includes(Number(value))
    ? Number(value)
    : DAMAGE_REDUCTION_DEFAULT;
  return writeStoredValue(resolveStorage(storage), DAMAGE_REDUCTION_STORAGE_KEY, nextValue);
}

export function getResourceCostReduction(storage = undefined) {
  return readStoredNumber(
    resolveStorage(storage),
    RESOURCE_COST_REDUCTION_STORAGE_KEY,
    DAMAGE_REDUCTION_OPTIONS,
    RESOURCE_COST_REDUCTION_DEFAULT,
  );
}

export function setResourceCostReduction(value, storage = undefined) {
  const nextValue = DAMAGE_REDUCTION_OPTIONS.includes(Number(value))
    ? Number(value)
    : RESOURCE_COST_REDUCTION_DEFAULT;
  return writeStoredValue(resolveStorage(storage), RESOURCE_COST_REDUCTION_STORAGE_KEY, nextValue);
}

export function getAmbientEnabled(storage = undefined) {
  const resolvedStorage = resolveStorage(storage);
  try {
    const stored = resolvedStorage?.getItem?.(AMBIENT_ENABLED_STORAGE_KEY);
    if (stored === null || stored === undefined) return AMBIENT_ENABLED_DEFAULT;
    if (stored === 'true') return true;
    if (stored === 'false') return false;
    return AMBIENT_ENABLED_DEFAULT;
  } catch {
    return AMBIENT_ENABLED_DEFAULT;
  }
}

export function setAmbientEnabled(enabled, storage = undefined) {
  return writeStoredValue(resolveStorage(storage), AMBIENT_ENABLED_STORAGE_KEY, Boolean(enabled));
}
