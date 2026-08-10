export const KATANA_SPRITE = './assets/editor/weapons/abyssal-katana.png';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const toRadians = (degrees) => (degrees * Math.PI) / 180;

export function getKatanaSwingFrames(effect, progress) {
  const safeProgress = clamp(Number(progress) || 0, 0, 1);
  const easedProgress = 1 - ((1 - safeProgress) ** 3);
  const halfArc = toRadians((effect.arcDegrees ?? 110) * 0.5);
  const startAngle = effect.angle - halfArc;
  const endAngle = effect.angle + halfArc;
  const currentAngle = startAngle + (endAngle - startAngle) * easedProgress;
  const afterimageCount = Math.max(0, Math.round(effect.afterimageCount ?? 5));
  const angleStep = toRadians(effect.afterimageAngleStepDegrees ?? 11);
  const maximumAlpha = effect.afterimageAlpha ?? 0.34;
  const afterimages = [];

  for (let distance = afterimageCount; distance >= 1; distance -= 1) {
    afterimages.push({
      angle: Math.max(startAngle, currentAngle - angleStep * distance),
      alpha: maximumAlpha * (1 - distance / (afterimageCount + 1)),
      distance,
    });
  }

  return { startAngle, endAngle, currentAngle, afterimages };
}

export function getKatanaWavePose(effect, progress) {
  const safeProgress = clamp(Number(progress) || 0, 0, 1);
  const easedProgress = 1 - ((1 - safeProgress) ** 2);
  const startDistance = effect.startDistance ?? 22;
  const travelDistance = effect.travelDistance ?? 132;
  const distance = startDistance + (travelDistance - startDistance) * easedProgress;
  return {
    x: effect.x + Math.cos(effect.angle) * distance,
    y: effect.y + Math.sin(effect.angle) * distance,
    radius: effect.radius ?? 22,
    angle: effect.angle,
    progress: safeProgress,
  };
}
