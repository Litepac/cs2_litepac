import { useCallback, useEffect, useState, type PointerEvent as ReactPointerEvent } from "react";

import type { StageToolMode } from "./ReplayDrawingToolbar";

type DrawingPoint = {
  x: number;
  y: number;
};

export type DrawingStroke = {
  id: number;
  points: DrawingPoint[];
};

type UseReplayDrawingInput = {
  activeRoundIndex: number;
  replayId: string;
};

export function useReplayDrawing({ activeRoundIndex, replayId }: UseReplayDrawingInput) {
  const [stageToolMode, setStageToolMode] = useState<StageToolMode>("move");
  const [drawingStrokes, setDrawingStrokes] = useState<DrawingStroke[]>([]);
  const [activeDrawingId, setActiveDrawingId] = useState<number | null>(null);

  useEffect(() => {
    setStageToolMode("move");
    setDrawingStrokes([]);
    setActiveDrawingId(null);
  }, [activeRoundIndex, replayId]);

  const clearDrawings = useCallback(() => {
    setDrawingStrokes([]);
    setActiveDrawingId(null);
  }, []);

  const startDrawing = useCallback((event: ReactPointerEvent<SVGSVGElement>) => {
    if (stageToolMode !== "draw") {
      return;
    }

    event.preventDefault();
    const point = pointerEventToDrawingPoint(event);
    const id = Date.now();
    event.currentTarget.setPointerCapture(event.pointerId);
    setActiveDrawingId(id);
    setDrawingStrokes((strokes) => [...strokes, { id, points: [point] }]);
  }, [stageToolMode]);

  const continueDrawing = useCallback((event: ReactPointerEvent<SVGSVGElement>) => {
    if (stageToolMode !== "draw" || activeDrawingId == null) {
      return;
    }

    event.preventDefault();
    const point = pointerEventToDrawingPoint(event);
    setDrawingStrokes((strokes) =>
      strokes.map((stroke) => {
        if (stroke.id !== activeDrawingId) {
          return stroke;
        }

        const previous = stroke.points[stroke.points.length - 1];
        if (previous && Math.hypot(previous.x - point.x, previous.y - point.y) < 0.15) {
          return stroke;
        }

        return { ...stroke, points: [...stroke.points, point] };
      }),
    );
  }, [activeDrawingId, stageToolMode]);

  const stopDrawing = useCallback((event: ReactPointerEvent<SVGSVGElement>) => {
    if (activeDrawingId == null) {
      return;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setActiveDrawingId(null);
  }, [activeDrawingId]);

  return {
    clearDrawings,
    continueDrawing,
    drawingStrokes,
    setStageToolMode,
    stageToolMode,
    startDrawing,
    stopDrawing,
  };
}

function pointerEventToDrawingPoint(event: ReactPointerEvent<SVGSVGElement>) {
  const bounds = event.currentTarget.getBoundingClientRect();
  return {
    x: ((event.clientX - bounds.left) / Math.max(1, bounds.width)) * 100,
    y: ((event.clientY - bounds.top) / Math.max(1, bounds.height)) * 100,
  };
}
