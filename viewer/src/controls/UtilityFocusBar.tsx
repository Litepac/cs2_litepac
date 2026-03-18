import type { UtilityFocus } from "../replay/utilityFilter";

type Props = {
  focus: UtilityFocus;
  onChange: (focus: UtilityFocus) => void;
};

const OPTIONS: Array<{ label: string; value: UtilityFocus }> = [
  { label: "Smoke", value: "smoke" },
  { label: "Flash", value: "flashbang" },
  { label: "HE", value: "hegrenade" },
  { label: "Fire", value: "fire" },
  { label: "Decoy", value: "decoy" },
  { label: "All", value: "all" },
];

export function UtilityFocusBar({ focus, onChange }: Props) {
  return (
    <section className="utility-focus-bar">
      <div className="utility-focus-copy">
        <div className="eyebrow">Utility</div>
      </div>
      <div className="utility-focus-actions">
        {OPTIONS.map((option) => (
          <button
            key={option.value}
            className={option.value === focus ? "control-button control-button-active" : "control-button"}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </section>
  );
}
