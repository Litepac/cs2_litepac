package maps

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"mastermind/parser/internal/replay"
)

const calibrationFileName = "calibration.json"

type Calibration struct {
	MapID            string                  `json:"mapId"`
	DisplayName      string                  `json:"displayName"`
	RadarImageKey    string                  `json:"radarImageKey"`
	CoordinateSystem replay.CoordinateSystem `json:"coordinateSystem"`
}

func Load(assetsRoot, mapID string) (Calibration, error) {
	path := filepath.Join(assetsRoot, mapID, calibrationFileName)
	raw, err := os.ReadFile(path)
	if err != nil {
		return Calibration{}, fmt.Errorf("read map calibration %q: %w", path, err)
	}

	var cfg Calibration
	if err := json.Unmarshal(raw, &cfg); err != nil {
		return Calibration{}, fmt.Errorf("decode map calibration %q: %w", path, err)
	}

	if cfg.MapID == "" {
		cfg.MapID = mapID
	}

	return cfg, nil
}

func ResolveAssetsRoot(explicit string) (string, error) {
	if explicit != "" {
		return explicit, nil
	}

	candidates := []string{
		filepath.Join("assets", "maps"),
		filepath.Join("..", "assets", "maps"),
		filepath.Join("..", "..", "assets", "maps"),
	}

	for _, candidate := range candidates {
		if info, err := os.Stat(candidate); err == nil && info.IsDir() {
			return candidate, nil
		}
	}

	return "", fmt.Errorf("could not locate assets/maps directory")
}
