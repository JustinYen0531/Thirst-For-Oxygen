// Shared afterimage tuning. The newest ghost is readable; older samples fade
// exponentially so the trail never competes with the current sprite.
export const AFTERIMAGE_PROFILE = Object.freeze({
  sampleCount: 4,
  nearestOpacity: 0.28,
  decay: 0.58,
  driftX: 3,
  driftY: -1.5,
  opacities: Object.freeze([0.28, 0.1624, 0.0942, 0.0546]),
});

export function getAfterimageOpacity(age) {
  if (!Number.isInteger(age) || age < 1 || age > AFTERIMAGE_PROFILE.sampleCount) return 0;
  return AFTERIMAGE_PROFILE.nearestOpacity * (AFTERIMAGE_PROFILE.decay ** (age - 1));
}
