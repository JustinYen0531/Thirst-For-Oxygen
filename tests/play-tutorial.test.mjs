import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  TUTORIAL_GUIDED_STEPS,
  TUTORIAL_PART,
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

const playHtml = readFileSync(new URL('../play.html', import.meta.url), 'utf8');
const playPageSource = readFileSync(new URL('../src/play-page.js', import.meta.url), 'utf8');

test('tutorial map is Chapter 0 with a small authored room and two training enemies', () => {
  const map = createTutorialMap();
  assert.deepEqual(map.layout, { orientation: 'pointy', coordinateSystem: 'axial', rowLayout: 'odd-r rectangle', width: 12, height: 24 });
  assert.equal(TUTORIAL_PART, 0);
  assert.equal(map.metadata.part, 0);
  assert.equal(map.metadata.difficulty, 'tutorial');
  assert.equal(map.metadata.enemyTargetCount, 2);
  assert.equal(map.metadata.tutorial.guided, true);
  assert.equal(map.metadata.tutorial.coreSteps.length, TUTORIAL_GUIDED_STEPS.length);
  assert.ok(map.cells[map.metadata.exitCellKey]);
  assert.equal(map.cells[map.metadata.exitCellKey].terrain, 'water');
  assert.equal(Object.values(map.cells).filter((cell) => cell.actors.some((actor) => actor.kind === 'enemySpawn')).length, 2);
  assert.ok(Object.values(map.cells).some((cell) => cell.freeObjects.some((object) => object.kind === 'torricelli')));
  assert.ok(Object.values(map.edges).some((edge) => edge.type === 'seaweed'));
});

test('tutorial advances only after each guided operation is actually observed', () => {
  const state = createPlayTutorialState();
  assert.equal(getPlayTutorialRenderState(state).currentStep.id, 'launch');
  assert.equal(getPlayTutorialRenderState(state).autoReady, false);
  recordPlayTutorialLaunch(state);
  recordPlayTutorialInteraction(state, { type: 'seaweed', attached: true });
  recordPlayTutorialInteraction(state, { type: 'seaweed', attached: false });
  recordPlayTutorialEvents(state, [
    { type: 'checkpoint', message: 'Checkpoint：已更新重生點並回滿資源。' },
    { type: 'oxygen', message: '氧氣礦石：撞擊後釋放 100 O₂。' },
    { type: 'oxygenBubble', success: true },
    { type: 'torricelli', success: true },
    { type: 'bubble', success: true },
    { type: 'weightStone', message: '重石已被足夠的撞擊力擊碎。' },
    { type: 'mine' },
    { type: 'razor' },
  ]);
  recordPlayTutorialInteraction(state, { type: 'coralInvisibility' });
  recordPlayTutorialEvents(state, [
    { type: 'button', message: '按鈕：已開啟 1 個條件通行門。' },
    { type: 'springJelly', success: true },
    { type: 'current', success: true },
    { type: 'spike', success: true },
    { type: 'barrier', success: true },
  ]);
  recordPlayTutorialInteraction(state, { type: 'wallGillEnter' });
  recordPlayTutorialInteraction(state, { type: 'wallGillExit' });
  recordPlayTutorialCombat(state, { effects: [{ type: 'knifePath', hitIds: ['training-a'] }] });
  const enemy = { health: 100, defeated: false, resonanceNeutral: false };
  assert.equal(stepPlayTutorial(state, { enemies: [enemy] }).readyToLeave, false);
  enemy.resonanceNeutral = true;
  const result = stepPlayTutorial(state, { enemies: [enemy] });
  assert.equal(result.readyToLeave, true);
  assert.equal(result.outcome, 'resonance');
  const renderState = getPlayTutorialRenderState(state, [enemy]);
  assert.equal(renderState.outcome, 'resonance');
  assert.equal(renderState.currentStep.id, 'ready');
  assert.equal(renderState.completedCoreSteps, TUTORIAL_GUIDED_STEPS.length);
});

test('defeating an enemy does not satisfy the Resonance lesson', () => {
  const state = createPlayTutorialState();
  TUTORIAL_GUIDED_STEPS.slice(0, -1).forEach((step) => state.observedActions.add(step.id));
  state.currentStepIndex = TUTORIAL_GUIDED_STEPS.length - 1;
  state.completed = new Set(TUTORIAL_GUIDED_STEPS.slice(0, -1).map((step) => step.id));
  const result = stepPlayTutorial(state, { enemies: [{ defeated: true, health: 0, resonanceNeutral: false }] });
  assert.equal(result.readyToLeave, false);
  assert.equal(result.outcome, null);
  assert.match(result.lastGuideNote, /Resonance/);
});

test('tutorial exit is locked before the guided steps are complete', () => {
  const map = createTutorialMap();
  const exit = getHexCenter(map.cells[map.metadata.exitCellKey], { x: 36, y: 36 });
  const result = getPlayTutorialExitState({ map, actor: { ...exit, radius: 6 }, state: createPlayTutorialState(), origin: { x: 36, y: 36 } });
  assert.equal(result.unlocked, false);
  assert.equal(result.arrived, false);
  assert.match(result.lockedReason, /Enter/);
});

test('tutorial exposes an Enter-confirmed skip flow without entering Chapter 1', () => {
  assert.match(playHtml, /value="tutorial:0"/);
  assert.match(playHtml, /id="play-tutorial-skip-dialog"/);
  assert.match(playHtml, /Skip Tutorial\?/);
  assert.match(playPageSource, /event\.code === 'Enter'/);
  assert.match(playPageSource, /window\.location\.href = '\/home\.html'/);
  assert.doesNotMatch(playPageSource, /mapArc === TUTORIAL_ROUTE && \(tutorialProgress\?\.readyToLeave \|\| stageExit\.arrived\)/);
});
