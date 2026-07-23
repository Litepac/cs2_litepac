import { Graphics } from "pixi.js";

import { clamp } from "./camera";

const FLASH_SECONDS = 0.28;

export function drawBombExplosionEventCue(
  marker: Graphics,
  centerX: number,
  centerY: number,
  eventAgeSeconds: number,
) {
  if (eventAgeSeconds < 0 || eventAgeSeconds > FLASH_SECONDS) {
    return;
  }

  const flashAlpha = 1 - clamp(eventAgeSeconds / FLASH_SECONDS, 0, 1);
  const flashProgress = 1 - flashAlpha;
  marker.circle(centerX, centerY, 8 + flashProgress * 18);
  marker.fill({ color: 0xffc46f, alpha: flashAlpha * 0.22 });
  drawFlashRays(marker, centerX, centerY, flashProgress, flashAlpha);
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
