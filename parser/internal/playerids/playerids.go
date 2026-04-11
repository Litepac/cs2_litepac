package playerids

import (
	"fmt"
	"strings"

	common "github.com/markus-wa/demoinfocs-golang/v5/pkg/demoinfocs/common"
)

func Stable(player *common.Player) string {
	if player == nil {
		return ""
	}

	return StableFromParts(player.SteamID64, player.Name, player.UserID)
}

func StableFromParts(steamID64 uint64, displayName string, userID int) string {
	if steamID64 > 0 {
		return fmt.Sprintf("steam:%d", steamID64)
	}

	name := NormalizeDisplayName(displayName)
	if name == "" {
		name = "unknown"
	}

	return fmt.Sprintf("player:%s:%d", name, userID)
}

func NormalizeDisplayName(displayName string) string {
	name := strings.TrimSpace(strings.ToLower(displayName))
	return strings.ReplaceAll(name, " ", "-")
}
