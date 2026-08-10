import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createPlayBossRoomState,
  getPlayBossRoomRenderState,
  stepPlayBossRoom,
} from '../src/play-boss-room.js';
import { createEmptyMap, cellKeyFromColumn, getHexCenter } from '../src/map-model.js';

const origin = { x: 36, y: 36 };

function createRoomMap() {
  const map = createEmptyMap({ width: 8, height: 12 });
  Object.values(map.cells).forEach((cell) => { cell.terrain = 'blocked'; });
  for (let row = 0; row < 12; row += 1) {
    for (let column = 2; column <= 5; column += 1) map.cells[cellKeyFromColumn(column, row)].terrain = 'water';
  }
  const entranceGateCellKeys = [2, 3, 4, 5].map((column) => cellKeyFromColumn(column, 3));
  const exitGateCellKeys = [2, 3, 4, 5].map((column) => cellKeyFromColumn(column, 9));
  [...entranceGateCellKeys, ...exitGateCellKeys].forEach((key) => {
    map.cells[key].conditionalGate = { opened: true, bossRoomGate: true };
  });
  map.metadata = {
    bossRoom: {
      id: 'test-room',
      enemyId: 'prismCrabGuardian',
      triggerCellKey: cellKeyFromColumn(3, 5),
      entranceGateCellKeys,
      exitGateCellKeys,
      room: { rowStart: 0, rowEnd: 11, columnStart: 2, columnEnd: 5 },
    },
  };
  return map;
}

function actorAt(map, column, row) {
  return getHexCenter(map.cells[cellKeyFromColumn(column, row)], origin);
}

test('crossing the authored trigger seals every top and bottom gate', () => {
  const map = createRoomMap();
  const state = createPlayBossRoomState(map);
  const boss = { enemyId: 'prismCrabGuardian', health: 1000, defeated: false };
  const result = stepPlayBossRoom(state, { map, actor: actorAt(map, 3, 6), enemies: [boss], origin });
  assert.equal(state.status, 'sealed');
  assert.equal(state.sealCount, 1);
  assert.equal(result.events[0].type, 'bossRoomSealed');
  const keys = [...map.metadata.bossRoom.entranceGateCellKeys, ...map.metadata.bossRoom.exitGateCellKeys];
  assert.ok(keys.every((key) => map.cells[key].terrain === 'blocked'));
  assert.ok(keys.every((key) => map.cells[key].conditionalGate.opened === false));
});

test('the room stays sealed while its authored Mini Boss remains active', () => {
  const map = createRoomMap();
  const state = createPlayBossRoomState(map);
  const boss = { enemyId: 'prismCrabGuardian', health: 1000, defeated: false };
  stepPlayBossRoom(state, { map, actor: actorAt(map, 3, 6), enemies: [boss], origin });
  const result = stepPlayBossRoom(state, { map, actor: actorAt(map, 4, 8), enemies: [boss], origin });
  assert.equal(result.changed, false);
  assert.equal(state.status, 'sealed');
  assert.ok(map.metadata.bossRoom.exitGateCellKeys.every((key) => map.cells[key].terrain === 'blocked'));
});

test('defeat or Resonance neutrality clears the room and opens both exits', () => {
  for (const boss of [
    { enemyId: 'prismCrabGuardian', health: 0, defeated: true },
    { enemyId: 'prismCrabGuardian', health: 1000, resonanceNeutral: true },
  ]) {
    const map = createRoomMap();
    const state = createPlayBossRoomState(map);
    stepPlayBossRoom(state, { map, actor: actorAt(map, 3, 6), enemies: [{ enemyId: 'prismCrabGuardian', health: 1000 }], origin });
    const result = stepPlayBossRoom(state, { map, actor: actorAt(map, 3, 6), enemies: [boss], origin });
    assert.equal(result.events[0].type, 'bossRoomCleared');
    assert.equal(state.status, 'cleared');
    assert.equal(state.completed, true);
    const keys = [...map.metadata.bossRoom.entranceGateCellKeys, ...map.metadata.bossRoom.exitGateCellKeys];
    assert.ok(keys.every((key) => map.cells[key].terrain === 'water'));
    assert.ok(keys.every((key) => map.cells[key].conditionalGate.opened === true));
  }
});

test('respawning above a sealed room reopens it for a clean retry', () => {
  const map = createRoomMap();
  const state = createPlayBossRoomState(map);
  const boss = { enemyId: 'prismCrabGuardian', health: 1000, defeated: false };
  stepPlayBossRoom(state, { map, actor: actorAt(map, 3, 6), enemies: [boss], origin });
  const result = stepPlayBossRoom(state, { map, actor: actorAt(map, 3, 0), enemies: [boss], origin });
  assert.equal(result.events[0].type, 'bossRoomReset');
  assert.equal(state.status, 'waiting');
  assert.ok(map.metadata.bossRoom.entranceGateCellKeys.every((key) => map.cells[key].terrain === 'water'));
});

test('maps without a boss-room contract remain inert and JSON-safe', () => {
  const map = createEmptyMap({ width: 3, height: 3 });
  const state = createPlayBossRoomState(map);
  assert.equal(state.status, 'absent');
  assert.deepEqual(stepPlayBossRoom(state, { map, actor: { x: 0, y: 0 } }), { changed: false, events: [] });
  assert.equal(getPlayBossRoomRenderState(state, map), null);
  assert.deepEqual(JSON.parse(JSON.stringify(state)), state);
});

test('every active Boss encounter receives a persistent source and timed oxygen bubbles', () => {
  const map = createEmptyMap({ width: 12, height: 12 });
  const bossCell = map.cells[cellKeyFromColumn(6, 6)];
  const bossPosition = getHexCenter(bossCell, origin);
  const state = createPlayBossRoomState(map);
  const actor = { x: bossPosition.x, y: bossPosition.y };
  const boss = {
    instanceId: 'final-boss-test',
    enemyId: 'abyssalSpermWhale',
    tier: 'finalBoss',
    health: 1000,
    x: bossPosition.x,
    y: bossPosition.y,
  };

  const initial = stepPlayBossRoom(state, { map, actor, enemies: [boss], origin, time: 0 });
  assert.equal(initial.changed, true);
  const torricelliEntry = Object.entries(map.cells).find(([, cell]) => (
    cell.freeObjects.some((object) => object.kind === 'torricelli')
  ));
  assert.ok(torricelliEntry, 'Boss encounter should receive a persistent Torricelli source');
  const torricelliCell = map.cells[torricelliEntry[0]];
  assert.ok(torricelliCell.r < bossCell.r, 'The persistent source should be upstream of the Boss, not in the center');
  assert.notEqual(torricelliEntry[0], cellKeyFromColumn(6, 6), 'The persistent source should not share the Boss center cell');

  const oxygenSpawn = stepPlayBossRoom(state, { map, actor, enemies: [boss], origin, time: 12.1 });
  assert.equal(oxygenSpawn.events.some((event) => event.type === 'bossRoomOxygenBubbleSpawned'), true);
  assert.equal(Object.values(map.cells).flatMap((cell) => cell.freeObjects).filter((object) => object.kind === 'oxygenBubble').length, 1);

  const photosynthesisSpawn = stepPlayBossRoom(state, { map, actor, enemies: [boss], origin, time: 18.1 });
  assert.equal(photosynthesisSpawn.events.some((event) => event.type === 'bossRoomPhotosynthesisBubbleSpawned'), true);
  const photosynthesis = Object.values(map.cells).flatMap((cell) => cell.freeObjects).find((object) => object.kind === 'bubble');
  assert.equal(photosynthesis.params.oxygenAmount, 50);
  assert.equal(getPlayBossRoomRenderState(state, map).resources[0].sourcePresent, true);
});

test('formal Boss rooms place Torricelli at the upper side turn', () => {
  const map = createRoomMap();
  const state = createPlayBossRoomState(map);
  const boss = { enemyId: 'prismCrabGuardian', health: 1000, defeated: false };
  stepPlayBossRoom(state, { map, actor: actorAt(map, 3, 6), enemies: [boss], origin, time: 0 });
  const sourceEntry = Object.entries(map.cells).find(([, cell]) => (
    cell.freeObjects.some((object) => object.kind === 'torricelli')
  ));
  assert.ok(sourceEntry);
  assert.equal(sourceEntry[0], cellKeyFromColumn(2, 1), 'The source should be placed in the upper-left turn, not the room center');
});
