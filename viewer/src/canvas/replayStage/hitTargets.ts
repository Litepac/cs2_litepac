import type { Container, FederatedPointerEvent, IHitArea } from "pixi.js";

type ReplayNativePointerEvent = PointerEvent & {
  __drIgnoreStagePan?: boolean;
};

type HitTargetOptions = {
  activateOn?: "pointerdown" | "pointertap";
  cursor?: string;
  hitArea: IHitArea;
  onActivate: () => void;
};

export function attachReplayHitTarget(target: Container, options: HitTargetOptions) {
  const activateOn = options.activateOn ?? "pointertap";
  target.eventMode = "static";
  target.cursor = options.cursor ?? "pointer";
  target.hitArea = options.hitArea;

  target.on("pointerdown", (event) => {
    markNativeEventHandled(event);
    event.stopPropagation();
    if (activateOn === "pointerdown") {
      options.onActivate();
    }
  });

  target.on("pointertap", (event) => {
    event.stopPropagation();
    if (activateOn === "pointertap") {
      options.onActivate();
    }
  });
}

function markNativeEventHandled(event: FederatedPointerEvent) {
  const nativeEvent = event.nativeEvent as ReplayNativePointerEvent | undefined;
  if (!nativeEvent) {
    return;
  }

  nativeEvent.__drIgnoreStagePan = true;
  nativeEvent.preventDefault();
}
