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
  map.metadata = { bossRoom: { id: 'test-room', enemyId: 'prismCrabGuardian', triggerCellKey: cellKeyFromColumn(3, 5), entranceGateCellKeys, exitGateCellKeys } };
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
