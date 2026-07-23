import { Graphics } from "pixi.js";

import { clamp } from "./camera";

const WAVE_SECONDS = 1.35;
const WAVE_START_PX = 11;
const WAVE_END_PX = 96;
const FLASH_SECONDS = 0.28;

export function drawBombExplosionEventWave(
  marker: Graphics,
  centerX: number,
  centerY: number,
  eventAgeSeconds: number,
) {
  if (eventAgeSeconds < 0 || eventAgeSeconds > WAVE_SECONDS) {
    return;
  }

  // Screen-space event emphasis only. CS2's current C4 damage wave is driven by
  // map-compiled, occlusion-aware simulation data that is not present here.
  const progress = clamp(eventAgeSeconds / WAVE_SECONDS, 0, 1);
  const easedProgress = 1 - (1 - progress) ** 3;
  const frontRadius = WAVE_START_PX + (WAVE_END_PX - WAVE_START_PX) * easedProgress;
  const frontAlpha = (1 - progress) ** 1.35;
  const rotation = -Math.PI / 18 + progress * 0.16;

  drawBrokenShockFront(marker, centerX, centerY, frontRadius, rotation, 0xffb25a, 3.4, frontAlpha * 0.84);

  const trailingProgress = clamp((progress - 0.08) / 0.92, 0, 1);
  if (trailingProgress > 0) {
    const trailingRadius =
      WAVE_START_PX + (WAVE_END_PX * 0.78 - WAVE_START_PX) * (1 - (1 - trailingProgress) ** 2);
    drawBrokenShockFront(
      marker,
      centerX,
      centerY,
      trailingRadius,
      rotation + Math.PI / 16,
      0xffe1b3,
      1.55,
      frontAlpha * 0.42,
    );
  }

  const flashAlpha = 1 - clamp(eventAgeSeconds / FLASH_SECONDS, 0, 1);
  if (flashAlpha > 0) {
    const flashProgress = 1 - flashAlpha;
    marker.circle(centerX, centerY, 8 + flashProgress * 18);
    marker.fill({ color: 0xffc46f, alpha: flashAlpha * 0.22 });
    drawFlashRays(marker, centerX, centerY, flashProgress, flashAlpha);
  }
}

function drawBrokenShockFront(
  marker: Graphics,
  centerX: number,
  centerY: number,
  radius: number,
  rotation: number,
  color: number,
  width: number,
  alpha: number,
) {
  const segmentCount = 18;
  const segmentArc = (Math.PI * 2) / segmentCount;

  for (let index = 0; index < segmentCount; index++) {
    const stagger = (index % 3) * 0.018;
    const startAngle = rotation + index * segmentArc + segmentArc * (0.18 + stagger);
    const endAngle = startAngle + segmentArc * (0.54 + (index % 2) * 0.08);
    drawArc(marker, centerX, centerY, radius + (index % 2) * 1.3, startAngle, endAngle);
  }
  marker.stroke({ color, width, alpha, cap: "round" });
}

function drawFlashRays(
  marker: Graphics,
  centerX: number,
  centerY: number,
  flashProgress: number,
  flashAlpha: number,
) {
  for (let index = 0; index < 8; index++) {
    const angle = -Math.PI / 8 + (index * Math.PI) / 4;
    const innerRadius = 9 + flashProgress * 5;
    const outerRadius = 18 + flashProgress * 15 + (index % 2) * 4;
    marker.moveTo(centerX + Math.cos(angle) * innerRadius, centerY + Math.sin(angle) * innerRadius);
    marker.lineTo(centerX + Math.cos(angle) * outerRadius, centerY + Math.sin(angle) * outerRadius);
  }
  marker.stroke({ color: 0xffe6bd, width: 1.45, alpha: flashAlpha * 0.64, cap: "round" });
}

function drawArc(
  marker: Graphics,
  centerX: number,
  centerY: number,
  radius: number,
  startAngle: number,
  endAngle: number,
) {
  marker.moveTo(centerX + Math.cos(startAngle) * radius, centerY + Math.sin(startAngle) * radius);
  marker.arc(centerX, centerY, radius, startAngle, endAngle);
}
