import {
  DIRECTIONS,
  GRAVITY_LEVELS,
  allMapEdges,
  findCellContainingPoint,
  getActiveCell,
  getDirectionVector,
  getEdgeBetween,
  getHexCenter,
  neighborKey,
  patchCell,
} from './map-model.js';

export const FIXED_STEP = 1 / 60;
export const SIMULATION_SPEED_SCALE = 0.1;
export const GRAVITY_SCALE = 0.5;
export const GAME_GRAVITY = 230 * SIMULATION_SPEED_SCALE * GRAVITY_SCALE;
export const MAX_SPEED = 560 * SIMULATION_SPEED_SCALE;
const LAUNCH_SPEED_PER_PIXEL = 2.9 * SIMULATION_SPEED_SCALE;
const CURRENT_ACCELERATION = 74 * SIMULATION_SPEED_SCALE;
const WEIGHT_STONE_BREAK_SPEED = 310 * SIMULATION_SPEED_SCALE;
const HORIZONTAL_WATER_DRAG = 0.96;
const VERTICAL_WATER_DRAG = 0.998;
const HORIZONTAL_STOP_SPEED = 0.15;
export const WORLD_BOUNDS = Object.freeze({ minX: 24, maxX: 976, minY: 24, maxY: 656 });

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function reflect(velocity, normal, multiplier = 0.72) {
  const dot = velocity.x * normal.x + velocity.y * normal.y;
  return {
    x: (velocity.x - 2 * dot * normal.x) * multiplier,
    y: (velocity.y - 2 * dot * normal.y) * multiplier,
  };
}

function unitVector(from, to) {
  const x = to.x - from.x;
  const y = to.y - from.y;
  const length = Math.hypot(x, y) || 1;
  return { x: x / length, y: y / length };
}

function isOnCooldown(actor, key) {
  return (actor.cooldowns[key] ?? 0) > 0;
}

function addEvent(events, type, message) {
  events.push({ type, message });
}

export function createTestActor(position = { x: 180, y: 180 }) {
  return {
    x: position.x,
    y: position.y,
    vx: 0,
    vy: 0,
    radius: 6,
    health: 3,
    oxygen: 100,
    stamina: 100,
    attached: false,
    gravityImmunity: 0,
    safe: false,
    inInk: false,
    spawn: { ...position },
    cooldowns: {},
  };
}

export function findPlayerStart(map, chapter, origin) {
  for (const [key, baseCell] of Object.entries(map.cells)) {
    const cell = getActiveCell(map, key, chapter);
    if (cell.terrain !== 'blocked' && cell.actors.some((actor) => actor.kind === 'playerStart')) {
      return getHexCenter(cell, origin);
    }
  }
  const first = getActiveCell(map, '0,0', chapter) ?? Object.values(map.cells)[0];
  return getHexCenter(first, origin);
}

export function resetTestActor(actor, map, chapter, origin) {
  const spawn = findPlayerStart(map, chapter, origin);
  Object.assign(actor, createTestActor(spawn));
  return actor;
}

export function launchActor(actor, pointer) {
  if (actor.attached) return 0;
  const pull = { x: actor.x - pointer.x, y: actor.y - pointer.y };
  const distance = clamp(Math.hypot(pull.x, pull.y), 0, 170);
  if (distance < 5) return 0;
  const direction = unitVector(pointer, actor);
  const speed = LAUNCH_SPEED_PER_PIXEL * distance;
  actor.vx = direction.x * speed;
  actor.vy = direction.y * speed;
  actor.stamina = clamp(actor.stamina - distance * 0.08, 0, 100);
  return speed;
}

export function toggleSeaweedAttachment(actor, map, chapter, origin) {
  if (actor.attached) {
    actor.attached = false;
    return { changed: true, attached: false, message: '已離開水草，重力重新生效。' };
  }
  for (const [key] of Object.entries(map.cells)) {
    const cell = getActiveCell(map, key, chapter);
    if (!cell.objects.some((object) => object.kind === 'seaweed')) continue;
    const position = getHexCenter(cell, origin);
    if (Math.hypot(actor.x - position.x, actor.y - position.y) <= 42) {
      actor.x = position.x;
      actor.y = position.y;
      actor.vx = 0;
      actor.vy = 0;
      actor.attached = true;
      return { changed: true, attached: true, message: '已附著水草：暫停重力並回復體力。' };
    }
  }
  return { changed: false, attached: false, message: '附近沒有可附著的水草。' };
}

function applyCurrentAcceleration(map, cellKey, chapter) {
  if (!cellKey) return { x: 0, y: 0 };
  let x = 0;
  let y = 0;
  DIRECTIONS.forEach((_, directionIndex) => {
    const adjacent = neighborKey(cellKey, directionIndex);
    if (!map.cells[adjacent]) return;
    const edge = getEdgeBetween(map, cellKey, adjacent, chapter);
    if (edge.type !== 'current' || edge.currentStrength <= 0) return;
    const vector = getDirectionVector(edge.currentDirection);
    const magnitude = CURRENT_ACCELERATION * edge.currentStrength;
    x += vector.x * magnitude;
    y += vector.y * magnitude;
  });
  return { x, y };
}

function processBoundary(actor, bounds, events) {
  let collided = false;
  if (actor.x - actor.radius < bounds.minX) {
    actor.x = bounds.minX + actor.radius;
    actor.vx = Math.abs(actor.vx) * 0.72;
    collided = true;
  }
  if (actor.x + actor.radius > bounds.maxX) {
    actor.x = bounds.maxX - actor.radius;
    actor.vx = -Math.abs(actor.vx) * 0.72;
    collided = true;
  }
  if (actor.y - actor.radius < bounds.minY) {
    actor.y = bounds.minY + actor.radius;
    actor.vy = Math.abs(actor.vy) * 0.72;
    collided = true;
  }
  if (actor.y + actor.radius > bounds.maxY) {
    actor.y = bounds.maxY - actor.radius;
    actor.vy = -Math.abs(actor.vy) * 0.72;
    collided = true;
  }
  if (collided) addEvent(events, 'wall', '碰到測試區邊界：速度已反彈。');
}

function processCrossedEdge(map, actor, fromKey, toKey, chapter, origin, events) {
  if (!fromKey || !toKey || fromKey === toKey) return;
  const edge = getEdgeBetween(map, fromKey, toKey, chapter);
  if (!edge.blocksPassage && edge.type !== 'springJelly') return;
  const from = getHexCenter(getActiveCell(map, fromKey, chapter), origin);
  const to = getHexCenter(getActiveCell(map, toKey, chapter), origin);
  const normal = unitVector(from, to);
  const multiplier = edge.type === 'springJelly' ? 1.08 : 0.68;
  const reflected = reflect({ x: actor.vx, y: actor.vy }, normal, multiplier);
  actor.vx = reflected.x;
  actor.vy = reflected.y;
  actor.x = from.x + normal.x * 8;
  actor.y = from.y + normal.y * 8;
  if (edge.type === 'springJelly') addEvent(events, 'springJelly', '彈簧水母：依入射角反射並加速。');
  else if (edge.type === 'spike') {
    actor.health = Math.max(0, actor.health - 1);
    addEvent(events, 'spike', '尖刺阻擋：反彈並受到 1 點傷害。');
  } else addEvent(events, 'barrier', '障礙 Edge 阻擋：速度已反彈。');
}

function processCellObjects(map, actor, chapter, origin, events, mutateMap) {
  actor.safe = false;
  actor.inInk = false;
  const current = findCellContainingPoint(map, actor, chapter, origin);
  if (!current) return;
  const cell = current.cell;
  actor.safe = cell.overlays.includes('coral');
  actor.inInk = cell.overlays.includes('ink');
  if (cell.overlays.includes('coral')) addEvent(events, 'coral', '珊瑚安全區：玩家處於安全狀態。');
  if (cell.overlays.includes('ink')) addEvent(events, 'ink', '墨水區：預覽視野受限。');

  Object.entries(map.cells).forEach(([key]) => {
    const objectCell = getActiveCell(map, key, chapter);
    const position = getHexCenter(objectCell, origin);
    const distance = Math.hypot(actor.x - position.x, actor.y - position.y);
    if (distance > actor.radius + 22) return;

    objectCell.objects.forEach((object) => {
      if (object.kind === 'mine' && !isOnCooldown(actor, `mine:${key}`)) {
        const normal = unitVector(position, actor);
        const bounced = reflect({ x: actor.vx, y: actor.vy }, normal, 1.03);
        actor.vx = bounced.x;
        actor.vy = bounced.y;
        if (!actor.safe) actor.health = Math.max(0, actor.health - 1);
        actor.cooldowns[`mine:${key}`] = 0.5;
        addEvent(events, 'mine', actor.safe ? '深海地雷：珊瑚安全區抵銷了傷害。' : '深海地雷：強力反彈並受到 1 點傷害。');
      }
      if (object.kind === 'weightStone' && !isOnCooldown(actor, `stone:${key}`)) {
        const impact = Math.hypot(actor.vx, actor.vy);
        if (impact >= WEIGHT_STONE_BREAK_SPEED && mutateMap) {
          const editable = getActiveCell(map, key, chapter);
          patchCell(map, key, { objects: editable.objects.filter((candidate) => candidate !== object) }, chapter);
          actor.cooldowns[`stone:${key}`] = 0.5;
          addEvent(events, 'weightStone', '重石已被足夠的撞擊力擊碎。');
        } else {
          const normal = unitVector(position, actor);
          const bounced = reflect({ x: actor.vx, y: actor.vy }, normal, 0.55);
          actor.vx = bounced.x;
          actor.vy = Math.abs(bounced.y) + 4;
          actor.cooldowns[`stone:${key}`] = 0.35;
          addEvent(events, 'weightStone', '重石壓下玩家：撞擊力不足以擊碎。');
        }
      }
      if (object.kind === 'oxygen') {
        actor.oxygen = 100;
        addEvent(events, 'oxygen', '氧氣來源：氧氣已補滿。');
      }
      if (object.kind === 'torricelli') {
        actor.oxygen = Math.min(100, actor.oxygen + 20);
        addEvent(events, 'torricelli', '托里切利空間：獲得短暫氧氣補給。');
      }
      if (object.kind === 'bubble' && actor.gravityImmunity <= 0) {
        actor.gravityImmunity = 2.5;
        addEvent(events, 'bubble', '光合作用氣泡：暫時免疫水域重力，保留現有速度。');
      }
      if (object.kind === 'checkpoint') {
        actor.spawn = { x: position.x, y: position.y };
        actor.health = 3;
        actor.oxygen = 100;
        actor.stamina = 100;
        addEvent(events, 'checkpoint', 'Checkpoint：已更新重生點並回滿資源。');
      }
    });
  });
}

export function stepPhysics({ map, chapter = 'chapter1', actor, dt = FIXED_STEP, origin, bounds = WORLD_BOUNDS, mutateMap = true }) {
  const events = [];
  Object.keys(actor.cooldowns).forEach((key) => {
    actor.cooldowns[key] = Math.max(0, actor.cooldowns[key] - dt);
  });
  actor.gravityImmunity = Math.max(0, actor.gravityImmunity - dt);
  if (actor.attached) {
    actor.stamina = Math.min(100, actor.stamina + 12 * dt);
    return events;
  }

  const before = findCellContainingPoint(map, actor, chapter, origin);
  const activeCell = before?.cell;
  const zoneGravity = actor.gravityImmunity > 0 ? 0 : (GRAVITY_LEVELS[activeCell?.gravityLevel] ?? 0) * GAME_GRAVITY;
  const current = applyCurrentAcceleration(map, before?.key, chapter);
  const special = actor.specialAcceleration ?? { x: 0, y: 0 };
  const horizontalDrag = Math.pow(HORIZONTAL_WATER_DRAG, dt * 60);
  const verticalDrag = Math.pow(VERTICAL_WATER_DRAG, dt * 60);
  actor.vx = (actor.vx + (current.x + special.x) * dt) * horizontalDrag;
  if (Math.abs(actor.vx) < HORIZONTAL_STOP_SPEED) actor.vx = 0;
  actor.vy = (actor.vy + (zoneGravity + current.y + special.y) * dt) * verticalDrag;
  const speed = Math.hypot(actor.vx, actor.vy);
  if (speed > MAX_SPEED) {
    actor.vx = (actor.vx / speed) * MAX_SPEED;
    actor.vy = (actor.vy / speed) * MAX_SPEED;
  }
  actor.x += actor.vx * dt;
  actor.y += actor.vy * dt;
  processBoundary(actor, bounds, events);
  const after = findCellContainingPoint(map, actor, chapter, origin);
  processCrossedEdge(map, actor, before?.key, after?.key, chapter, origin, events);
  // Consume oxygen before contact rewards so Checkpoint and oxygen sources can
  // fulfill their documented promise of restoring the resource to its maximum.
  actor.oxygen = Math.max(0, actor.oxygen - (0.15 + Math.hypot(actor.vx, actor.vy) / 3000) * dt);
  processCellObjects(map, actor, chapter, origin, events, mutateMap);
  return events;
}

export function predictTrajectory({ map, chapter, actor, pointer, origin, steps = 120 }) {
  const previewMap = JSON.parse(JSON.stringify(map));
  const ghost = JSON.parse(JSON.stringify(actor));
  launchActor(ghost, pointer);
  const points = [];
  for (let index = 0; index < steps; index += 1) {
    stepPhysics({ map: previewMap, chapter, actor: ghost, origin, mutateMap: true });
    points.push({ x: ghost.x, y: ghost.y });
  }
  return points;
}

export function getCurrentEdgeSummary(map, chapter) {
  return allMapEdges(map)
    .map(({ key }) => ({ key, edge: map.edges[key] ? getEdgeBetween(map, ...key.split('|'), chapter) : null }))
    .filter(({ edge }) => edge?.type === 'current');
}
