export type UtilityKind = "decoy" | "flashbang" | "hegrenade" | "incendiary" | "molotov" | "smoke";
export type WeaponClass =
  | "equipment"
  | "heavy"
  | "knife"
  | "pistol"
  | "rifle"
  | "smg"
  | "sniper"
  | "unknown"
  | "utility";
export type PlayerTokenMode = "utility" | "knife" | "pistol_smg" | "rifle" | "awp";

type ResolveEquipmentStateArgs = {
  activeWeapon: string | null;
  activeWeaponClass: WeaponClass | null;
  mainWeapon: string | null;
  recentUtilityThrow?: boolean;
};

export function resolvePlayerEquipmentState({
  activeWeapon,
  activeWeaponClass,
  mainWeapon,
  recentUtilityThrow = false,
}: ResolveEquipmentStateArgs) {
  const activeUtilityKind = utilityKindFromWeaponName(activeWeapon);
  const currentWeapon = activeWeapon ?? mainWeapon;
  const primaryWeapon = mainWeapon ?? activeWeapon;
  const displayWeapon = activeWeaponClass === "utility" ? mainWeapon ?? activeWeapon : currentWeapon;

  let tokenMode: PlayerTokenMode;
  if (recentUtilityThrow || activeWeaponClass === "utility") {
    tokenMode = "utility";
  } else if (activeWeaponClass === "knife") {
    tokenMode = "knife";
  } else if (activeWeaponClass === "sniper") {
    tokenMode = "awp";
  } else if (activeWeaponClass === "pistol" || activeWeaponClass === "smg") {
    tokenMode = "pistol_smg";
  } else {
    tokenMode = "rifle";
  }

  return {
    activeUtilityKind,
    currentWeapon,
    primaryWeapon,
    displayWeapon,
    tokenMode,
  };
}

export function utilityKindFromWeaponName(weaponName: string | null): UtilityKind | null {
  const normalized = normalizeWeaponName(weaponName);
  if (!normalized) {
    return null;
  }

  switch (normalized) {
    case "flashbang":
      return "flashbang";
    case "smokegrenade":
      return "smoke";
    case "hegrenade":
      return "hegrenade";
    case "molotov":
      return "molotov";
    case "incgrenade":
    case "incendiarygrenade":
      return "incendiary";
    case "decoy":
      return "decoy";
    default:
      return null;
  }
}

export function normalizeWeaponName(weaponName: string | null) {
  if (!weaponName) {
    return null;
  }

  return weaponName
    .replace(/^weapon_/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export function formatWeaponLabel(weaponName: string | null) {
  if (!weaponName) {
    return "--";
  }

  const normalized = weaponName
    .replace(/^weapon_/i, "")
    .replaceAll("_", " ")
    .trim()
    .toUpperCase();

  const aliases: Record<string, string> = {
    "M4A1 SILENCER": "M4A1-S",
    "USP SILENCER": "USP-S",
    "USP S": "USP-S",
    "GLOCK": "GLOCK-18",
    "HE GRENADE": "HE GRENADE",
    "SMOKE GRENADE": "SMOKE GRENADE",
    "FLASHBANG": "FLASHBANG",
    "MAG 7": "MAG-7",
    "MP9": "MP9",
    "MP7": "MP7",
    "AK47": "AK-47",
    "GALIL AR": "GALIL AR",
    "FAMAS": "FAMAS",
    "MAC10": "MAC-10",
    "P250": "P250",
    "DEAGLE": "DEAGLE",
    "AWP": "AWP",
    "FIVESEVEN": "FIVE-SEVEN",
    "SSG 08": "SSG 08",
  };

  return aliases[normalized] ?? normalized;
}
