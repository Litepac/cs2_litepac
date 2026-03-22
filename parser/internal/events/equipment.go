package events

import (
	common "github.com/markus-wa/demoinfocs-golang/v5/pkg/demoinfocs/common"

	"mastermind/parser/internal/replay"
)

func ActiveWeaponClass(active *common.Equipment) *string {
	if active == nil {
		return nil
	}

	switch active.Type {
	case common.EqKnife:
		return replay.String("knife")
	case common.EqAWP, common.EqSSG08, common.EqScar20, common.EqG3SG1:
		return replay.String("sniper")
	}

	if _, ok := UtilityKind(active.Type); ok {
		return replay.String("utility")
	}

	switch active.Class() {
	case common.EqClassPistols:
		return replay.String("pistol")
	case common.EqClassSMG:
		return replay.String("smg")
	case common.EqClassHeavy:
		return replay.String("heavy")
	case common.EqClassRifle:
		return replay.String("rifle")
	case common.EqClassEquipment:
		return replay.String("equipment")
	default:
		return replay.String("unknown")
	}
}

func ActiveUtilityKind(active *common.Equipment) *string {
	if active == nil {
		return nil
	}

	kind, ok := UtilityKind(active.Type)
	if !ok {
		return nil
	}

	return replay.String(kind)
}

func MainWeaponName(weapons []*common.Equipment, active *common.Equipment) *string {
	if active != nil && weaponPriority(active.Type) > 0 {
		name := WeaponName(active)
		if name != "" && name != "unknown" {
			return replay.String(name)
		}
	}

	bestPriority := 0
	bestName := ""
	for _, weapon := range weapons {
		if weapon == nil {
			continue
		}

		priority := weaponPriority(weapon.Type)
		if priority <= bestPriority {
			continue
		}

		name := WeaponName(weapon)
		if name == "" || name == "unknown" {
			continue
		}

		bestPriority = priority
		bestName = name
	}

	if bestName != "" {
		return replay.String(bestName)
	}

	if active == nil {
		return nil
	}

	name := WeaponName(active)
	if name == "" || name == "unknown" {
		return nil
	}

	return replay.String(name)
}

func UtilityInventoryCounts(weapons []*common.Equipment) (*int, *int, *int, *int, *int) {
	flashbangs := 0
	smokes := 0
	heGrenades := 0
	fireGrenades := 0
	decoys := 0

	for _, weapon := range weapons {
		if weapon == nil {
			continue
		}

		count := utilityCount(weapon)
		if count <= 0 {
			continue
		}

		switch weapon.Type {
		case common.EqFlash:
			flashbangs += count
		case common.EqSmoke:
			smokes += count
		case common.EqHE:
			heGrenades += count
		case common.EqMolotov, common.EqIncendiary:
			fireGrenades += count
		case common.EqDecoy:
			decoys += count
		}
	}

	return replay.Int(flashbangs), replay.Int(smokes), replay.Int(heGrenades), replay.Int(fireGrenades), replay.Int(decoys)
}

func utilityCount(weapon *common.Equipment) int {
	if weapon == nil || weapon.Class() != common.EqClassGrenade {
		return 0
	}

	count := weapon.AmmoInMagazine() + weapon.AmmoReserve()
	if count < 1 {
		return 1
	}

	return count
}

func weaponPriority(eq common.EquipmentType) int {
	switch eq.Class() {
	case common.EqClassRifle:
		return 40
	case common.EqClassSMG:
		return 30
	case common.EqClassHeavy:
		return 20
	case common.EqClassPistols:
		return 10
	default:
		return 0
	}
}
