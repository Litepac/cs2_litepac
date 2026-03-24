package demo

import (
	demoinfocs "github.com/markus-wa/demoinfocs-golang/v5/pkg/demoinfocs"

	"mastermind/parser/internal/replay"
	"mastermind/parser/internal/rounds"
)

type Options struct {
	DemoPath   string
	OutputPath string
	SchemaPath string
	AssetsRoot string
	Progress   func(ParseProgress)
}

type ParseProgress struct {
	RoundsParsed int
}

type playerRef struct {
	Player replay.Player
	Index  int
}

type teamRef struct {
	Team  replay.Team
	Index int
}

type parseState struct {
	parser       demoinfocs.Parser
	replay       replay.Replay
	currentRound *rounds.Builder
	roundList    []replay.Round
	roundCount   int

	mapID string
	notes []string

	players map[string]playerRef
	teams   map[string]teamRef

	progress func(ParseProgress)
}

type samplePosition struct {
	x *float64
	y *float64
	z *float64
}

type livePlayerState struct {
	health            *int
	armor             *int
	hasHelmet         bool
	money             *int
	activeWeapon      *string
	activeWeaponClass *string
	mainWeapon        *string
	flashbangs        *int
	smokes            *int
	heGrenades        *int
	fireGrenades      *int
	decoys            *int
}
