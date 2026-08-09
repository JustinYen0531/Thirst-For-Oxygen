export const ENEMY_SPRITE_SOURCE_FACING = 'left';
export const ENEMY_LOITER_CYCLE_DURATION = 5.2;
export const ENEMY_LOITER_TRAVEL_DURATION = 3.7;
export const ENEMY_LOITER_GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function stableEnemySeed(enemy) {
  const source = String(enemy?.instanceId ?? enemy?.enemyId ?? enemy?.id ?? 'enemy');
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function getEnemyLoiterPlan(enemy, time = 0, {
  center = { x: enemy?.homeX ?? enemy?.x ?? 0, y: enemy?.homeY ?? enemy?.y ?? 0 },
  radius = 120,
  bounds = null,
  margin = 30,
} = {}) {
  const seed = stableEnemySeed(enemy);
  const phaseOffset = ((seed % 1000) / 1000) * ENEMY_LOITER_CYCLE_DURATION;
  const localTime = Math.max(0, Number(time) || 0) + phaseOffset;
  const cycle = Math.floor(localTime / ENEMY_LOITER_CYCLE_DURATION);
  const cycleTime = localTime - cycle * ENEMY_LOITER_CYCLE_DURATION;
  const angle = ((seed % 360) * Math.PI / 180) + cycle * ENEMY_LOITER_GOLDEN_ANGLE;
  const distanceScale = 0.68 + (((seed >>> 8) + cycle * 37) % 25) / 100;
  const distance = Math.max(18, radius * distanceScale);
  let x = center.x + Math.cos(angle) * distance;
  let y = center.y + Math.sin(angle) * distance;
  if (bounds) {
    x = clamp(x, bounds.minX + margin, bounds.maxX - margin);
    y = clamp(y, bounds.minY + margin, bounds.maxY - margin);
  }
  return Object.freeze({
    cycle,
    phase: cycleTime < ENEMY_LOITER_TRAVEL_DURATION ? 'travel' : 'pause',
    x,
    y,
    angle,
    distance,
  });
}

export function easeEnemyVelocity(enemy, desiredAngle, speed, elapsed, turnRate = 4.2) {
  const dt = Math.max(0, Number(elapsed) || 0);
  const targetSpeed = Math.max(0, Number(speed) || 0);
  const targetVx = Math.cos(desiredAngle) * targetSpeed;
  const targetVy = Math.sin(desiredAngle) * targetSpeed;
  const currentVx = Number(enemy.vx) || 0;
  const currentVy = Number(enemy.vy) || 0;
  const currentSpeed = Math.hypot(currentVx, currentVy);
  if (currentSpeed <= 1e-6 || targetSpeed <= 1e-6) {
    enemy.vx = targetVx;
    enemy.vy = targetVy;
    return { vx: enemy.vx, vy: enemy.vy };
  }
  const blend = 1 - Math.exp(-Math.max(0.1, turnRate) * dt);
  const blendedVx = currentVx + (targetVx - currentVx) * blend;
  const blendedVy = currentVy + (targetVy - currentVy) * blend;
  const blendedSpeed = Math.hypot(blendedVx, blendedVy) || 1;
  enemy.vx = blendedVx / blendedSpeed * targetSpeed;
  enemy.vy = blendedVy / blendedSpeed * targetSpeed;
  return { vx: enemy.vx, vy: enemy.vy };
}

export function syncEnemyFacing(enemy, horizontalVelocity = enemy?.vx, threshold = 1) {
  if (!enemy || Math.abs(Number(horizontalVelocity) || 0) <= threshold) return enemy?.facing ?? ENEMY_SPRITE_SOURCE_FACING;
  enemy.facing = horizontalVelocity > 0 ? 'right' : 'left';
  return enemy.facing;
}

export function getEnemySpriteScaleX(facing, sourceFacing = ENEMY_SPRITE_SOURCE_FACING) {
  return facing === sourceFacing ? 1 : -1;
}
