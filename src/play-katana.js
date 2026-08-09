import { ENEMY_DEFINITIONS, getEnemyDamageToPlayer, getWeaponStats } from './game-data.js';
import { applyDamage } from './physics.js';
import { isResonanceCombatant } from './resonance.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const distanceBetween = (left, right) => Math.hypot(left.x - right.x, left.y - right.y);
const angleBetween = (from, to) => Math.atan2(to.y - from.y, to.x - from.x);

function shortestAngleDifference(left, right) {
  return Math.atan2(Math.sin(left - right), Math.cos(left - right));
}
export function createPlayKatanaState(level = 1) {
  return {
    level: clamp(Math.round(Number(level) || 1), 1, 3),
    cooldown: 0,
    empowerNextSlash: false,
    effects: [],
    slashCount: 0,
    lastHitCount: 0,
    lastDamage: 0,
  };
}

export function markPlayKatanaMovement(state, distance) {
  const weapon = getWeaponStats('katana', state.level);
  if (weapon.effect?.empowerAfterMovement && distance >= 1.5) state.empowerNextSlash = true;
}

export function stepPlayKatana(state, dt) {
  state.cooldown = Math.max(0, state.cooldown - dt);
  state.effects = state.effects.filter((effect) => {
    effect.elapsed += dt;
    return effect.persistent || effect.elapsed < effect.duration;
  });
  return state;
}

function isWithinArc(actor, enemy, weapon) {
  const reach = weapon.range + Math.min(8, (enemy.radius ?? 0) * 0.25);
  return distanceBetween(actor, enemy) <= reach;
}

function activeEnemies(enemies) {
  return enemies.filter(isResonanceCombatant);
}

function nearestEnemy(actor, enemies) {
  return activeEnemies(enemies)
    .sort((left, right) => distanceBetween(actor, left) - distanceBetween(actor, right))[0] ?? null;
}

function addSlashEffect(state, actor, weapon, angle, empowered, hitCount, damage, persistent = false) {
  const effect = weapon.effect ?? {};
  state.effects.push({
    type: 'katanaSwing',
    style: effect.style ?? 'katanaClockwiseSwing',
    x: actor.x,
    y: actor.y,
    angle,
    arcDegrees: effect.arcDegrees ?? weapon.hitArcDegrees ?? 100,
    duration: persistent ? Number.POSITIVE_INFINITY : (effect.duration ?? 0.3),
    elapsed: 0,
    persistent,
    sprite: effect.sprite,
    weaponLength: effect.weaponLength ?? 72,
    weaponThickness: effect.weaponThickness ?? 11.2,
    gripPivot: effect.gripPivot ?? 14,
    afterimageCount: effect.afterimageCount ?? 5,
    afterimageAngleStepDegrees: effect.afterimageAngleStepDegrees ?? 11,
    afterimageAlpha: effect.afterimageAlpha ?? 0.34,
    colour: empowered ? (effect.empoweredColour ?? effect.colour ?? '#ff5c8a') : (effect.colour ?? '#73d9ff'),
    glowColour: empowered ? (effect.empoweredGlowColour ?? effect.glowColour ?? '#ff9eb8') : (effect.glowColour ?? '#9be8ff'),
    empowered,
    hitCount,
    damage,
  });
  const wave = effect.wave;
  if (!wave) return;
  state.effects.push({
    type: 'katanaWave',
    style: wave.style,
    x: actor.x,
    y: actor.y,
    angle,
    startDistance: wave.startDistance ?? 22,
    travelDistance: wave.travelDistance ?? 132,
    radius: wave.radius ?? 22,
    arcDegrees: wave.arcDegrees ?? weapon.hitArcDegrees ?? 100,
    duration: persistent ? Number.POSITIVE_INFINITY : (wave.duration ?? 0.24),
    elapsed: 0,
    persistent,
    lineWidth: wave.lineWidth ?? 4,
    thickness: wave.thickness ?? 8,
    colour: wave.colour ?? '#70f6ff',
    glowColour: wave.glowColour ?? '#b8fbff',
    destroyedProjectiles: 0,
  });
}

export function resolvePlayKatanaSlash({ state, actor, enemies, force = false, persistent = false, targetId = null, damageMultiplier = 1 } = {}) {
  if (!state || !actor || !Array.isArray(enemies)) return { ok: false, reason: 'missingState' };
  if (!force && state.cooldown > 0) return { ok: false, reason: 'cooldown', remaining: state.cooldown };
  const weapon = getWeaponStats('katana', state.level);
  const targetCandidate = targetId
    ? activeEnemies(enemies).find((enemy) => enemy.instanceId === targetId) ?? null
    : nearestEnemy(actor, enemies);
  const hitEnemies = activeEnemies(enemies).filter((enemy) => isWithinArc(actor, enemy, weapon));
  if (!hitEnemies.length) {
    state.lastHitCount = 0;
    state.lastDamage = 0;
    return {
      ok: false,
      reason: 'noTarget',
      hit: false,
      hitCount: 0,
      damage: 0,
      totalDamage: 0,
      empowered: false,
      targetId: targetCandidate?.instanceId ?? null,
    };
  }
  const target = targetCandidate && isWithinArc(actor, targetCandidate, weapon)
    ? targetCandidate
    : nearestEnemy(actor, hitEnemies);
  const angle = target ? angleBetween(actor, target) : (actor.facing === 'left' ? Math.PI : 0);
  const empowered = Boolean(weapon.effect?.empowerAfterMovement && state.empowerNextSlash);
  const multiplier = empowered ? (weapon.effect.empoweredDamageMultiplier ?? 2) : 1;
  const damage = weapon.damage * multiplier * Math.max(0, Number(damageMultiplier) || 1);
  let damagedHitCount = 0;
  let totalDamage = 0;
  hitEnemies.forEach((enemy) => {
    if (enemy.linkedProtection) return;
    const passive = ENEMY_DEFINITIONS[enemy.enemyId]?.passive;
    const enemyMultiplier = Math.max(0, Number(enemy.damageTakenMultiplier ?? passive?.damageTakenMultiplier ?? 1));
    const appliedDamage = damage * enemyMultiplier;
    enemy.health = Math.max(0, enemy.health - appliedDamage);
    if (appliedDamage > 0 && enemy.passiveState?.enraged && Number(passive?.thornsDamage) > 0 && Number.isFinite(actor.health)) {
      applyDamage(actor, getEnemyDamageToPlayer(passive.thornsDamage), `${enemy.name ?? enemy.enemyId}・${passive.name}`, 'contact');
    }
    enemy.hitFlash = 0.22;
    damagedHitCount += 1;
    totalDamage += appliedDamage;
    if (enemy.health <= 0) {
      enemy.defeated = true;
      enemy.state = 'defeated';
    }
  });
  if (empowered) state.empowerNextSlash = false;
  state.cooldown = weapon.cooldown ?? 0.7;
  state.slashCount += 1;
  state.lastHitCount = hitEnemies.length;
  state.lastDamage = totalDamage;
  addSlashEffect(state, actor, weapon, angle, empowered, hitEnemies.length, damage, persistent);
  return {
    ok: true,
    hit: hitEnemies.length > 0,
    hitCount: hitEnemies.length,
    damage,
    totalDamage,
    protectedHitCount: hitEnemies.length - damagedHitCount,
    empowered,
    targetId: target?.instanceId ?? null,
  };
}
