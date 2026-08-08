import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createPlayKatanaState,
  markPlayKatanaMovement,
  resolvePlayKatanaSlash,
  stepPlayKatana,
} from '../src/play-katana.js';
import { getKatanaSwingFrames, getKatanaWavePose } from '../src/katana-visual.js';

function createScenario(level) {
  const actor = { x: 100, y: 100, facing: 'right' };
  const enemy = {
    instanceId: 'showcase-enemy',
    x: 140,
    y: 100,
    radius: 18,
    health: 100,
    maxHealth: 100,
    defeated: false,
    state: 'attacking',
  };
  return { state: createPlayKatanaState(level), actor, enemy, enemies: [enemy] };
}

test('formal play katana Lv.1 hits a nearby enemy and exposes the actual sword swing', () => {
  const scenario = createScenario(1);
  const result = resolvePlayKatanaSlash({ state: scenario.state, actor: scenario.actor, enemies: scenario.enemies, persistent: true });

  assert.equal(result.ok, true);
  assert.equal(result.hit, true);
  assert.equal(result.totalDamage, 28);
  assert.equal(scenario.enemy.health, 72);
  const swing = scenario.state.effects.find((effect) => effect.type === 'katanaSwing' && effect.persistent);
  assert.ok(swing);
  assert.equal(swing.style, 'katanaClockwiseSwing');
  assert.match(swing.sprite, /abyssal-katana\.png$/);
  assert.equal(swing.afterimageCount >= 5, true);
  const frames = getKatanaSwingFrames(swing, 0.82);
  assert.equal(frames.currentAngle > frames.startAngle, true, 'positive Canvas angles produce a clockwise swing');
  assert.equal(frames.afterimages[0].alpha < frames.afterimages.at(-1).alpha, true, 'farther afterimages must be fainter');
});

test('formal play katana applies the active passive damage multiplier', () => {
  const scenario = createScenario(1);
  const result = resolvePlayKatanaSlash({
    state: scenario.state,
    actor: scenario.actor,
    enemies: scenario.enemies,
    damageMultiplier: 1.3,
  });

  assert.equal(result.totalDamage, 36.4);
  assert.equal(scenario.enemy.health, 63.6);
});

test('katana Lv.2 empowers the next slash after movement and doubles its damage', () => {
  const scenario = createScenario(2);
  markPlayKatanaMovement(scenario.state, 4);
  const result = resolvePlayKatanaSlash({ state: scenario.state, actor: scenario.actor, enemies: scenario.enemies });

  assert.equal(result.empowered, true);
  assert.equal(result.totalDamage, 76);
  assert.equal(scenario.enemy.health, 24);
  assert.equal(scenario.state.empowerNextSlash, false);
  assert.equal(scenario.state.effects[0].colour, '#ff5c8a');
  assert.equal(scenario.state.effects[0].afterimageCount, 6);
});

test('formal play katana damages every active enemy inside its range', () => {
  const scenario = createScenario(1);
  const sideEnemy = { ...scenario.enemy, instanceId: 'side-enemy', x: 100, y: 140, health: 100, maxHealth: 100 };
  const farEnemy = { ...scenario.enemy, instanceId: 'far-enemy', x: 100, y: 180, health: 100, maxHealth: 100 };
  const result = resolvePlayKatanaSlash({
    state: scenario.state,
    actor: scenario.actor,
    enemies: [scenario.enemy, sideEnemy, farEnemy],
  });

  assert.equal(result.hitCount, 2);
  assert.equal(scenario.enemy.health, 72);
  assert.equal(sideEnemy.health, 72);
  assert.equal(farEnemy.health, 100, 'enemies beyond the range remain unharmed');
});

test('katana Lv.3 adds a persistent outward projectile wave that survives simulation steps', () => {
  const scenario = createScenario(3);
  const result = resolvePlayKatanaSlash({ state: scenario.state, actor: scenario.actor, enemies: scenario.enemies, persistent: true });

  assert.equal(result.ok, true);
  const wave = scenario.state.effects.find((effect) => effect.type === 'katanaWave' && effect.persistent);
  assert.ok(wave);
  assert.equal(wave.style, 'katanaProjectileWave');
  const start = getKatanaWavePose(wave, 0);
  const end = getKatanaWavePose(wave, 1);
  assert.equal(end.x > start.x, true);
  stepPlayKatana(scenario.state, 10);
  assert.equal(scenario.state.effects.some((effect) => effect.type === 'katanaWave' && effect.persistent), true);
});
