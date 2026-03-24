package demo

import (
	"fmt"
	"strings"

	common "github.com/markus-wa/demoinfocs-golang/v5/pkg/demoinfocs/common"

	"mastermind/parser/internal/replay"
)

func (s *parseState) ensurePlayer(player *common.Player) string {
	if player == nil {
		return ""
	}

	teamID := teamID(player.TeamState)
	if teamID == "" {
		return ""
	}

	if player.TeamState != nil {
		s.ensureTeam(player.TeamState)
	}

	playerID := stablePlayerID(player)
	if _, ok := s.players[playerID]; ok {
		return playerID
	}

	var steamID *string
	if player.SteamID64 > 0 {
		steamID = replay.String(fmt.Sprintf("%d", player.SteamID64))
	}

	s.players[playerID] = playerRef{
		Player: replay.Player{
			PlayerID:    playerID,
			DisplayName: player.Name,
			SteamID:     steamID,
			TeamID:      teamID,
		},
		Index: len(s.players),
	}

	return playerID
}

func (s *parseState) ensureTeam(team *common.TeamState) string {
	if team == nil {
		return ""
	}

	teamID := teamID(team)
	if _, ok := s.teams[teamID]; ok {
		return teamID
	}

	displayName := team.ClanName()
	if displayName == "" {
		displayName = teamID
	}

	s.teams[teamID] = teamRef{
		Team: replay.Team{
			TeamID:      teamID,
			DisplayName: displayName,
			ClanName:    optionalString(team.ClanName()),
		},
		Index: len(s.teams),
	}

	return teamID
}

func stablePlayerID(player *common.Player) string {
	if player == nil {
		return ""
	}

	if player.SteamID64 > 0 {
		return fmt.Sprintf("steam:%d", player.SteamID64)
	}

	name := strings.TrimSpace(strings.ToLower(player.Name))
	name = strings.ReplaceAll(name, " ", "-")
	if name == "" {
		name = "unknown"
	}

	return fmt.Sprintf("player:%s:%d", name, player.UserID)
}

func teamID(team *common.TeamState) string {
	if team == nil {
		return ""
	}

	return fmt.Sprintf("team:%d", team.ID())
}
