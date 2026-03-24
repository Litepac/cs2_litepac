package demo

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"math"
	"os"
	"path/filepath"
	"sort"
	"strings"

	demoinfocs "github.com/markus-wa/demoinfocs-golang/v5/pkg/demoinfocs"

	"mastermind/parser/internal/replay"
)

func nilIfEmpty(v string) *string {
	if v == "" {
		return nil
	}

	return replay.String(v)
}

func optionalString(v string) *string {
	if strings.TrimSpace(v) == "" {
		return nil
	}

	return replay.String(v)
}

func fileSHA256(path string) (string, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return "", fmt.Errorf("read demo for hashing: %w", err)
	}

	sum := sha256.Sum256(raw)
	return hex.EncodeToString(sum[:]), nil
}

func bombTimeSeconds(gs demoinfocs.GameState) *float64 {
	seconds, err := gs.Rules().BombTime()
	if err != nil {
		return nil
	}

	value := seconds.Seconds()
	return &value
}

func inferBombTimeSeconds(rounds []replay.Round, tickRate float64) *float64 {
	if tickRate <= 0 {
		return nil
	}

	observedSeconds := make([]float64, 0, len(rounds))
	for _, round := range rounds {
		plantedTick := 0
		explodedTick := 0
		hasPlanted := false
		hasExploded := false
		for index := range round.BombEvents {
			event := round.BombEvents[index]
			if event.Type == "planted" {
				plantedTick = event.Tick
				hasPlanted = true
			}
			if event.Type == "exploded" {
				explodedTick = event.Tick
				hasExploded = true
				break
			}
		}

		if !hasPlanted || !hasExploded || explodedTick <= plantedTick {
			continue
		}

		seconds := float64(explodedTick-plantedTick) / tickRate
		if seconds > 0 {
			observedSeconds = append(observedSeconds, seconds)
		}
	}

	if len(observedSeconds) == 0 {
		return nil
	}

	sort.Float64s(observedSeconds)
	median := observedSeconds[len(observedSeconds)/2]
	rounded := math.Round(median*10) / 10
	return &rounded
}

func writeReplay(path string, data replay.Replay) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return fmt.Errorf("create replay output directory: %w", err)
	}

	raw, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("marshal replay: %w", err)
	}

	raw = append(raw, '\n')
	if err := os.WriteFile(path, raw, 0o644); err != nil {
		return fmt.Errorf("write replay: %w", err)
	}

	return nil
}

func orderedPlayers(entries map[string]playerRef) []replay.Player {
	keys := make([]string, 0, len(entries))
	for key := range entries {
		keys = append(keys, key)
	}
	sort.Slice(keys, func(i, j int) bool { return entries[keys[i]].Index < entries[keys[j]].Index })

	out := make([]replay.Player, 0, len(entries))
	for _, key := range keys {
		out = append(out, entries[key].Player)
	}

	return out
}

func orderedTeams(entries map[string]teamRef) []replay.Team {
	keys := make([]string, 0, len(entries))
	for key := range entries {
		keys = append(keys, key)
	}
	sort.Slice(keys, func(i, j int) bool { return entries[keys[i]].Index < entries[keys[j]].Index })

	out := make([]replay.Team, 0, len(entries))
	for _, key := range keys {
		out = append(out, entries[key].Team)
	}

	return out
}

func dedupe(items []string) []string {
	seen := map[string]struct{}{}
	out := make([]string, 0, len(items))
	for _, item := range items {
		item = strings.TrimSpace(item)
		if item == "" {
			continue
		}
		if _, ok := seen[item]; ok {
			continue
		}
		seen[item] = struct{}{}
		out = append(out, item)
	}

	return out
}
