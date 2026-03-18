package events

import (
	"fmt"
	"strings"

	common "github.com/markus-wa/demoinfocs-golang/v5/pkg/demoinfocs/common"
	demoevents "github.com/markus-wa/demoinfocs-golang/v5/pkg/demoinfocs/events"

	"mastermind/parser/internal/replay"
)

func SideFromTeam(team common.Team) *string {
	switch team {
	case common.TeamTerrorists:
		return replay.String("T")
	case common.TeamCounterTerrorists:
		return replay.String("CT")
	default:
		return nil
	}
}

func RoundEndReason(reason demoevents.RoundEndReason) *string {
	switch reason {
	case demoevents.RoundEndReasonTargetBombed:
		return replay.String("target_bombed")
	case demoevents.RoundEndReasonBombDefused:
		return replay.String("bomb_defused")
	case demoevents.RoundEndReasonCTWin:
		return replay.String("ct_win")
	case demoevents.RoundEndReasonTerroristsWin:
		return replay.String("t_win")
	case demoevents.RoundEndReasonDraw:
		return replay.String("draw")
	case demoevents.RoundEndReasonTargetSaved:
		return replay.String("target_saved")
	case demoevents.RoundEndReasonTerroristsPlanted:
		return replay.String("terrorists_planted")
	case demoevents.RoundEndReasonCTSurrender:
		return replay.String("ct_surrender")
	case demoevents.RoundEndReasonTerroristsSurrender:
		return replay.String("t_surrender")
	default:
		return replay.String(strings.ToLower(fmt.Sprintf("reason_%d", reason)))
	}
}

func WeaponName(weapon *common.Equipment) string {
	if weapon == nil {
		return "unknown"
	}

	return weapon.String()
}

func UtilityKind(eq common.EquipmentType) (string, bool) {
	switch eq {
	case common.EqSmoke:
		return "smoke", true
	case common.EqFlash:
		return "flashbang", true
	case common.EqHE:
		return "hegrenade", true
	case common.EqMolotov:
		return "molotov", true
	case common.EqIncendiary:
		return "incendiary", true
	case common.EqDecoy:
		return "decoy", true
	default:
		return "", false
	}
}

func BombSite(site demoevents.Bombsite) *string {
	switch site {
	case demoevents.BombsiteA:
		return replay.String("A")
	case demoevents.BombsiteB:
		return replay.String("B")
	default:
		return nil
	}
}
