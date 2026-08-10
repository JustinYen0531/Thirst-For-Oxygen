import assert from 'node:assert/strict';
import test from 'node:test';
import { parseSandboxDevCommand, SANDBOX_DEV_SHORTCUTS } from '../src/sandbox-devtools.js';
import {
  createSandboxState,
  getSandboxResonanceRenderState,
  setSandboxResonanceStacks,
} from '../src/sandbox-sim.js';

const weaponIds = ['knife', 'katana', 'trident', 'lightMachineGun'];
const passiveIds = ['oxygenCirculator', 'pressureStabilizer', 'ecologicalCarapace', 'abyssalAmplifier'];
const resonanceIds = ['crabGuard', 'abyssalSpermWhale'];
const options = { weaponIds, passiveIds, resonanceIds };

test('sandbox dev command parses exact weapon, passive, and Resonance values', () => {
  const result = parseSandboxDevCommand(
    'weapon 1 katana 3; passive 1 oxygenCirculator 3; resonance crabGuard 9',
    options,
  );
  assert.equal(result.ok, true);
  assert.deepEqual(result.actions, [
    { type: 'weapon', slot: 0, id: 'katana', level: 3 },
    { type: 'passive', slot: 0, id: 'oxygenCirculator', level: 3 },
    { type: 'resonance', id: 'crabGuard', stacks: 9 },
  ]);
});

test('sandbox dev command supports max aliases and clearing Resonance', () => {
  const result = parseSandboxDevCommand('max weapons; max passives; max resonance; clear resonance', options);
  assert.equal(result.ok, true);
  assert.deepEqual(result.actions, [
    { type: 'maxWeapons' },
    { type: 'maxPassives' },
    { type: 'resonance', id: 'all', stacks: 'max' },
    { type: 'clearResonance' },
  ]);
});

test('sandbox developer shortcut contract stays explicit', () => {
  assert.deepEqual(SANDBOX_DEV_SHORTCUTS, {
    toggle: 'Ctrl+Alt+D',
    maxWeapons: 'Alt+1',
    maxPassives: 'Alt+2',
    maxResonance: 'Alt+3',
    clear: 'Alt+0',
  });
  assert.deepEqual(parseSandboxDevCommand('resonance none', options).actions, [{ type: 'clearResonance' }]);
});

test('sandbox dev command rejects unknown IDs and invalid slots', () => {
  assert.equal(parseSandboxDevCommand('weapon 4 katana 3', options).ok, false);
  assert.equal(parseSandboxDevCommand('passive 1 missingPassive 2', options).ok, false);
  assert.equal(parseSandboxDevCommand('resonance missingEnemy 2', options).ok, false);
});

test('sandbox Resonance override updates render state and combat stats', () => {
  const state = createSandboxState();
  const baseDamageMultiplier = state.actor.derivedStats.currentDamageMultiplier;
  setSandboxResonanceStacks(state, [['abyssalSpermWhale', 3]]);
  const resonance = getSandboxResonanceRenderState(state);
  assert.deepEqual(resonance.buffs[0], {
    enemyId: 'abyssalSpermWhale',
    name: '深淵共鳴',
    description: '每層武器傷害約 +3.23%，受到的傷害約 -1.33%。',
    combatStyle: 'ranged',
    stacks: 3,
    maxStacks: 3,
    atCap: true,
  });
  assert.ok(state.actor.derivedStats.currentDamageMultiplier > baseDamageMultiplier);
});
