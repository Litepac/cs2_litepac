package server

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestProCatalogNormalizesOnlyImportMetadata(t *testing.T) {
	provider := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if got := r.URL.Query().Get("dataset"); got != proMatchDatasetID {
			t.Fatalf("dataset = %q", got)
		}
		io.WriteString(w, `{
			"rows":[{"row":{
				"row_id":"2393397-m1",
				"file_name":"demos/shard/2393397/map.dem",
				"match_id":"2393397",
				"match_url":"https://www.hltv.org/matches/2393397/example",
				"event":"Example Cup",
				"team1":"Alpha",
				"team2":"Bravo",
				"score1":2,
				"score2":1,
				"format":"bo3",
				"stars":3,
				"match_date":"2026-04-19T10:54:25Z",
				"map_index":1,
				"map_name":"de_mirage",
				"patch_version":"14141",
				"rounds_played":20,
				"demo_bytes":123456,
				"kills":[{"attacker_name":"must-not-leak"}]
			}}],
			"num_rows_total":1988
		}`)
	}))
	defer provider.Close()

	request := httptest.NewRequest(http.MethodGet, "/api/pro-matches/catalog?offset=0&length=12", nil)
	response := httptest.NewRecorder()
	newHandler(Options{ProCatalogURL: provider.URL}).ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("status = %d: %s", response.Code, response.Body.String())
	}
	var payload proCatalogResponse
	if err := json.Unmarshal(response.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if payload.Total != 1988 || len(payload.Entries) != 1 {
		t.Fatalf("unexpected catalogue: %+v", payload)
	}
	if payload.NextOffset != 1 {
		t.Fatalf("next offset = %d", payload.NextOffset)
	}
	entry := payload.Entries[0]
	if entry.RowID != "2393397-m1" || entry.Event != "Example Cup" || entry.DemoBytes != 123456 {
		t.Fatalf("unexpected entry: %+v", entry)
	}
	if strings.Contains(response.Body.String(), "must-not-leak") || strings.Contains(response.Body.String(), "kills") {
		t.Fatal("provider analysis data must not cross the catalogue boundary")
	}
	if payload.License != proMatchDatasetLicense || payload.AttributionURL != proMatchDatasetURL {
		t.Fatalf("missing attribution: %+v", payload)
	}
}

func TestProCatalogDropsUnsafeDemoPaths(t *testing.T) {
	row := proCatalogUpstreamRow{
		DemoBytes: 1,
		Event:     "Example",
		FileName:  "../secret.dem",
		RowID:     "row",
		Team1:     "Alpha",
		Team2:     "Bravo",
	}
	if _, ok := normalizeProCatalogRow(row); ok {
		t.Fatal("expected unsafe provider path to be rejected")
	}
}

func TestProviderDemoPathIsStrictlyBounded(t *testing.T) {
	for _, valid := range []string{
		"demos/shard/123/map.dem",
		"demos/shard-name/map.DEM",
	} {
		if !validProviderDemoPath(valid) {
			t.Fatalf("expected %q to be valid", valid)
		}
	}
	for _, invalid := range []string{
		"https://example.test/demo.dem",
		"demos/../secret.dem",
		"demos\\secret.dem",
		"analysis/map.json",
		"demos/map.dem?other=true",
	} {
		if validProviderDemoPath(invalid) {
			t.Fatalf("expected %q to be invalid", invalid)
		}
	}
}

func TestProviderDemoURLOnlyEscapesPathSegments(t *testing.T) {
	got := providerDemoURL(
		Options{ProDemoBaseURL: "https://provider.test/base/"},
		"demos/a folder/map.dem",
	)
	if got != "https://provider.test/base/demos/a%20folder/map.dem" {
		t.Fatalf("provider URL = %q", got)
	}
}

func TestProviderDemoLimitIsIndependentFromBrowserUpload(t *testing.T) {
	if maxProviderDemoBytes(Options{}) != defaultMaxProviderDemoSize {
		t.Fatal("unexpected default provider demo limit")
	}
	if maxUploadBytes(Options{}) == maxProviderDemoBytes(Options{}) {
		t.Fatal("provider fetches must not weaken the browser upload limit")
	}
}
