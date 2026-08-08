import { ENEMY_DEFINITIONS } from './game-data.js';
import { ENEMY_ENCYCLOPEDIA } from './enemy-encyclopedia.js';
import { getActiveCell, getHexCenter } from './map-model.js';

export const PLAY_ENEMY_POOLS = Object.freeze({
  1: Object.freeze(['explodingLanternfish', 'juvenileSeahorseCaller', 'explodingLanternfish', 'crabGuard']),
  2: Object.freeze(['lobsterSoldier', 'lionfishGunner', 'squidAssassin', 'splitLanternfish']),
  3: Object.freeze(['coralBackSeahorse', 'mantisShrimpBrute', 'nautilusOracle', 'arcTideRay', 'squidAssassin', 'splitLanternfish']),
});

const encyclopediaById = Object.freeze(Object.fromEntries(
  ENEMY_ENCYCLOPEDIA.map((entry) => [entry.id, entry]),
));

export const PLAY_ENEMY_VISUALS = Object.freeze(Object.fromEntries(
  Object.values(PLAY_ENEMY_POOLS).flat().map((enemyId) => {
    const visuals = encyclopediaById[enemyId]?.visuals;
    return [enemyId, visuals?.afterimageIdle ?? visuals?.idle ?? null];
  }),
));

function isRegularEnemy(enemyId) {
  return Number.isInteger(ENEMY_DEFINITIONS[enemyId]?.tier);
}

function cellColumn(cell) {
  return cell.q + Math.floor(cell.r / 2);
}

export function createPlayEnemies(map, mapPart, chapter = 'chapter1', origin = { x: 0, y: 0 }) {
  const pool = PLAY_ENEMY_POOLS[mapPart] ?? PLAY_ENEMY_POOLS[1];
  const markers = [];

  Object.keys(map.cells).forEach((cellKey) => {
    const cell = getActiveCell(map, cellKey, chapter);
    if (!cell || cell.terrain !== 'water') return;
    (cell.actors ?? []).forEach((marker, markerIndex) => {
      if (marker.kind === 'enemySpawn') markers.push({ cellKey, cell, marker, markerIndex });
    });
  });

  markers.sort((left, right) => (
    left.cell.r - right.cell.r
    || cellColumn(left.cell) - cellColumn(right.cell)
    || left.markerIndex - right.markerIndex
  ));

  return markers.map(({ cellKey, cell, marker, markerIndex }, index) => {
    const fallbackId = pool[index % pool.length];
    const enemyId = isRegularEnemy(marker.enemyId) ? marker.enemyId : fallbackId;
    const definition = ENEMY_DEFINITIONS[enemyId];
    const position = getHexCenter(cell, origin);
    return {
      instanceId: `map-enemy-${cellKey}-${markerIndex}`,
      enemyId,
      name: definition.name,
      tier: definition.tier,
      spawnCellKey: cellKey,
      x: position.x,
      y: position.y,
      radius: 4.5 + definition.tier * 0.65,
      renderSize: 12 + definition.tier * 1.8,
      visual: PLAY_ENEMY_VISUALS[enemyId] ?? encyclopediaById[enemyId]?.visuals?.idle ?? null,
      phase: ((cell.q * 31 + cell.r * 17 + index * 13) % 360) * Math.PI / 180,
      state: 'idle',
    };
  });
}

export function getPlayEnemyPose(enemy, timeSeconds) {
  const time = Number.isFinite(timeSeconds) ? timeSeconds : 0;
  return {
    x: enemy.x + Math.cos(time * 0.72 + enemy.phase) * 0.42,
    y: enemy.y + Math.sin(time * 1.08 + enemy.phase) * 0.82,
  };
}

export function isPlayEnemyVisible(enemy, camera, viewport, padding = 24) {
  return enemy.x >= camera.x - padding
    && enemy.x <= camera.x + viewport.width + padding
    && enemy.y >= camera.y - padding
    && enemy.y <= camera.y + viewport.height + padding;
}
