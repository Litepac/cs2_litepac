package demo

import (
	"fmt"
	"os"
	"path/filepath"

	demoinfocs "github.com/markus-wa/demoinfocs-golang/v5/pkg/demoinfocs"

	"mastermind/parser/internal/maps"
	"mastermind/parser/internal/replay"
	"mastermind/parser/internal/validate"
)

func Parse(opts Options) error {
	if opts.DemoPath == "" {
		return fmt.Errorf("demo path is required")
	}

	assetsRoot, err := maps.ResolveAssetsRoot(opts.AssetsRoot)
	if err != nil {
		return err
	}

	schemaPath, err := validate.SchemaPath(opts.SchemaPath)
	if err != nil {
		return err
	}

	fingerprint, err := fileSHA256(opts.DemoPath)
	if err != nil {
		return err
	}

	file, err := os.Open(opts.DemoPath)
	if err != nil {
		return fmt.Errorf("open demo: %w", err)
	}
	defer file.Close()

	parser := demoinfocs.NewParser(file)
	defer parser.Close()

	state := &parseState{
		parser:   parser,
		replay:   replay.NewReplay(),
		notes:    []string{},
		players:  map[string]playerRef{},
		teams:    map[string]teamRef{},
		progress: opts.Progress,
	}

	state.replay.SourceDemo = replay.SourceDemo{
		FileName:     filepath.Base(opts.DemoPath),
		SHA256:       fingerprint,
		TickRate:     0,
		TickCount:    0,
		DemoProtocol: nil,
		Notes:        []string{},
	}

	state.registerHandlers()

	if err := parser.ParseToEnd(); err != nil {
		return fmt.Errorf("parse demo: %w", err)
	}

	state.finalizeOpenRound(parser.CurrentFrame())
	state.replay.SourceDemo.TickRate = parser.TickRate()
	state.replay.SourceDemo.TickCount = parser.CurrentFrame()
	bombTimeSeconds, bombTimeNote := resolveBombTimeSeconds(parser.GameState(), state.roundList, parser.TickRate())
	if bombTimeNote != "" {
		state.notes = append(state.notes, bombTimeNote)
	}
	state.replay.Match = replay.Match{
		MatchID:           nil,
		TickRate:          parser.TickRate(),
		TotalRounds:       len(state.roundList),
		GameMode:          nil,
		RoundTimeSeconds:  roundTimeSeconds(parser.GameState()),
		FreezeTimeSeconds: freezeTimeSeconds(parser.GameState()),
		BombTimeSeconds:   bombTimeSeconds,
	}

	if state.mapID == "" {
		return fmt.Errorf("demo parse did not yield a map id")
	}

	calibration, err := maps.Load(assetsRoot, state.mapID)
	if err != nil {
		return err
	}

	state.replay.Map = replay.Map{
		MapID:            calibration.MapID,
		DisplayName:      calibration.DisplayName,
		RadarImageKey:    calibration.RadarImageKey,
		CoordinateSystem: calibration.CoordinateSystem,
	}
	state.replay.Teams = orderedTeams(state.teams)
	state.replay.Players = orderedPlayers(state.players)
	state.notes = append(state.notes, syntheticPlayerIDWarnings(state.replay.Players)...)
	state.replay.SourceDemo.Notes = dedupe(state.notes)
	state.replay.Rounds = state.roundList

	if err := validate.ValidateReplay(state.replay); err != nil {
		return err
	}

	if err := validate.ValidateSchema(schemaPath, state.replay); err != nil {
		return err
	}

	if opts.OutputPath == "" {
		opts.OutputPath = filepath.Join(filepath.Dir(opts.DemoPath), "mastermind.replay.json")
	}

	return writeReplay(opts.OutputPath, state.replay)
}

func (s *parseState) registerHandlers() {
	s.registerMetadataHandlers()
	s.registerRoundHandlers()
	s.registerCombatHandlers()
	s.registerBombHandlers()
	s.registerUtilityHandlers()
	s.registerFrameSamplingHandlers()
}
