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
