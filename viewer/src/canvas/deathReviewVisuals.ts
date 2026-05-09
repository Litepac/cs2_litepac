import { Circle, Container, Graphics, Text } from "pixi.js";

import type { RadarViewport } from "../maps/transform";
import { worldToScreen } from "../maps/transform";
import type { DeathReviewEntry } from "../replay/deathReview";
import type { Replay } from "../replay/types";

const CT_COLOR = 0x56b3ff;
const T_COLOR = 0xf2a64b;
const NEUTRAL_COLOR = 0xd8e1e8;
const SELECTED_COLOR = 0xfff1cf;

export function drawDeathReviewMarker(
  layer: Container,
  replay: Replay,
  entry: DeathReviewEntry,
  radarViewport: RadarViewport,
  selected: boolean,
  onSelect: (entry: DeathReviewEntry) => void,
) {
  if (entry.victimX == null || entry.victimY == null) {
    return;
  }

  const point = worldToScreen(replay, radarViewport, entry.victimX, entry.victimY);
  const color = selected ? SELECTED_COLOR : entry.victimSide === "CT" ? CT_COLOR : entry.victimSide === "T" ? T_COLOR : NEUTRAL_COLOR;

  if (selected) {
    drawSelectedDeathContext(layer, replay, entry, radarViewport, color);
  }

  const marker = new Graphics();
  const radius = selected ? 13 : 10;

  marker.circle(point.x, point.y, radius + 4);
  marker.fill({ color: 0x04080b, alpha: selected ? 0.5 : 0.28 });
  marker.circle(point.x, point.y, radius + 1.5);
  marker.stroke({ color, width: selected ? 2.4 : 1.7, alpha: selected ? 0.95 : 0.72 });
  marker.moveTo(point.x - 5.5, point.y - 5.5);
  marker.lineTo(point.x + 5.5, point.y + 5.5);
  marker.moveTo(point.x + 5.5, point.y - 5.5);
  marker.lineTo(point.x - 5.5, point.y + 5.5);
  marker.stroke({ color, width: selected ? 2.2 : 1.55, alpha: selected ? 0.94 : 0.72, cap: "round", join: "round" });

  marker.eventMode = "static";
  marker.cursor = "pointer";
  marker.hitArea = new Circle(point.x, point.y, 22);
  marker.on("pointerdown", (event) => {
    const nativeEvent = event.nativeEvent as (PointerEvent & { __drIgnoreStagePan?: boolean }) | undefined;
    if (nativeEvent) {
      nativeEvent.__drIgnoreStagePan = true;
      nativeEvent.preventDefault();
    }
    event.stopPropagation();
    onSelect(entry);
  });
  marker.on("pointertap", (event) => event.stopPropagation());
  layer.addChild(marker);

  if (selected) {
    drawDeathLabel(layer, point.x, point.y + radius + 4, entry.victimName, color);
  }

  if (selected && entry.timeDisplay) {
    const timeLabel = new Text({
      text: entry.timeDisplay,
      style: {
        fill: 0xfff1cf,
        fontFamily: "JetBrains Mono, Fira Code, monospace",
        fontSize: 10,
        fontWeight: "900",
        stroke: { color: 0x05080b, width: 3, join: "round" },
      },
    });
    timeLabel.anchor.set(0.5, 1);
    timeLabel.roundPixels = true;
    timeLabel.resolution = 2;
    timeLabel.position.set(point.x, point.y - radius - 5);
    layer.addChild(timeLabel);
  }
}

function drawSelectedDeathContext(
  layer: Container,
  replay: Replay,
  entry: DeathReviewEntry,
  radarViewport: RadarViewport,
  color: number,
) {
  const context = new Graphics();

  if (entry.victimPath.length >= 2) {
    for (let index = 1; index < entry.victimPath.length; index += 1) {
      const previous = worldToScreen(replay, radarViewport, entry.victimPath[index - 1].x, entry.victimPath[index - 1].y);
      const current = worldToScreen(replay, radarViewport, entry.victimPath[index].x, entry.victimPath[index].y);
      const progress = index / Math.max(1, entry.victimPath.length - 1);
      context.moveTo(previous.x, previous.y);
      context.lineTo(current.x, current.y);
      context.stroke({ color, width: 1.3 + progress * 1.3, alpha: 0.14 + progress * 0.28, cap: "round", join: "round" });
    }
  }

  if (entry.killerX != null && entry.killerY != null && entry.victimX != null && entry.victimY != null) {
    const killerPoint = worldToScreen(replay, radarViewport, entry.killerX, entry.killerY);
    const victimPoint = worldToScreen(replay, radarViewport, entry.victimX, entry.victimY);
    context.moveTo(killerPoint.x, killerPoint.y);
    context.lineTo(victimPoint.x, victimPoint.y);
    context.stroke({ color: 0xfff1cf, width: 3.4, alpha: 0.12, cap: "round", join: "round" });
    context.moveTo(killerPoint.x, killerPoint.y);
    context.lineTo(victimPoint.x, victimPoint.y);
    context.stroke({ color: 0xfff1cf, width: 1.05, alpha: 0.46, cap: "round", join: "round" });
    context.circle(killerPoint.x, killerPoint.y, 4.4);
    context.fill({ color: 0xfff1cf, alpha: 0.86 });
    context.circle(killerPoint.x, killerPoint.y, 8.5);
    context.stroke({ color: 0x05080b, width: 3, alpha: 0.72 });
    context.circle(killerPoint.x, killerPoint.y, 8.5);
    context.stroke({ color: 0xfff1cf, width: 1.2, alpha: 0.62 });
  }

  layer.addChild(context);
}

function drawDeathLabel(
  layer: Container,
  x: number,
  y: number,
  name: string,
  color: number,
) {
  const label = new Text({
    text: name,
    style: {
      fill: 0xffffff,
      fontFamily: "Inter Tight, Inter, system-ui, sans-serif",
      fontSize: 12,
      fontWeight: "900",
      stroke: { color: 0x05080b, width: 4, join: "round" },
    },
  });
  label.anchor.set(0.5, 0);
  label.roundPixels = true;
  label.resolution = 2;
  label.position.set(x, y);
  label.alpha = 0.98;
  layer.addChild(label);

  const underline = new Graphics();
  underline.moveTo(x - Math.min(34, Math.max(16, name.length * 3.4)), y + 15);
  underline.lineTo(x + Math.min(34, Math.max(16, name.length * 3.4)), y + 15);
  underline.stroke({ color, width: 1.4, alpha: 0.76, cap: "round" });
  layer.addChild(underline);
}
