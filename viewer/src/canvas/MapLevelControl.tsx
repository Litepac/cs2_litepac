import { AUTO_MAP_LEVEL } from "../replay/mapLevels";
import type { Replay } from "../replay/types";
import styles from "./MapLevelControl.module.css";

type MapLevelControlProps = {
  activeSectionId: string | null;
  map: Replay["map"];
  onChange: (sectionId: string) => void;
  value: string;
};

export function MapLevelControl({ activeSectionId, map, onChange, value }: MapLevelControlProps) {
  const sections = map.verticalSections ?? [];
  if (sections.length < 2) {
    return null;
  }

  return (
    <div className={styles.control} aria-label={`${map.displayName} radar layer`}>
      <span className={styles.label}>Radar</span>
      <button
        className={styles.button}
        data-active={value === AUTO_MAP_LEVEL}
        onClick={() => onChange(AUTO_MAP_LEVEL)}
        title="Follow the selected player's parser-backed height"
        type="button"
      >
        Auto{value === AUTO_MAP_LEVEL && activeSectionId ? ` · ${activeSectionId}` : ""}
      </button>
      {sections.map((section) => (
        <button
          className={styles.button}
          data-active={value === section.sectionId}
          key={section.sectionId}
          onClick={() => onChange(section.sectionId)}
          type="button"
        >
          {section.displayName}
        </button>
      ))}
    </div>
  );
}
