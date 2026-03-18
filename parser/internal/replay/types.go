package replay

import "time"

const (
	FormatName    = "mastermind.replay"
	SchemaVersion = "1.0.0-draft"
)

type Replay struct {
	Format        string     `json:"format"`
	SchemaVersion string     `json:"schemaVersion"`
	GeneratedAt   time.Time  `json:"generatedAt"`
	Generator     Generator  `json:"generator"`
	SourceDemo    SourceDemo `json:"sourceDemo"`
	Match         Match      `json:"match"`
	Map           Map        `json:"map"`
	Teams         []Team     `json:"teams"`
	Players       []Player   `json:"players"`
	Rounds        []Round    `json:"rounds"`
}

type Generator struct {
	Name    string `json:"name"`
	Version string `json:"version"`
}

type SourceDemo struct {
	FileName     string   `json:"fileName"`
	SHA256       string   `json:"sha256"`
	TickRate     float64  `json:"tickRate"`
	TickCount    int      `json:"tickCount"`
	DemoProtocol *int     `json:"demoProtocol"`
	Notes        []string `json:"notes,omitempty"`
}

type Match struct {
	MatchID     *string `json:"matchId"`
	TickRate    float64 `json:"tickRate"`
	TotalRounds int     `json:"totalRounds"`
	GameMode    *string `json:"gameMode"`
}

type Map struct {
	MapID            string           `json:"mapId"`
	DisplayName      string           `json:"displayName"`
	RadarImageKey    string           `json:"radarImageKey"`
	CoordinateSystem CoordinateSystem `json:"coordinateSystem"`
}

type CoordinateSystem struct {
	WorldXMin     float64 `json:"worldXMin"`
	WorldXMax     float64 `json:"worldXMax"`
	WorldYMin     float64 `json:"worldYMin"`
	WorldYMax     float64 `json:"worldYMax"`
	RotateDegrees float64 `json:"rotateDegrees"`
}

type Team struct {
	TeamID      string  `json:"teamId"`
	DisplayName string  `json:"displayName"`
	ClanName    *string `json:"clanName"`
}

type Player struct {
	PlayerID    string  `json:"playerId"`
	DisplayName string  `json:"displayName"`
	SteamID     *string `json:"steamId"`
	TeamID      string  `json:"teamId"`
}

type Round struct {
	RoundNumber     int             `json:"roundNumber"`
	StartTick       int             `json:"startTick"`
	FreezeEndTick   *int            `json:"freezeEndTick"`
	EndTick         int             `json:"endTick"`
	OfficialEndTick *int            `json:"officialEndTick"`
	ScoreBefore     Score           `json:"scoreBefore"`
	ScoreAfter      Score           `json:"scoreAfter"`
	WinnerSide      *string         `json:"winnerSide"`
	EndReason       *string         `json:"endReason"`
	PlayerStreams   []PlayerStream  `json:"playerStreams"`
	KillEvents      []KillEvent     `json:"killEvents"`
	BombEvents      []BombEvent     `json:"bombEvents"`
	UtilityEntities []UtilityEntity `json:"utilityEntities"`
}

type Score struct {
	T  int `json:"t"`
	CT int `json:"ct"`
}

type PlayerStream struct {
	PlayerID            string     `json:"playerId"`
	Side                *string    `json:"side"`
	SampleOriginTick    int        `json:"sampleOriginTick"`
	SampleIntervalTicks int        `json:"sampleIntervalTicks"`
	X                   []*float64 `json:"x"`
	Y                   []*float64 `json:"y"`
	Z                   []*float64 `json:"z"`
	Yaw                 []*float64 `json:"yaw"`
	Alive               []bool     `json:"alive"`
	HasBomb             []bool     `json:"hasBomb"`
	Health              []*int     `json:"health"`
	Armor               []*int     `json:"armor"`
	HasHelmet           []bool     `json:"hasHelmet"`
	Money               []*int     `json:"money"`
	ActiveWeapon        []*string  `json:"activeWeapon"`
	MainWeapon          []*string  `json:"mainWeapon"`
	Flashbangs          []*int     `json:"flashbangs"`
	Smokes              []*int     `json:"smokes"`
	HEGrenades          []*int     `json:"heGrenades"`
	FireGrenades        []*int     `json:"fireGrenades"`
	Decoys              []*int     `json:"decoys"`
}

type KillEvent struct {
	Tick              int      `json:"tick"`
	KillerPlayerID    *string  `json:"killerPlayerId"`
	VictimPlayerID    string   `json:"victimPlayerId"`
	AssisterPlayerID  *string  `json:"assisterPlayerId"`
	WeaponName        string   `json:"weaponName"`
	IsHeadshot        bool     `json:"isHeadshot"`
	PenetratedObjects *int     `json:"penetratedObjects"`
	ThroughSmoke      *bool    `json:"throughSmoke"`
	KillerX           *float64 `json:"killerX"`
	KillerY           *float64 `json:"killerY"`
	KillerZ           *float64 `json:"killerZ"`
	VictimX           *float64 `json:"victimX"`
	VictimY           *float64 `json:"victimY"`
	VictimZ           *float64 `json:"victimZ"`
}

type BombEvent struct {
	Tick     int      `json:"tick"`
	Type     string   `json:"type"`
	PlayerID *string  `json:"playerId"`
	Site     *string  `json:"site"`
	X        *float64 `json:"x"`
	Y        *float64 `json:"y"`
	Z        *float64 `json:"z"`
}

type UtilityEntity struct {
	UtilityID       string              `json:"utilityId"`
	Kind            string              `json:"kind"`
	ThrowerPlayerID *string             `json:"throwerPlayerId"`
	StartTick       int                 `json:"startTick"`
	DetonateTick    *int                `json:"detonateTick"`
	EndTick         *int                `json:"endTick"`
	Trajectory      Trajectory          `json:"trajectory"`
	PhaseEvents     []UtilityPhaseEvent `json:"phaseEvents"`
}

type Trajectory struct {
	SampleOriginTick    int        `json:"sampleOriginTick"`
	SampleIntervalTicks int        `json:"sampleIntervalTicks"`
	X                   []*float64 `json:"x"`
	Y                   []*float64 `json:"y"`
	Z                   []*float64 `json:"z"`
}

type UtilityPhaseEvent struct {
	Tick int      `json:"tick"`
	Type string   `json:"type"`
	X    *float64 `json:"x"`
	Y    *float64 `json:"y"`
	Z    *float64 `json:"z"`
}

func NewReplay() Replay {
	return Replay{
		Format:        FormatName,
		SchemaVersion: SchemaVersion,
		GeneratedAt:   time.Now().UTC(),
		Generator: Generator{
			Name:    "mastermind-parser",
			Version: "0.1.0",
		},
		Teams:   []Team{},
		Players: []Player{},
		Rounds:  []Round{},
	}
}

func Float64(v float64) *float64 { return &v }

func Int(v int) *int { return &v }

func String(v string) *string { return &v }

func Bool(v bool) *bool { return &v }
