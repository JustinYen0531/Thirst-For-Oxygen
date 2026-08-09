import assert from 'node:assert/strict';
import test from 'node:test';

import {
  PLAYER_OUTGOING_DAMAGE_MULTIPLIER,
  calculateWeaponDamage,
  getPlayerDerivedStats,
  getWeaponStats,
} from '../src/game-data.js';

test('player outgoing damage is globally reduced by forty percent', () => {
  assert.equal(PLAYER_OUTGOING_DAMAGE_MULTIPLIER, 0.6);
  assert.equal(getPlayerDerivedStats([]).currentDamageMultiplier, 0.6);

  for (const weaponId of ['knife', 'katana', 'trident', 'lightMachineGun']) {
    const rawDamage = getWeaponStats(weaponId, 1).damage;
    assert.equal(calculateWeaponDamage(weaponId, 1), rawDamage * 0.6, weaponId);
  }
});

test('damage passives still multiply the reduced baseline', () => {
  const normal = getPlayerDerivedStats([], 100).currentDamageMultiplier;
  const amplified = getPlayerDerivedStats([{ id: 'abyssalAmplifier', level: 3 }], 100).currentDamageMultiplier;
  assert.ok(amplified > normal);
  assert.equal(normal, 0.6);
});
