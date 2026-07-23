import styles from "./ReplayViewModeToggle.module.css";

export type ReplayViewMode = "2d" | "3d";

type ReplayViewModeToggleProps = {
  mode: ReplayViewMode;
  onChange: (mode: ReplayViewMode) => void;
};

export function ReplayViewModeToggle({ mode, onChange }: ReplayViewModeToggleProps) {
  return (
    <div className={styles.toggle} aria-label="Replay view mode">
      <button
        className={mode === "2d" ? `${styles.button} ${styles.active}` : styles.button}
        type="button"
        aria-pressed={mode === "2d"}
        onClick={() => onChange("2d")}
      >
        2D
      </button>
      <button
        className={mode === "3d" ? `${styles.button} ${styles.active}` : styles.button}
        type="button"
        aria-pressed={mode === "3d"}
        onClick={() => onChange("3d")}
      >
        3D
      </button>
    </div>
  );
}
