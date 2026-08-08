import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createPlayKatanaState,
  markPlayKatanaMovement,
  resolvePlayKatanaSlash,
  stepPlayKatana,
} from '../src/play-katana.js';

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

test('formal play katana Lv.1 hits a nearby enemy and exposes a visible slash effect', () => {
  const scenario = createScenario(1);
  const result = resolvePlayKatanaSlash({ state: scenario.state, actor: scenario.actor, enemies: scenario.enemies, persistent: true });

  assert.equal(result.ok, true);
  assert.equal(result.hit, true);
  assert.equal(result.totalDamage, 28);
  assert.equal(scenario.enemy.health, 72);
  assert.equal(scenario.state.effects.some((effect) => effect.type === 'katanaSlash' && effect.persistent), true);
});

test('katana Lv.2 empowers the next slash after movement and doubles its damage', () => {
  const scenario = createScenario(2);
  markPlayKatanaMovement(scenario.state, 4);
  const result = resolvePlayKatanaSlash({ state: scenario.state, actor: scenario.actor, enemies: scenario.enemies });

  assert.equal(result.empowered, true);
  assert.equal(result.totalDamage, 76);
  assert.equal(scenario.enemy.health, 24);
  assert.equal(scenario.state.empowerNextSlash, false);
  assert.equal(scenario.state.effects[0].lineWidth, 8);
});

test('katana Lv.3 adds a persistent outer arc wave that survives simulation steps', () => {
  const scenario = createScenario(3);
  const result = resolvePlayKatanaSlash({ state: scenario.state, actor: scenario.actor, enemies: scenario.enemies, persistent: true });

  assert.equal(result.ok, true);
  assert.equal(scenario.state.effects.some((effect) => effect.type === 'katanaWave' && effect.persistent), true);
  stepPlayKatana(scenario.state, 10);
  assert.equal(scenario.state.effects.some((effect) => effect.type === 'katanaWave' && effect.persistent), true);
});
