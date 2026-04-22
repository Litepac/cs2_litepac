export type StageToolMode = "move" | "draw";

type ReplayDrawingToolbarProps = {
  hasDrawings: boolean;
  mode: StageToolMode;
  onClear: () => void;
  onSelectDraw: () => void;
  onSelectMove: () => void;
};

export function ReplayDrawingToolbar({ hasDrawings, mode, onClear, onSelectDraw, onSelectMove }: ReplayDrawingToolbarProps) {
  return (
    <div className="dr-mapfirst-drawing-toolbar" aria-label="Map drawing tools">
      <button
        aria-label="Moving mode"
        className={mode === "move" ? "dr-mapfirst-tool-button dr-mapfirst-tool-button-active" : "dr-mapfirst-tool-button"}
        onClick={onSelectMove}
        title="Moving mode (M)"
        type="button"
      >
        <HandIcon />
        <kbd>M</kbd>
      </button>
      <button
        aria-label="Drawing mode"
        className={mode === "draw" ? "dr-mapfirst-tool-button dr-mapfirst-tool-button-active" : "dr-mapfirst-tool-button"}
        onClick={onSelectDraw}
        title="Drawing mode (D)"
        type="button"
      >
        <PencilIcon />
        <kbd>D</kbd>
      </button>
      <button
        aria-label="Clear drawing"
        className="dr-mapfirst-tool-button"
        disabled={!hasDrawings}
        onClick={onClear}
        title="Clear drawing (C)"
        type="button"
      >
        <ClearIcon />
        <kbd>C</kbd>
      </button>
    </div>
  );
}

function HandIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path d="M7 11V7.5a1.5 1.5 0 0 1 3 0V11" />
      <path d="M10 11V5.5a1.5 1.5 0 0 1 3 0V11" />
      <path d="M13 11V7a1.5 1.5 0 0 1 3 0v5" />
      <path d="M16 12.5V10a1.5 1.5 0 0 1 3 0v3.5c0 4.5-2.5 7-7 7h-.8c-2.5 0-4.1-1.1-5.4-3.1L3.6 14a1.5 1.5 0 0 1 2.5-1.7L8 15" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path d="m4 16 9.8-9.8 4 4L8 20H4v-4Z" />
      <path d="m12.5 7.5 4 4" />
      <path d="m15 5 1.1-1.1a1.7 1.7 0 0 1 2.4 0l1.6 1.6a1.7 1.7 0 0 1 0 2.4L19 9" />
    </svg>
  );
}

function ClearIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path d="M5 5 19 19" />
      <path d="M19 5 5 19" />
    </svg>
  );
}
