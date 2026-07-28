package maps

import (
	"encoding/json"
	"fmt"
	"math"
	"os"
	"path/filepath"

	"mastermind/parser/internal/replay"
)

const calibrationFileName = "calibration.json"

type Calibration struct {
	MapID            string                   `json:"mapId"`
	DisplayName      string                   `json:"displayName"`
	RadarImageKey    string                   `json:"radarImageKey"`
	VerticalSections []replay.VerticalSection `json:"verticalSections,omitempty"`
	CoordinateSystem replay.CoordinateSystem  `json:"coordinateSystem"`
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
	if err := validateVerticalSections(path, cfg); err != nil {
		return Calibration{}, err
	}

	return cfg, nil
}

func validateVerticalSections(path string, cfg Calibration) error {
	seen := make(map[string]struct{}, len(cfg.VerticalSections))
	for _, section := range cfg.VerticalSections {
		if section.SectionID == "" || section.DisplayName == "" || section.RadarImageKey == "" {
			return fmt.Errorf("map calibration %q has an incomplete vertical section", path)
		}
		if math.IsNaN(section.AltitudeMin) || math.IsInf(section.AltitudeMin, 0) ||
			math.IsNaN(section.AltitudeMax) || math.IsInf(section.AltitudeMax, 0) ||
			section.AltitudeMin >= section.AltitudeMax {
			return fmt.Errorf("map calibration %q has invalid altitude bounds for section %q", path, section.SectionID)
		}
		if _, exists := seen[section.SectionID]; exists {
			return fmt.Errorf("map calibration %q repeats vertical section %q", path, section.SectionID)
		}
		seen[section.SectionID] = struct{}{}
	}
	return nil
}

func ResolveAssetsRoot(explicit string) (string, error) {
	if explicit != "" {
		return explicit, nil
	}

	candidates := []string{
		filepath.Join("public", "maps"),
		filepath.Join("..", "public", "maps"),
		filepath.Join("..", "..", "public", "maps"),
	}

	for _, candidate := range candidates {
		if info, err := os.Stat(candidate); err == nil && info.IsDir() {
			return candidate, nil
		}
	}

	return "", fmt.Errorf("could not locate public/maps directory")
}
