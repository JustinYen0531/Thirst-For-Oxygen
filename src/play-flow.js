import { HEX_SIZE, getActiveCell, getHexCenter } from './map-model.js';

export const FIRST_DESCENT_PART = 1;
export const LAST_DESCENT_PART = 3;
export const FINAL_BOSS_ID = 'abyssalSpermWhale';

function normalizeDescentPart(mapPart) {
  const part = Number(mapPart);
  return Number.isInteger(part) && part >= FIRST_DESCENT_PART && part <= LAST_DESCENT_PART
    ? part
    : FIRST_DESCENT_PART;
}

function isEnemyDefeated(enemy) {
  return enemy?.resonanceNeutral === true || enemy?.defeated === true || (Number.isFinite(enemy?.health) && enemy.health <= 0);
}

export function getPlayExitPosition(map, origin = { x: 0, y: 0 }, chapter = 'chapter1') {
  const exitCellKey = map?.metadata?.exitCellKey;
  if (!exitCellKey) return null;
  const cell = getActiveCell(map, exitCellKey, chapter);
  if (!cell || cell.terrain !== 'water') return null;
  return { cellKey: exitCellKey, ...getHexCenter(cell, origin) };
}

export function getPlayStageExitState({
  map,
  mapPart,
  actor,
  enemies = [],
  origin = { x: 0, y: 0 },
  chapter = 'chapter1',
  arrivalRadius = HEX_SIZE * 0.72,
} = {}) {
  const part = normalizeDescentPart(mapPart);
  const exit = getPlayExitPosition(map, origin, chapter);
  const authoredEncounterId = map?.metadata?.bossRoom?.enemyId ?? null;
  const finalBossRequired = part === LAST_DESCENT_PART;
  const requiredBossId = authoredEncounterId ?? (finalBossRequired ? FINAL_BOSS_ID : null);
  const encounterBosses = requiredBossId ? enemies.filter((enemy) => enemy?.enemyId === requiredBossId) : [];
  const encounterPresent = encounterBosses.length > 0;
  const encounterDefeated = encounterPresent && encounterBosses.every(isEnemyDefeated);
  const encounterRequired = Boolean(requiredBossId);
  const bossDefeated = encounterDefeated;
  const finalBossPresent = requiredBossId === FINAL_BOSS_ID && encounterPresent;
  const unlocked = Boolean(exit) && (!encounterRequired || encounterDefeated);
  const hasActorPosition = Number.isFinite(actor?.x) && Number.isFinite(actor?.y);
  const distance = exit && hasActorPosition ? Math.hypot(actor.x - exit.x, actor.y - exit.y) : null;
  const effectiveArrivalRadius = Number.isFinite(arrivalRadius) ? Math.max(0, arrivalRadius) : HEX_SIZE * 0.72;
  const actorRadius = Number.isFinite(actor?.radius) ? Math.max(0, actor.radius) : 0;
  const arrived = unlocked && distance !== null && distance <= effectiveArrivalRadius + actorRadius;
  return {
    part,
    exit,
    unlocked,
    arrived,
    completed: arrived && part >= LAST_DESCENT_PART,
    nextPart: arrived && part < LAST_DESCENT_PART ? part + 1 : null,
    encounterRequired,
    requiredBossId,
    encounterPresent,
    encounterDefeated,
    finalBossRequired,
    finalBossPresent,
    bossDefeated,
    distance,
  };
}
