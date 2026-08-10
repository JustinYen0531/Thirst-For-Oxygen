import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  TUTORIAL_GUIDED_STEPS,
  TUTORIAL_TASKS,
  TUTORIAL_TASK_COMPLETION_TARGET,
  TUTORIAL_PART,
  createPlayTutorialState,
  createTutorialMap,
  getPlayTutorialExitState,
  getPlayTutorialRenderState,
  recordPlayTutorialCombat,
  recordPlayTutorialEvents,
  recordPlayTutorialGuideRead,
  recordPlayTutorialInteraction,
  recordPlayTutorialLaunch,
  selectPlayTutorialTask,
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
  assert.equal(map.metadata.tutorial.coreSteps.length, TUTORIAL_TASKS.length);
  assert.equal(TUTORIAL_TASKS.length, 20);
  assert.equal(TUTORIAL_TASK_COMPLETION_TARGET, 10);
  assert.equal(map.metadata.tutorial.taskCount, 20);
  assert.equal(map.metadata.tutorial.completionTarget, 10);
  assert.ok(map.cells[map.metadata.exitCellKey]);
  assert.equal(map.cells[map.metadata.exitCellKey].terrain, 'water');
  const enemyMarkers = Object.values(map.cells).flatMap((cell) => cell.actors.filter((actor) => actor.kind === 'enemySpawn'));
  assert.equal(enemyMarkers.length, 2);
  assert.equal(enemyMarkers.find((actor) => actor.tutorialRole === 'resonance')?.tutorialInfiniteHealth, true);
  assert.equal(enemyMarkers.find((actor) => actor.tutorialRole === 'resonance')?.tutorialStationary, true);
  assert.equal(enemyMarkers.find((actor) => actor.tutorialRole === 'kill')?.tutorialHealth, 20);
  assert.equal(enemyMarkers.find((actor) => actor.tutorialRole === 'kill')?.tutorialStationary, true);
  assert.equal(enemyMarkers.every((actor) => actor.tutorialNoSelfDestruct), true);
  assert.ok(Object.values(map.cells).some((cell) => cell.freeObjects.some((object) => object.kind === 'torricelli')));
  assert.ok(Object.values(map.edges).some((edge) => edge.type === 'seaweed'));
  const coralEdge = Object.values(map.edges).find((edge) => edge.type === 'coralCluster');
  assert.ok(coralEdge);
  assert.equal(coralEdge.cells.every((cellKey) => map.cells[cellKey]?.terrain === 'water'), true);
});

test('tutorial advances only after each guided operation is actually observed', () => {
  const state = createPlayTutorialState();
  const initialRender = getPlayTutorialRenderState(state);
  assert.equal(initialRender.currentStep.id, 'launch');
  assert.equal(initialRender.autoReady, false);
  assert.equal(initialRender.totalCoreSteps, 20);
  assert.equal(initialRender.completionTarget, 10);
  assert.equal(initialRender.tasks.length, 20);
  assert.equal(initialRender.dialogue.speaker, '深淵導航員');
  assert.match(initialRender.dialogue.controlHint, /← \/ →/);
  assert.ok(TUTORIAL_GUIDED_STEPS.every((step) => step.controlHint), 'every guided step must explain its control');
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
  ]);
  assert.equal(stepPlayTutorial(state).readyToLeave, false);
  recordPlayTutorialEvents(state, [{ type: 'razor' }]);
  assert.equal(stepPlayTutorial(state).readyToLeave, true);
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
  const killEnemy = { tutorialRole: 'kill', health: 100, defeated: false, resonanceNeutral: false };
  const resonanceEnemy = { tutorialRole: 'resonance', health: 100, defeated: false, resonanceNeutral: false };
  assert.equal(stepPlayTutorial(state, { enemies: [killEnemy, resonanceEnemy] }).readyToLeave, true);
  killEnemy.health = 0;
  killEnemy.defeated = true;
  assert.equal(stepPlayTutorial(state, { enemies: [killEnemy, resonanceEnemy] }).readyToLeave, true);
  resonanceEnemy.resonanceNeutral = true;
  const result = stepPlayTutorial(state, { enemies: [killEnemy, resonanceEnemy] });
  assert.equal(result.readyToLeave, true);
  assert.equal(result.outcome, 'resonance');
  const renderState = getPlayTutorialRenderState(state, [killEnemy, resonanceEnemy]);
  assert.equal(renderState.outcome, 'resonance');
  assert.equal(renderState.currentStep.id, 'ready');
  assert.equal(renderState.completedCoreSteps, TUTORIAL_TASKS.length);
});

test('First Breath unlocks the exit after any ten selected tasks', () => {
  const state = createPlayTutorialState();
  state.completed = new Set(TUTORIAL_TASKS.slice(0, TUTORIAL_TASK_COMPLETION_TARGET).flatMap((task) => task.stepIds));
  const result = stepPlayTutorial(state);
  assert.equal(result.readyToLeave, true);
  assert.equal(getPlayTutorialRenderState(state).completedCoreSteps, 10);
});

test('reading the matching Visor cards completes the read-information tasks', () => {
  const state = createPlayTutorialState();
  recordPlayTutorialGuideRead(state, 'object:weightStone');
  recordPlayTutorialGuideRead(state, 'object:mine');
  recordPlayTutorialGuideRead(state, 'edge:current');
  assert.equal(state.completed.has('weightStone'), true);
  assert.equal(state.completed.has('mine'), true);
  assert.equal(state.completed.has('current'), true);
  const completedBeforeUnknownGuide = [...state.completed];
  recordPlayTutorialGuideRead(state, 'object:unknown');
  assert.deepEqual([...state.completed], completedBeforeUnknownGuide);
});

test('First Breath lets the player choose any task with the arrow keys', () => {
  const state = createPlayTutorialState();
  selectPlayTutorialTask(state, -1);
  const previous = getPlayTutorialRenderState(state);
  assert.equal(previous.selectedTaskIndex, 19);
  assert.equal(previous.selectedTaskId, TUTORIAL_TASKS[19].id);
  selectPlayTutorialTask(state, 1);
  const next = getPlayTutorialRenderState(state);
  assert.equal(next.selectedTaskIndex, 0);
  assert.equal(next.selectedTaskId, TUTORIAL_TASKS[0].id);
});

test('defeating an enemy does not satisfy the Resonance lesson', () => {
  const state = createPlayTutorialState();
  state.completed = new Set(TUTORIAL_TASKS.slice(0, TUTORIAL_TASK_COMPLETION_TARGET - 1).flatMap((task) => task.stepIds));
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
  assert.match(playHtml, /id="play-tutorial-dialogue"/);
  assert.match(playHtml, /id="play-tutorial-dialogue-control"/);
  assert.match(playHtml, /id="play-tutorial-task-list"/);
  assert.match(playHtml, /id="play-tutorial-dialogue-navigation"/);
  assert.match(playHtml, /id="play-tutorial-task-progress">10 \/ 20</);
  assert.match(playHtml, /aria-label="First Breath tasks"/);
  assert.match(playHtml, /id="play-tutorial-task-list"[^>]*tabindex="0"/);
  assert.match(playHtml, /id="play-tutorial-skip-dialog"/);
  assert.match(playHtml, /Skip Tutorial\?/);
  assert.match(playPageSource, /tutorialDialogueControl/);
  assert.match(playPageSource, /event\.code === 'Enter'/);
  assert.match(playPageSource, /event\.code === 'ArrowLeft'/);
  assert.match(playPageSource, /selectPlayTutorialTask/);
  assert.match(playPageSource, /recordPlayTutorialGuideRead/);
  assert.match(playPageSource, /updateTutorialCardHover/);
  assert.match(playPageSource, /scrollTutorialTaskList/);
  assert.match(playPageSource, /window\.location\.href = '\/home\.html'/);
  assert.doesNotMatch(playPageSource, /mapArc === TUTORIAL_ROUTE && \(tutorialProgress\?\.readyToLeave \|\| stageExit\.arrived\)/);
});
