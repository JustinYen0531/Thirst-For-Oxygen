import { HEX_SIZE, getActiveCell, getHexCenter, patchCell } from './map-model.js';

function isEnemyDefeated(enemy) {
  return enemy?.resonanceNeutral === true
    || enemy?.defeated === true
    || (Number.isFinite(enemy?.health) && enemy.health <= 0);
}

function getBossRoomDefinition(map) {
  const definition = map?.metadata?.bossRoom;
  if (!definition?.id || !definition?.enemyId || !definition?.triggerCellKey) return null;
  return definition;
}

function gateKeys(definition) {
  return [
    ...(definition?.entranceGateCellKeys ?? []),
    ...(definition?.exitGateCellKeys ?? []),
  ];
}

function setGateOpen(map, key, opened, chapter) {
  const cell = getActiveCell(map, key, chapter);
  if (!cell?.conditionalGate?.bossRoomGate) return false;
  const alreadyOpen = cell.terrain === 'water' && cell.conditionalGate.opened === true;
  const alreadyClosed = cell.terrain === 'blocked' && cell.conditionalGate.opened === false;
  if ((opened && alreadyOpen) || (!opened && alreadyClosed)) return false;
  return patchCell(map, key, {
    terrain: opened ? 'water' : 'blocked',
    conditionalGate: { ...cell.conditionalGate, opened },
  }, chapter);
}

function setRoomGates(map, definition, opened, chapter) {
  return gateKeys(definition).reduce(
    (changed, key) => setGateOpen(map, key, opened, chapter) || changed,
    false,
  );
}

function entranceResetLine(map, definition, origin, chapter) {
  const cells = (definition.entranceGateCellKeys ?? [])
    .map((key) => getActiveCell(map, key, chapter))
    .filter(Boolean);
  if (!cells.length) return null;
  return Math.min(...cells.map((cell) => getHexCenter(cell, origin).y)) - HEX_SIZE * 1.25;
}

export function createPlayBossRoomState(map) {
  const definition = getBossRoomDefinition(map);
  return {
    id: definition?.id ?? null,
    enemyId: definition?.enemyId ?? null,
    status: definition ? 'waiting' : 'absent',
    activated: false,
    completed: false,
    sealCount: 0,
  };
}

export function stepPlayBossRoom(state, {
  map,
  actor,
  enemies = [],
  origin = { x: 0, y: 0 },
  chapter = 'chapter1',
} = {}) {
  const definition = getBossRoomDefinition(map);
  if (!definition || !state) return { changed: false, events: [] };

  const events = [];
  const bosses = enemies.filter((enemy) => enemy?.enemyId === definition.enemyId);
  const bossPresent = bosses.length > 0;
  const bossDefeated = bossPresent && bosses.every(isEnemyDefeated);

  if (bossDefeated) {
    const gatesChanged = setRoomGates(map, definition, true, chapter);
    if (!state.completed) {
      state.status = 'cleared';
      state.activated = true;
      state.completed = true;
      events.push({
        type: 'bossRoomCleared',
        message: '稜鏡封印解除：上下閘門已重新開啟。',
      });
    }
    return { changed: gatesChanged || events.length > 0, events };
  }

  const actorY = Number(actor?.y);
  const resetLine = entranceResetLine(map, definition, origin, chapter);
  if (state.status === 'sealed' && Number.isFinite(actorY) && Number.isFinite(resetLine) && actorY < resetLine) {
    setRoomGates(map, definition, true, chapter);
    state.status = 'waiting';
    state.activated = false;
    events.push({
      type: 'bossRoomReset',
      message: '稜鏡封印房已重置，入口再次開啟。',
    });
    return { changed: true, events };
  }

  if (state.status !== 'waiting' || !Number.isFinite(actorY)) return { changed: false, events };
  const triggerCell = getActiveCell(map, definition.triggerCellKey, chapter);
  if (!triggerCell) return { changed: false, events };
  const triggerY = getHexCenter(triggerCell, origin).y - HEX_SIZE * 0.45;
  if (actorY < triggerY) return { changed: false, events };

  setRoomGates(map, definition, false, chapter);
  state.status = 'sealed';
  state.activated = true;
  state.sealCount += 1;
  events.push({
    type: 'bossRoomSealed',
    message: '稜鏡封印啟動：上下閘門已鎖死，擊敗 Mini Boss 才能離開。',
  });
  return { changed: true, events };
}

export function getPlayBossRoomRenderState(state, map) {
  const definition = getBossRoomDefinition(map);
  if (!definition || !state) return null;
  return {
    id: state.id,
    enemyId: state.enemyId,
    status: state.status,
    activated: state.activated,
    completed: state.completed,
    sealCount: state.sealCount,
    triggerCellKey: definition.triggerCellKey,
    entranceGateCellKeys: [...(definition.entranceGateCellKeys ?? [])],
    exitGateCellKeys: [...(definition.exitGateCellKeys ?? [])],
  };
}
