import { Container, Graphics } from "pixi.js";

export function clearLayer(layer: Container) {
  for (const child of layer.removeChildren()) {
    destroyStageChild(child);
  }
}

export function showLayerWhenPopulated(layer: Container) {
  layer.visible = layer.children.length > 0;
}

function destroyStageChild(child: Container) {
  if (child instanceof Graphics) {
    // Pixi only destroys owned GraphicsContext objects when destroy() is called
    // without an options object. Passing { children: true } leaks per-frame
    // Graphics contexts in smoke-heavy Live replay frames.
    child.destroy();
    return;
  }

  for (const grandchild of child.removeChildren()) {
    destroyStageChild(grandchild);
  }
  child.destroy();
}
