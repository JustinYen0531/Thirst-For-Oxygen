import {
  DIRECTIONS,
  HEX_SIZE,
  getActiveCell,
  getHexCenter,
  neighborKey,
  patchCell,
} from './map-model.js';
import { getOfficialFreeObjectState } from './map-object-settings.js';

export const BOSS_ROOM_OXYGEN_BUBBLE_INTERVAL = 12;
export const BOSS_ROOM_PHOTOSYNTHESIS_BUBBLE_INTERVAL = 18;
export const BOSS_ROOM_RESOURCE_RADIUS = HEX_SIZE * 6;
export const BOSS_ROOM_RESOURCE_ACTIVATION_RADIUS = HEX_SIZE * 9;
export const BOSS_ROOM_RESOURCE_TURN_ROW_OFFSET = 1;

const BOSS_TIERS = new Set(['miniBoss', 'mutatedMiniBoss', 'finalBoss']);

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

function cellColumn(cell) {
  return cell.q + Math.floor(cell.r / 2);
}

function getDefinitionCenter(map, definition, origin) {
  const room = definition?.room;
  const roomCells = room
    ? Object.values(map.cells).filter((cell) => (
      cell.r >= room.rowStart
      && cell.r <= room.rowEnd
      && cellColumn(cell) >= room.columnStart
      && cellColumn(cell) <= room.columnEnd
      && cell.terrain === 'water'
    ))
    : [];
  const anchorKey = definition?.miniBossCellKey ?? definition?.triggerCellKey;
  const anchor = anchorKey ? getActiveCell(map, anchorKey, 'chapter1') : null;
  const candidates = roomCells.length ? roomCells : anchor ? [anchor] : [];
  if (!candidates.length) return { x: 0, y: 0 };
  return candidates.reduce((sum, cell) => {
    const center = getHexCenter(cell, origin);
    return { x: sum.x + center.x / candidates.length, y: sum.y + center.y / candidates.length };
  }, { x: 0, y: 0 });
}

function getBossResourceGroups(map, enemies, origin) {
  const definition = getBossRoomDefinition(map);
  if (definition) {
    const bosses = enemies.filter((enemy) => enemy?.enemyId === definition.enemyId);
    if (bosses.length) return [{ id: definition.id, definition, enemies: bosses, center: getDefinitionCenter(map, definition, origin) }];
  }
  return enemies
    .filter((enemy) => BOSS_TIERS.has(enemy?.tier))
    .map((enemy, index) => ({
      id: `encounter:${enemy.instanceId ?? enemy.enemyId ?? index}`,
      definition: null,
      enemies: [enemy],
      center: { x: Number(enemy.x) || 0, y: Number(enemy.y) || 0 },
    }));
}

function isGroupCell(cell, group, origin) {
  if (!cell || cell.terrain !== 'water' || cell.conditionalGate) return false;
  const room = group.definition?.room;
  if (room) {
    return cell.r >= room.rowStart
      && cell.r <= room.rowEnd
      && cellColumn(cell) >= room.columnStart
      && cellColumn(cell) <= room.columnEnd;
  }
  const center = getHexCenter(cell, origin);
  return Math.hypot(center.x - group.center.x, center.y - group.center.y) <= BOSS_ROOM_RESOURCE_RADIUS;
}

function countBlockedNeighbors(map, cell) {
  const key = `${cell.q},${cell.r}`;
  return DIRECTIONS.reduce((count, _, direction) => (
    count + Number(map.cells[neighborKey(key, direction)]?.terrain === 'blocked')
  ), 0);
}

function findTorricelliDetourCell(map, group, candidates) {
  const room = group.definition?.room;
  if (room) {
    const turnRowStart = room.rowStart + BOSS_ROOM_RESOURCE_TURN_ROW_OFFSET;
    const turnCandidates = candidates.filter(({ cell }) => (
      cell.r >= turnRowStart
      && cell.r <= Math.min(room.rowEnd, turnRowStart + 1)
    ));
    if (turnCandidates.length) {
      return turnCandidates
        .sort((left, right) => (
          left.cell.r - right.cell.r
          || cellColumn(left.cell) - cellColumn(right.cell)
          || right.blockedNeighbors - left.blockedNeighbors
          || right.distance - left.distance
        ))[0].cell;
    }
  }

  const upwardCandidates = candidates.filter(({ center }) => (
    center.y <= group.center.y - HEX_SIZE * 2
  ));
  const detourCandidates = upwardCandidates.length ? upwardCandidates : candidates;
  return detourCandidates
    .sort((left, right) => (
      Number(left.occupied > 0) - Number(right.occupied > 0)
      || right.blockedNeighbors - left.blockedNeighbors
      || (group.center.y - right.center.y) - (group.center.y - left.center.y)
      || right.distance - left.distance
    ))[0]?.cell ?? null;
}

function findResourceCell(map, group, origin, kind) {
  const candidates = Object.values(map.cells)
    .filter((cell) => isGroupCell(cell, group, origin))
    .map((cell) => {
      const center = getHexCenter(cell, origin);
      const objects = [...(cell.objects ?? []), ...(cell.freeObjects ?? [])];
      const hasKind = objects.some((object) => object.kind === kind);
      return {
        cell,
        center,
        distance: Math.hypot(center.x - group.center.x, center.y - group.center.y),
        occupied: objects.length + (cell.actors?.length ?? 0),
        blockedNeighbors: countBlockedNeighbors(map, cell),
        hasKind,
      };
    })
    .filter(({ hasKind }) => !hasKind);
  if (kind === 'torricelli') return findTorricelliDetourCell(map, group, candidates);
  candidates.sort((left, right) => (
    Number(left.occupied > 0) - Number(right.occupied > 0)
    || left.occupied - right.occupied
    || left.distance - right.distance
  ));
  return candidates[0]?.cell ?? null;
}

function hasResourceInGroup(map, group, origin, kind) {
  return Object.values(map.cells).some((cell) => (
    isGroupCell(cell, group, origin)
    && [...(cell.objects ?? []), ...(cell.freeObjects ?? [])].some((object) => object.kind === kind)
  ));
}

function addRuntimeResource(map, group, origin, kind, params, chapter) {
  const cell = findResourceCell(map, group, origin, kind);
  if (!cell) return false;
  const official = getOfficialFreeObjectState(kind);
  const object = {
    kind,
    offset: { x: 0, y: 0 },
    size: official.size,
    params: { ...official.params, ...params },
    runtimeBossRoom: group.id,
  };
  return patchCell(map, `${cell.q},${cell.r}`, { freeObjects: [...(cell.freeObjects ?? []), object] }, chapter);
}

function getResourceState(state, groupId) {
  state.resourceGroups ??= {};
  state.resourceGroups[groupId] ??= {
    sourcePresent: false,
    oxygenBubbleNextAt: null,
    photosynthesisBubbleNextAt: null,
    oxygenBubbleSpawnCount: 0,
    photosynthesisBubbleSpawnCount: 0,
  };
  return state.resourceGroups[groupId];
}

function groupIsActive(state, group, actor) {
  if (group.definition) return state.status === 'sealed' && !state.completed;
  if (!Number.isFinite(actor?.x) || !Number.isFinite(actor?.y)) return false;
  if (group.enemies.length && group.enemies.every(isEnemyDefeated)) return false;
  return Math.hypot(actor.x - group.center.x, actor.y - group.center.y) <= BOSS_ROOM_RESOURCE_ACTIVATION_RADIUS;
}

function stepBossRoomOxygenResources(state, { map, actor, enemies, origin, chapter, time }) {
  const groups = getBossResourceGroups(map, enemies, origin);
  if (!groups.length) return { changed: false, events: [] };
  let changed = false;
  const events = [];
  const now = Number.isFinite(time) ? time : 0;
  groups.forEach((group) => {
    const resourceState = getResourceState(state, group.id);
    if (!hasResourceInGroup(map, group, origin, 'torricelli')) {
      changed = addRuntimeResource(map, group, origin, 'torricelli', {}, chapter) || changed;
      resourceState.sourcePresent = true;
    } else {
      resourceState.sourcePresent = true;
    }
    if (!groupIsActive(state, group, actor)) return;
    if (resourceState.oxygenBubbleNextAt == null) resourceState.oxygenBubbleNextAt = now + BOSS_ROOM_OXYGEN_BUBBLE_INTERVAL;
    if (resourceState.photosynthesisBubbleNextAt == null) resourceState.photosynthesisBubbleNextAt = now + BOSS_ROOM_PHOTOSYNTHESIS_BUBBLE_INTERVAL;
    if (now >= resourceState.oxygenBubbleNextAt) {
      if (!hasResourceInGroup(map, group, origin, 'oxygenBubble')) {
        const spawned = addRuntimeResource(map, group, origin, 'oxygenBubble', { oxygenAmount: 25 }, chapter);
        changed = spawned || changed;
        if (spawned) {
          resourceState.oxygenBubbleSpawnCount += 1;
          events.push({ type: 'bossRoomOxygenBubbleSpawned', message: 'Boss 房間生成新的清氧氣泡。' });
        }
      }
      resourceState.oxygenBubbleNextAt = now + BOSS_ROOM_OXYGEN_BUBBLE_INTERVAL;
    }
    if (now >= resourceState.photosynthesisBubbleNextAt) {
      if (!hasResourceInGroup(map, group, origin, 'bubble')) {
        const spawned = addRuntimeResource(map, group, origin, 'bubble', { oxygenAmount: 50 }, chapter);
        changed = spawned || changed;
        if (spawned) {
          resourceState.photosynthesisBubbleSpawnCount += 1;
          events.push({ type: 'bossRoomPhotosynthesisBubbleSpawned', message: 'Boss 房間生成新的光合作用氣泡。' });
        }
      }
      resourceState.photosynthesisBubbleNextAt = now + BOSS_ROOM_PHOTOSYNTHESIS_BUBBLE_INTERVAL;
    }
  });
  return { changed, events };
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
    resourceGroups: {},
  };
}

export function stepPlayBossRoom(state, {
  map,
  actor,
  enemies = [],
  origin = { x: 0, y: 0 },
  chapter = 'chapter1',
  time = 0,
} = {}) {
  const definition = getBossRoomDefinition(map);
  if (!state) return { changed: false, events: [] };

  const oxygenResources = stepBossRoomOxygenResources(state, {
    map,
    actor,
    enemies,
    origin,
    chapter,
    time,
  });
  if (!definition) return oxygenResources;

  const events = [...oxygenResources.events];
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
    return { changed: oxygenResources.changed || gatesChanged || events.length > 0, events };
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
  if (!state || (!definition && !Object.keys(state.resourceGroups ?? {}).length)) return null;
  return {
    id: state.id ?? null,
    enemyId: state.enemyId ?? null,
    status: state.status,
    activated: state.activated,
    completed: state.completed,
    sealCount: state.sealCount,
    triggerCellKey: definition?.triggerCellKey ?? null,
    entranceGateCellKeys: [...(definition?.entranceGateCellKeys ?? [])],
    exitGateCellKeys: [...(definition?.exitGateCellKeys ?? [])],
    resources: Object.entries(state.resourceGroups ?? {}).map(([id, resource]) => ({
      id,
      sourcePresent: Boolean(resource.sourcePresent),
      oxygenBubbleNextAt: resource.oxygenBubbleNextAt,
      photosynthesisBubbleNextAt: resource.photosynthesisBubbleNextAt,
      oxygenBubbleSpawnCount: resource.oxygenBubbleSpawnCount,
      photosynthesisBubbleSpawnCount: resource.photosynthesisBubbleSpawnCount,
    })),
  };
}
