import assert from 'node:assert/strict';
import test from 'node:test';
import { getHexCenter } from '../src/map-model.js';
import { FINAL_BOSS_ID, getPlayExitPosition, getPlayStageExitState } from '../src/play-flow.js';

const origin = { x: 12, y: 18 };
const map = {
  metadata: { exitCellKey: '2,3' },
  cells: {
    '2,3': { key: '2,3', q: 2, r: 3, terrain: 'water', actors: [], objects: [], freeObjects: [] },
  },
  edges: {},
};

test('authored exitCellKey resolves to a playable water-cell center', () => {
  const expected = getHexCenter(map.cells['2,3'], origin);
  assert.deepEqual(getPlayExitPosition(map, origin), { cellKey: '2,3', ...expected });
  assert.equal(getPlayExitPosition({ metadata: { exitCellKey: 'missing' }, cells: {} }, origin), null);
  assert.equal(getPlayExitPosition({ metadata: { exitCellKey: '2,3' }, cells: { '2,3': { ...map.cells['2,3'], terrain: 'blocked' } } }, origin), null);
});

test('reaching exits advances parts one and two', () => {
  const exit = getPlayExitPosition(map, origin);
  [
    [1, 2],
    [2, 3],
  ].forEach(([mapPart, nextPart]) => {
    const result = getPlayStageExitState({ map, mapPart, actor: { ...exit, radius: 6 }, origin });
    assert.equal(result.arrived, true);
    assert.equal(result.completed, false);
    assert.equal(result.nextPart, nextPart);
    assert.equal(result.finalBossRequired, false);
  });
});

test('an authored Part 1 Mini Boss room locks progression until its guardian is resolved', () => {
  const bossRoomMap = { ...map, metadata: { ...map.metadata, bossRoom: { id: 'prism-crab-sanctum', enemyId: 'prismCrabGuardian' } } };
  const exit = getPlayExitPosition(bossRoomMap, origin);
  const missing = getPlayStageExitState({ map: bossRoomMap, mapPart: 1, actor: { ...exit, radius: 6 }, enemies: [], origin });
  assert.equal(missing.requiredBossId, 'prismCrabGuardian');
  assert.equal(missing.encounterPresent, false);
  assert.equal(missing.unlocked, false);
  const alive = { enemyId: 'prismCrabGuardian', health: 900, defeated: false };
  const locked = getPlayStageExitState({ map: bossRoomMap, mapPart: 1, actor: { ...exit, radius: 6 }, enemies: [alive], origin });
  assert.equal(locked.encounterRequired, true);
  assert.equal(locked.encounterPresent, true);
  assert.equal(locked.unlocked, false);
  const cleared = getPlayStageExitState({ map: bossRoomMap, mapPart: 1, actor: { ...exit, radius: 6 }, enemies: [{ ...alive, resonanceNeutral: true }], origin });
  assert.equal(cleared.encounterDefeated, true);
  assert.equal(cleared.unlocked, true);
  assert.equal(cleared.nextPart, 2);
});

test('being away from the exit never advances or completes a part', () => {
  const exit = getPlayExitPosition(map, origin);
  const result = getPlayStageExitState({
    map,
    mapPart: 2,
    actor: { x: exit.x + 400, y: exit.y, radius: 6 },
    origin,
  });
  assert.equal(result.unlocked, true);
  assert.equal(result.arrived, false);
  assert.equal(result.completed, false);
  assert.equal(result.nextPart, null);
});

test('the final exit stays locked until the authored final boss is defeated', () => {
  const exit = getPlayExitPosition(map, origin);
  const missing = getPlayStageExitState({ map, mapPart: 3, actor: { ...exit, radius: 6 }, enemies: [], origin });
  assert.equal(missing.finalBossPresent, false);
  assert.equal(missing.bossDefeated, false);
  assert.equal(missing.unlocked, false);

  const alive = { enemyId: FINAL_BOSS_ID, health: 100, defeated: false };
  const locked = getPlayStageExitState({ map, mapPart: 3, actor: { ...exit, radius: 6 }, enemies: [alive], origin });
  assert.equal(locked.finalBossPresent, true);
  assert.equal(locked.unlocked, false);
  assert.equal(locked.arrived, false);

  const defeated = { ...alive, health: 0, defeated: true };
  const complete = getPlayStageExitState({ map, mapPart: 3, actor: { ...exit, radius: 6 }, enemies: [defeated], origin });
  assert.equal(complete.unlocked, true);
  assert.equal(complete.completed, true);
  assert.equal(complete.nextPart, null);
});

test('defeating the final boss does not complete Part 3 before reaching its exit', () => {
  const exit = getPlayExitPosition(map, origin);
  const defeated = { enemyId: FINAL_BOSS_ID, health: 0, defeated: true };
  const result = getPlayStageExitState({
    map,
    mapPart: 3,
    actor: { x: exit.x, y: exit.y + 400, radius: 6 },
    enemies: [defeated],
    origin,
  });
  assert.equal(result.unlocked, true);
  assert.equal(result.arrived, false);
  assert.equal(result.completed, false);
  assert.equal(result.nextPart, null);
});

test('a Resonance-neutral final boss unlocks the exit without requiring a kill', () => {
  const exit = getPlayExitPosition(map, origin);
  const result = getPlayStageExitState({
    map,
    mapPart: 3,
    actor: { ...exit, radius: 6 },
    enemies: [{ enemyId: FINAL_BOSS_ID, health: 1000, defeated: false, resonanceNeutral: true }],
    origin,
  });
  assert.equal(result.bossDefeated, true);
  assert.equal(result.unlocked, true);
  assert.equal(result.completed, true);
});

test('stage-exit state is JSON-safe even when map or actor data is unavailable', () => {
  const missing = getPlayStageExitState({ map: null, mapPart: 99, actor: null });
  assert.equal(missing.part, 1);
  assert.equal(missing.exit, null);
  assert.equal(missing.distance, null);
  assert.deepEqual(JSON.parse(JSON.stringify(missing)), missing);

  const exit = getPlayExitPosition(map, origin);
  const ready = getPlayStageExitState({ map, mapPart: '3', actor: { ...exit, radius: 6 }, enemies: [{ enemyId: FINAL_BOSS_ID, health: 0 }], origin });
  assert.deepEqual(JSON.parse(JSON.stringify(ready)), ready);
});
