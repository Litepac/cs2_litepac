package demo

import (
	demoinfocs "github.com/markus-wa/demoinfocs-golang/v5/pkg/demoinfocs"

	"mastermind/parser/internal/replay"
	"mastermind/parser/internal/rounds"
)

type Options struct {
	DemoPath       string
	SourceFileName string
	OutputPath     string
	SchemaPath     string
	AssetsRoot     string
	ExpectedRounds int
	Progress       func(ParseProgress)
}

type ParseProgress struct {
	RoundsParsed int
	RoundsTotal  int
}

type playerRef struct {
	Player replay.Player
}

type teamRef struct {
	Team replay.Team
}

type parseState struct {
	parser            demoinfocs.Parser
	replay            replay.Replay
	currentRound      *rounds.Builder
	roundList         []replay.Round
	expectedRounds    int
	lastBombCarrierID string
	hasBombCarrier    bool

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
	isScoped          *bool
	zoomLevel         *int
	viewmodelFOV      *float64
	viewmodelOffsetX  *float64
	viewmodelOffsetY  *float64
	viewmodelOffsetZ  *float64
	recoilIndex       *float64
	isWalking         *bool
	isDucking         *bool
	isOnGround        *bool
	flashbangs        *int
	smokes            *int
	heGrenades        *int
	fireGrenades      *int
	decoys            *int
}
