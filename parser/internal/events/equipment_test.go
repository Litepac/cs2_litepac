package events

import (
	"testing"

	common "github.com/markus-wa/demoinfocs-golang/v5/pkg/demoinfocs/common"
)

func TestActiveWeaponClass(t *testing.T) {
	tests := []struct {
		expected string
		name     string
		weapon   common.EquipmentType
	}{
		{name: "knife", weapon: common.EqKnife, expected: "knife"},
		{name: "grenade", weapon: common.EqHE, expected: "utility"},
		{name: "pistol", weapon: common.EqUSP, expected: "pistol"},
		{name: "smg", weapon: common.EqMP9, expected: "smg"},
		{name: "heavy", weapon: common.EqNova, expected: "heavy"},
		{name: "rifle", weapon: common.EqAK47, expected: "rifle"},
		{name: "sniper", weapon: common.EqAWP, expected: "sniper"},
		{name: "equipment", weapon: common.EqBomb, expected: "equipment"},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			weapon := common.NewEquipment(test.weapon)
			if got := ActiveWeaponClass(weapon); got == nil || *got != test.expected {
				t.Fatalf("ActiveWeaponClass(%v) = %v, want %q", test.weapon, derefString(got), test.expected)
			}
		})
	}
}

func TestActiveUtilityKind(t *testing.T) {
	tests := []struct {
		expected *string
		name     string
		weapon   common.EquipmentType
	}{
		{name: "smoke", weapon: common.EqSmoke, expected: stringRef("smoke")},
		{name: "flash", weapon: common.EqFlash, expected: stringRef("flashbang")},
		{name: "he", weapon: common.EqHE, expected: stringRef("hegrenade")},
		{name: "molotov", weapon: common.EqMolotov, expected: stringRef("molotov")},
		{name: "incendiary", weapon: common.EqIncendiary, expected: stringRef("incendiary")},
		{name: "decoy", weapon: common.EqDecoy, expected: stringRef("decoy")},
		{name: "rifle", weapon: common.EqAK47, expected: nil},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			weapon := common.NewEquipment(test.weapon)
			got := ActiveUtilityKind(weapon)
			if derefString(got) != derefString(test.expected) {
				t.Fatalf("ActiveUtilityKind(%v) = %v, want %v", test.weapon, derefString(got), derefString(test.expected))
			}
		})
	}
}

func stringRef(value string) *string {
	return &value
}

func derefString(value *string) string {
	if value == nil {
		return ""
	}

	return *value
}
