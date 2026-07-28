package maps

import (
	"errors"
	"math"
	"os"
	"path/filepath"
	"testing"
)

func TestCompetitiveMapAssetSet(t *testing.T) {
	assetsRoot := filepath.Join("..", "..", "..", "public", "maps")
	supported := []string{
		"de_ancient", "de_anubis", "de_cache", "de_dust2", "de_inferno",
		"de_mirage", "de_nuke", "de_overpass", "de_train", "de_vertigo",
	}
	for _, mapID := range supported {
		calibration, err := Load(assetsRoot, mapID)
		if err != nil {
			t.Fatalf("load %s calibration: %v", mapID, err)
		}
		assertRadarAssetExists(t, assetsRoot, calibration.RadarImageKey)
		for _, section := range calibration.VerticalSections {
			assertRadarAssetExists(t, assetsRoot, section.RadarImageKey)
		}
	}

	cache, err := Load(assetsRoot, "de_cache")
	if err != nil {
		t.Fatalf("load de_cache calibration: %v", err)
	}

	if cache.MapID != "de_cache" {
		t.Fatalf("map id = %q, want de_cache", cache.MapID)
	}
	if cache.DisplayName != "Cache" {
		t.Fatalf("display name = %q, want Cache", cache.DisplayName)
	}
	if cache.RadarImageKey != "de_cache/radar.png" {
		t.Fatalf("radar image key = %q, want de_cache/radar.png", cache.RadarImageKey)
	}

	cs := cache.CoordinateSystem
	values := []float64{cs.WorldXMin, cs.WorldXMax, cs.WorldYMin, cs.WorldYMax, cs.RotateDegrees}
	for _, value := range values {
		if math.IsNaN(value) || math.IsInf(value, 0) {
			t.Fatalf("coordinate system contains non-finite value: %#v", cs)
		}
	}
	if cs.WorldXMin >= cs.WorldXMax || cs.WorldYMin >= cs.WorldYMax {
		t.Fatalf("coordinate bounds are invalid: %#v", cs)
	}

	retired := []string{"ar_baggage", "ar_shoots", "cs_italy", "cs_office"}
	for _, mapID := range retired {
		if _, err := Load(assetsRoot, mapID); !errors.Is(err, os.ErrNotExist) {
			t.Fatalf("retired map %s load error = %v, want os.ErrNotExist", mapID, err)
		}
	}
}

func TestNukeVerticalSectionsMatchInstalledOverview(t *testing.T) {
	assetsRoot := filepath.Join("..", "..", "..", "public", "maps")
	nuke, err := Load(assetsRoot, "de_nuke")
	if err != nil {
		t.Fatalf("load de_nuke calibration: %v", err)
	}
	if len(nuke.VerticalSections) != 2 {
		t.Fatalf("vertical section count = %d, want 2", len(nuke.VerticalSections))
	}
	if upper, lower := nuke.VerticalSections[0], nuke.VerticalSections[1]; upper.SectionID != "upper" || upper.AltitudeMin != -495 ||
		lower.SectionID != "lower" || lower.AltitudeMax != -495 {
		t.Fatalf("unexpected Nuke vertical sections: %#v", nuke.VerticalSections)
	}
}

func assertRadarAssetExists(t *testing.T, assetsRoot, radarImageKey string) {
	t.Helper()
	if _, err := os.Stat(filepath.Join(assetsRoot, filepath.FromSlash(radarImageKey))); err != nil {
		t.Fatalf("radar asset %q: %v", radarImageKey, err)
	}
}
