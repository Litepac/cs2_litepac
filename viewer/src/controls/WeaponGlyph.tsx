import { normalizeWeaponName } from "../replay/weapons";
import ak47Icon from "../assets/icons/cs2-equipment/panorama/images/icons/equipment/ak47.svg";
import augIcon from "../assets/icons/cs2-equipment/panorama/images/icons/equipment/aug.svg";
import awpIcon from "../assets/icons/cs2-equipment/panorama/images/icons/equipment/awp.svg";
import bizonIcon from "../assets/icons/cs2-equipment/panorama/images/icons/equipment/bizon.svg";
import c4Icon from "../assets/icons/cs2-equipment/panorama/images/icons/equipment/c4.svg";
import cz75aIcon from "../assets/icons/cs2-equipment/panorama/images/icons/equipment/cz75a.svg";
import deagleIcon from "../assets/icons/cs2-equipment/panorama/images/icons/equipment/deagle.svg";
import decoyIcon from "../assets/icons/cs2-equipment/panorama/images/icons/equipment/decoy.svg";
import eliteIcon from "../assets/icons/cs2-equipment/panorama/images/icons/equipment/elite.svg";
import famasIcon from "../assets/icons/cs2-equipment/panorama/images/icons/equipment/famas.svg";
import fivesevenIcon from "../assets/icons/cs2-equipment/panorama/images/icons/equipment/fiveseven.svg";
import flashbangIcon from "../assets/icons/cs2-equipment/panorama/images/icons/equipment/flashbang.svg";
import g3sg1Icon from "../assets/icons/cs2-equipment/panorama/images/icons/equipment/g3sg1.svg";
import galilarIcon from "../assets/icons/cs2-equipment/panorama/images/icons/equipment/galilar.svg";
import glockIcon from "../assets/icons/cs2-equipment/panorama/images/icons/equipment/glock.svg";
import hegrenadeIcon from "../assets/icons/cs2-equipment/panorama/images/icons/equipment/hegrenade.svg";
import hkp2000Icon from "../assets/icons/cs2-equipment/panorama/images/icons/equipment/hkp2000.svg";
import incgrenadeIcon from "../assets/icons/cs2-equipment/panorama/images/icons/equipment/incgrenade.svg";
import knifeIcon from "../assets/icons/cs2-equipment/panorama/images/icons/equipment/knife.svg";
import m249Icon from "../assets/icons/cs2-equipment/panorama/images/icons/equipment/m249.svg";
import m4a1Icon from "../assets/icons/cs2-equipment/panorama/images/icons/equipment/m4a1.svg";
import m4a1SilencerIcon from "../assets/icons/cs2-equipment/panorama/images/icons/equipment/m4a1_silencer.svg";
import mac10Icon from "../assets/icons/cs2-equipment/panorama/images/icons/equipment/mac10.svg";
import mag7Icon from "../assets/icons/cs2-equipment/panorama/images/icons/equipment/mag7.svg";
import molotovIcon from "../assets/icons/cs2-equipment/panorama/images/icons/equipment/molotov.svg";
import mp5sdIcon from "../assets/icons/cs2-equipment/panorama/images/icons/equipment/mp5sd.svg";
import mp7Icon from "../assets/icons/cs2-equipment/panorama/images/icons/equipment/mp7.svg";
import mp9Icon from "../assets/icons/cs2-equipment/panorama/images/icons/equipment/mp9.svg";
import negevIcon from "../assets/icons/cs2-equipment/panorama/images/icons/equipment/negev.svg";
import novaIcon from "../assets/icons/cs2-equipment/panorama/images/icons/equipment/nova.svg";
import p2000Icon from "../assets/icons/cs2-equipment/panorama/images/icons/equipment/p2000.svg";
import p250Icon from "../assets/icons/cs2-equipment/panorama/images/icons/equipment/p250.svg";
import p90Icon from "../assets/icons/cs2-equipment/panorama/images/icons/equipment/p90.svg";
import revolverIcon from "../assets/icons/cs2-equipment/panorama/images/icons/equipment/revolver.svg";
import sawedoffIcon from "../assets/icons/cs2-equipment/panorama/images/icons/equipment/sawedoff.svg";
import scar20Icon from "../assets/icons/cs2-equipment/panorama/images/icons/equipment/scar20.svg";
import sg556Icon from "../assets/icons/cs2-equipment/panorama/images/icons/equipment/sg556.svg";
import smokegrenadeIcon from "../assets/icons/cs2-equipment/panorama/images/icons/equipment/smokegrenade.svg";
import ssg08Icon from "../assets/icons/cs2-equipment/panorama/images/icons/equipment/ssg08.svg";
import taserIcon from "../assets/icons/cs2-equipment/panorama/images/icons/equipment/taser.svg";
import tec9Icon from "../assets/icons/cs2-equipment/panorama/images/icons/equipment/tec9.svg";
import ump45Icon from "../assets/icons/cs2-equipment/panorama/images/icons/equipment/ump45.svg";
import uspSilencerIcon from "../assets/icons/cs2-equipment/panorama/images/icons/equipment/usp_silencer.svg";
import xm1014Icon from "../assets/icons/cs2-equipment/panorama/images/icons/equipment/xm1014.svg";

type Props = {
  className?: string;
  title?: string;
  weaponName: string | null;
};

export function WeaponGlyph({ className, title, weaponName }: Props) {
  return <img alt="" aria-hidden="true" className={className} src={weaponIconSrc(weaponName)} title={title} />;
}

function weaponIconSrc(weaponName: string | null) {
  const normalized = normalizeWeaponName(weaponName);
  if (!normalized) {
    return m4a1Icon;
  }

  if (
    normalized.includes("knife") ||
    normalized.includes("bayonet") ||
    normalized.includes("karambit") ||
    normalized.includes("dagger")
  ) {
    return knifeIcon;
  }

  const icons: Record<string, string> = {
    ak47: ak47Icon,
    aug: augIcon,
    awp: awpIcon,
    bizon: bizonIcon,
    c4: c4Icon,
    cz75a: cz75aIcon,
    cz75auto: cz75aIcon,
    deagle: deagleIcon,
    decoy: decoyIcon,
    elite: eliteIcon,
    famas: famasIcon,
    fiveseven: fivesevenIcon,
    flashbang: flashbangIcon,
    g3sg1: g3sg1Icon,
    galilar: galilarIcon,
    glock: glockIcon,
    glock18: glockIcon,
    hegrenade: hegrenadeIcon,
    hkp2000: hkp2000Icon,
    incgrenade: incgrenadeIcon,
    incendiarygrenade: incgrenadeIcon,
    m249: m249Icon,
    m4a1: m4a1Icon,
    m4a1s: m4a1SilencerIcon,
    m4a1silencer: m4a1SilencerIcon,
    m4a1silenceroff: m4a1SilencerIcon,
    mac10: mac10Icon,
    mag7: mag7Icon,
    molotov: molotovIcon,
    mp5sd: mp5sdIcon,
    mp7: mp7Icon,
    mp9: mp9Icon,
    negev: negevIcon,
    nova: novaIcon,
    p2000: p2000Icon,
    p250: p250Icon,
    p90: p90Icon,
    revolver: revolverIcon,
    sawedoff: sawedoffIcon,
    scar20: scar20Icon,
    sg556: sg556Icon,
    smokegrenade: smokegrenadeIcon,
    ssg08: ssg08Icon,
    taser: taserIcon,
    tec9: tec9Icon,
    ump45: ump45Icon,
    usp: uspSilencerIcon,
    usps: uspSilencerIcon,
    uspsilencer: uspSilencerIcon,
    xm1014: xm1014Icon,
  };

  return icons[normalized] ?? m4a1Icon;
}
