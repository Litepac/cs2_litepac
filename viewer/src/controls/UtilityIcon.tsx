import type { UtilityVisualKind } from "../replay/utilityPresentation";
import bombIcon from "../assets/icons/cs2-equipment/panorama/images/icons/equipment/c4.svg";
import decoyIcon from "../assets/icons/cs2-equipment/panorama/images/icons/equipment/decoy.svg";
import flashbangIcon from "../assets/icons/cs2-equipment/panorama/images/icons/equipment/flashbang.svg";
import fireIcon from "../assets/icons/cs2-equipment/panorama/images/icons/equipment/molotov.svg";
import heIcon from "../assets/icons/cs2-equipment/panorama/images/icons/equipment/hegrenade.svg";
import smokeIcon from "../assets/icons/cs2-equipment/panorama/images/icons/equipment/smokegrenade.svg";

type Props = {
  kind: UtilityVisualKind;
  className?: string;
  title?: string;
};

export function UtilityIcon({ kind, className, title }: Props) {
  return <img alt="" aria-hidden={title ? undefined : true} className={className} src={iconSrc(kind)} title={title} />;
}

function iconSrc(kind: UtilityVisualKind) {
  switch (kind) {
    case "flashbang":
      return flashbangIcon;
    case "smoke":
      return smokeIcon;
    case "hegrenade":
      return heIcon;
    case "fire":
    case "molotov":
    case "incendiary":
      return fireIcon;
    case "decoy":
      return decoyIcon;
    case "bomb":
      return bombIcon;
    default:
      return fireIcon;
  }
}
