import { Container, Graphics, GraphicsContext } from "pixi.js";

export type EquipmentSvgIcon = {
  height: number;
  svg: string;
  width: number;
};

const iconContextCache = new Map<string, GraphicsContext>();

export function drawTintedEquipmentIcon(
  layer: Container,
  iconDefinition: EquipmentSvgIcon,
  x: number,
  y: number,
  maxWidth: number,
  maxHeight: number,
  color: number,
  shadowColor: number,
  alpha: number,
  options?: {
    shadowAlpha?: number;
    shadowOffsetX?: number;
    shadowOffsetY?: number;
    shadowScale?: number;
  },
) {
  const iconScale = Math.min(maxWidth / iconDefinition.width, maxHeight / iconDefinition.height);
  const shadow = createEquipmentIconGraphic(iconDefinition, x + (options?.shadowOffsetX ?? 0.45), y + (options?.shadowOffsetY ?? 0.55), iconScale * (options?.shadowScale ?? 1.14), shadowColor, (options?.shadowAlpha ?? 0.58) * alpha);
  layer.addChild(shadow);

  const icon = createEquipmentIconGraphic(iconDefinition, x, y, iconScale, color, alpha);
  layer.addChild(icon);
}

export function createEquipmentIconGraphic(
  iconDefinition: EquipmentSvgIcon,
  x: number,
  y: number,
  scale: number,
  color: number,
  alpha: number,
) {
  const icon = new Graphics(getEquipmentIconContext(iconDefinition));
  icon.pivot.set(iconDefinition.width / 2, iconDefinition.height / 2);
  icon.position.set(x, y);
  icon.scale.set(scale);
  icon.tint = color;
  icon.alpha = alpha;
  return icon;
}

function getEquipmentIconContext(iconDefinition: EquipmentSvgIcon) {
  const cached = iconContextCache.get(iconDefinition.svg);
  if (cached) {
    return cached;
  }

  const context = new GraphicsContext();
  context.svg(iconDefinition.svg);
  iconContextCache.set(iconDefinition.svg, context);
  return context;
}
