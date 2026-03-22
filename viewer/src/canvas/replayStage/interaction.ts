import type { StageState } from "./types";
import { applyCameraTransform, clamp } from "./camera";

export function attachStageInteractions(hostElement: HTMLDivElement, stage: StageState) {
  let dragging = false;
  let lastClientX = 0;
  let lastClientY = 0;

  function onWheel(event: WheelEvent) {
    event.preventDefault();
    const direction = event.deltaY > 0 ? -1 : 1;
    const nextScale = clamp(stage.cameraScale + direction * 0.12, 1, 2.6);
    if (nextScale === stage.cameraScale) {
      return;
    }

    stage.cameraScale = nextScale;
    applyCameraTransform(stage);
  }

  function onPointerDown(event: PointerEvent) {
    dragging = true;
    lastClientX = event.clientX;
    lastClientY = event.clientY;
    hostElement.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: PointerEvent) {
    if (!dragging) {
      return;
    }

    stage.cameraOffsetX += event.clientX - lastClientX;
    stage.cameraOffsetY += event.clientY - lastClientY;
    lastClientX = event.clientX;
    lastClientY = event.clientY;
    applyCameraTransform(stage);
  }

  function onPointerUp(event: PointerEvent) {
    dragging = false;
    if (hostElement.hasPointerCapture(event.pointerId)) {
      hostElement.releasePointerCapture(event.pointerId);
    }
  }

  function onDoubleClick() {
    stage.cameraScale = 1;
    stage.cameraOffsetX = 0;
    stage.cameraOffsetY = 0;
    applyCameraTransform(stage);
  }

  hostElement.addEventListener("wheel", onWheel, { passive: false });
  hostElement.addEventListener("pointerdown", onPointerDown);
  hostElement.addEventListener("pointermove", onPointerMove);
  hostElement.addEventListener("pointerup", onPointerUp);
  hostElement.addEventListener("pointerleave", onPointerUp);
  hostElement.addEventListener("dblclick", onDoubleClick);

  return () => {
    hostElement.removeEventListener("wheel", onWheel);
    hostElement.removeEventListener("pointerdown", onPointerDown);
    hostElement.removeEventListener("pointermove", onPointerMove);
    hostElement.removeEventListener("pointerup", onPointerUp);
    hostElement.removeEventListener("pointerleave", onPointerUp);
    hostElement.removeEventListener("dblclick", onDoubleClick);
  };
}
