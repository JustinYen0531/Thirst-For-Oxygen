export const ENEMY_SPRITE_SOURCE_FACING = 'left';

export function syncEnemyFacing(enemy, horizontalVelocity = enemy?.vx, threshold = 1) {
  if (!enemy || Math.abs(Number(horizontalVelocity) || 0) <= threshold) return enemy?.facing ?? ENEMY_SPRITE_SOURCE_FACING;
  enemy.facing = horizontalVelocity > 0 ? 'right' : 'left';
  return enemy.facing;
}

export function getEnemySpriteScaleX(facing, sourceFacing = ENEMY_SPRITE_SOURCE_FACING) {
  return facing === sourceFacing ? 1 : -1;
}
