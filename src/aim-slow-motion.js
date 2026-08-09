export const AIM_TIME_SCALE = 0.5;

export function getAimTimeScale(aiming = false) {
  return aiming ? AIM_TIME_SCALE : 1;
}

export function scaleSimulationDelta(delta, aiming = false) {
  return Math.max(0, Number(delta) || 0) * getAimTimeScale(aiming);
}
