import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createPlayTutorialState,
  createTutorialMap,
  getPlayTutorialExitState,
  getPlayTutorialRenderState,
  recordPlayTutorialCombat,
  recordPlayTutorialEvents,
  recordPlayTutorialInteraction,
  recordPlayTutorialLaunch,
  stepPlayTutorial,
} from '../src/play-tutorial.js';
import { getHexCenter } from '../src/map-model.js';

test('tutorial map is a small authored room with an open exit and one training enemy', () => {
  const map = createTutorialMap();
  assert.deepEqual(map.layout, { orientation: 'pointy', coordinateSystem: 'axial', rowLayout: 'odd-r rectangle', width: 12, height: 24 });
  assert.equal(map.metadata.difficulty, 'tutorial');
  assert.equal(map.metadata.enemyTargetCount, 1);
  assert.ok(map.cells[map.metadata.exitCellKey]);
  assert.equal(map.cells[map.metadata.exitCellKey].terrain, 'water');
  assert.equal(Object.values(map.cells).filter((cell) => cell.actors.some((actor) => actor.kind === 'enemySpawn')).length, 1);
  assert.ok(Object.values(map.cells).some((cell) => cell.freeObjects.some((object) => object.kind === 'torricelli')));
  assert.ok(Object.values(map.edges).some((edge) => edge.type === 'seaweed'));
});

test('tutorial accepts launch, object lessons, weapon use, and either enemy outcome', () => {
  const state = createPlayTutorialState();
  recordPlayTutorialLaunch(state);
  recordPlayTutorialInteraction(state, { type: 'seaweed', attached: true });
  recordPlayTutorialEvents(state, [
    { type: 'oxygen', message: '氧氣礦石：撞擊後釋放 100 O₂。' },
    { type: 'checkpoint', message: 'Checkpoint：已更新重生點並回滿資源。' },
  ]);
  recordPlayTutorialCombat(state, { effects: [{ type: 'knifePath' }] });
  const enemy = { health: 100, defeated: false, resonanceNeutral: false };
  assert.equal(stepPlayTutorial(state, { enemies: [enemy] }).readyToLeave, false);
  enemy.resonanceNeutral = true;
  const result = stepPlayTutorial(state, { enemies: [enemy] });
  assert.equal(result.readyToLeave, true);
  assert.equal(result.outcome, 'resonance');
  assert.equal(getPlayTutorialRenderState(state, [enemy]).outcome, 'resonance');
});

test('tutorial exit remains available before the guided steps are complete', () => {
  const map = createTutorialMap();
  const exit = getHexCenter(map.cells[map.metadata.exitCellKey], { x: 36, y: 36 });
  const result = getPlayTutorialExitState({ map, actor: { ...exit, radius: 6 }, origin: { x: 36, y: 36 } });
  assert.equal(result.unlocked, true);
  assert.equal(result.arrived, true);
});
