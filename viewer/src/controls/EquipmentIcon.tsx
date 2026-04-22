import armorIcon from "../assets/icons/cs2-equipment/panorama/images/icons/equipment/armor.svg";
import defuserIcon from "../assets/icons/cs2-equipment/panorama/images/icons/equipment/defuser.svg";
import helmetIcon from "../assets/icons/cs2-equipment/panorama/images/icons/equipment/helmet.svg";
import kevlarIcon from "../assets/icons/cs2-equipment/panorama/images/icons/equipment/kevlar.svg";

type EquipmentKind = "armor" | "defuser" | "helmet" | "kevlar";

type Props = {
  className?: string;
  kind: EquipmentKind;
  title?: string;
};

export function EquipmentIcon({ className, kind, title }: Props) {
  return <img alt="" aria-hidden="true" className={className} src={iconSrc(kind)} title={title} />;
}

function iconSrc(kind: EquipmentKind) {
  switch (kind) {
    case "armor":
      return armorIcon;
    case "defuser":
      return defuserIcon;
    case "helmet":
      return helmetIcon;
    case "kevlar":
      return kevlarIcon;
  }
}
