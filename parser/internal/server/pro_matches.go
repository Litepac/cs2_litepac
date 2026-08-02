package server

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path"
	"strconv"
	"strings"
	"time"
)

const (
	proMatchDatasetID          = "blanchon/cs2_dataset_demo"
	proMatchDatasetLicense     = "CC BY 4.0"
	proMatchDatasetURL         = "https://huggingface.co/datasets/blanchon/cs2_dataset_demo"
	defaultProCatalogURL       = "https://datasets-server.huggingface.co/rows"
	defaultProDemoBaseURL      = "https://huggingface.co/datasets/blanchon/cs2_dataset_demo/resolve/main/"
	defaultProCatalogPageSize  = 12
	maximumProCatalogPageSize  = 25
	maximumProCatalogBytes     = 32 << 20
	defaultMaxProviderDemoSize = int64(1536 << 20)
)

type proCatalogUpstream struct {
	Rows []struct {
		Row proCatalogUpstreamRow `json:"row"`
	} `json:"rows"`
	Total int `json:"num_rows_total"`
}

type proCatalogUpstreamRow struct {
	DemoBytes int64  `json:"demo_bytes"`
	Event     string `json:"event"`
	FileName  string `json:"file_name"`
	Format    string `json:"format"`
	MapIndex  int    `json:"map_index"`
	MapName   string `json:"map_name"`
	MatchDate string `json:"match_date"`
	MatchID   string `json:"match_id"`
	MatchURL  string `json:"match_url"`
	Patch     string `json:"patch_version"`
	Rounds    int    `json:"rounds_played"`
	RowID     string `json:"row_id"`
	Score1    int    `json:"score1"`
	Score2    int    `json:"score2"`
	Stars     int    `json:"stars"`
	Team1     string `json:"team1"`
	Team2     string `json:"team2"`
}

type proCatalogEntry struct {
	DemoBytes int64  `json:"demoBytes"`
	Event     string `json:"event"`
	FileName  string `json:"fileName"`
	Format    string `json:"format"`
	MapIndex  int    `json:"mapIndex"`
	MapName   string `json:"mapName"`
	MatchDate string `json:"matchDate"`
	MatchID   string `json:"matchId"`
	MatchURL  string `json:"matchUrl"`
	Patch     string `json:"patchVersion"`
	Rounds    int    `json:"roundsPlayed"`
	RowID     string `json:"rowId"`
	Score1    int    `json:"score1"`
	Score2    int    `json:"score2"`
	Stars     int    `json:"stars"`
	Team1     string `json:"team1"`
	Team2     string `json:"team2"`
}

type proCatalogResponse struct {
	AttributionURL string            `json:"attributionUrl"`
	Entries        []proCatalogEntry `json:"entries"`
	License        string            `json:"license"`
	NextOffset     int               `json:"nextOffset"`
	Offset         int               `json:"offset"`
	Source         string            `json:"source"`
	Total          int               `json:"total"`
}

type proImportRequest struct {
	FileName string `json:"fileName"`
}

func serveProCatalog(w http.ResponseWriter, r *http.Request, opts Options) error {
	offset, err := boundedQueryInt(r.URL.Query().Get("offset"), 0, 0, 100000)
	if err != nil {
		return fmt.Errorf("invalid catalogue offset: %w", err)
	}
	length, err := boundedQueryInt(r.URL.Query().Get("length"), defaultProCatalogPageSize, 1, maximumProCatalogPageSize)
	if err != nil {
		return fmt.Errorf("invalid catalogue length: %w", err)
	}

	endpoint, err := url.Parse(proCatalogURL(opts))
	if err != nil {
		return fmt.Errorf("configure pro catalogue: %w", err)
	}
	query := endpoint.Query()
	query.Set("dataset", proMatchDatasetID)
	query.Set("config", "default")
	query.Set("split", "train")
	query.Set("offset", strconv.Itoa(offset))
	query.Set("length", strconv.Itoa(length))
	endpoint.RawQuery = query.Encode()

	request, err := http.NewRequestWithContext(r.Context(), http.MethodGet, endpoint.String(), nil)
	if err != nil {
		return fmt.Errorf("build pro catalogue request: %w", err)
	}
	request.Header.Set("Accept", "application/json")
	request.Header.Set("User-Agent", "DemoRead/0.1 (+https://github.com/Litepac/cs2_litepac)")

	response, err := proHTTPClient(opts).Do(request)
	if err != nil {
		return fmt.Errorf("fetch pro catalogue: %w", err)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return fmt.Errorf("fetch pro catalogue: provider returned %s", response.Status)
	}

	var upstream proCatalogUpstream
	decoder := json.NewDecoder(io.LimitReader(response.Body, maximumProCatalogBytes+1))
	if err := decoder.Decode(&upstream); err != nil {
		return fmt.Errorf("decode pro catalogue: %w", err)
	}

	entries := make([]proCatalogEntry, 0, len(upstream.Rows))
	for _, candidate := range upstream.Rows {
		entry, ok := normalizeProCatalogRow(candidate.Row)
		if ok {
			entries = append(entries, entry)
		}
	}

	w.Header().Set("Cache-Control", "public, max-age=120")
	writeJSON(w, http.StatusOK, proCatalogResponse{
		AttributionURL: proMatchDatasetURL,
		Entries:        entries,
		License:        proMatchDatasetLicense,
		NextOffset:     offset + len(upstream.Rows),
		Offset:         offset,
		Source:         proMatchDatasetID,
		Total:          upstream.Total,
	})
	return nil
}

func importProviderDemo(w http.ResponseWriter, r *http.Request, opts Options) error {
	r.Body = http.MaxBytesReader(w, r.Body, 4096)
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	var payload proImportRequest
	if err := decoder.Decode(&payload); err != nil {
		return fmt.Errorf("read pro demo import: %w", err)
	}
	if !validProviderDemoPath(payload.FileName) {
		return fmt.Errorf("invalid provider demo path")
	}

	tempDir := strings.TrimSpace(opts.TempDir)
	if tempDir == "" {
		tempDir = os.TempDir()
	}
	if err := os.MkdirAll(tempDir, 0o755); err != nil {
		return fmt.Errorf("create temp directory: %w", err)
	}

	demoFile, err := os.CreateTemp(tempDir, "demoread-pro-*.dem")
	if err != nil {
		return fmt.Errorf("create pro demo file: %w", err)
	}
	demoPath := demoFile.Name()
	defer os.Remove(demoPath)
	defer demoFile.Close()

	downloadURL := providerDemoURL(opts, payload.FileName)
	request, err := http.NewRequestWithContext(r.Context(), http.MethodGet, downloadURL, nil)
	if err != nil {
		return fmt.Errorf("build pro demo request: %w", err)
	}
	request.Header.Set("User-Agent", "DemoRead/0.1 (+https://github.com/Litepac/cs2_litepac)")
	response, err := proHTTPClient(opts).Do(request)
	if err != nil {
		return fmt.Errorf("download pro demo: %w", err)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return fmt.Errorf("download pro demo: provider returned %s", response.Status)
	}

	limit := maxProviderDemoBytes(opts)
	if response.ContentLength > limit {
		return fmt.Errorf("download pro demo: file is larger than the %s import limit", humanBytes(limit))
	}
	written, err := io.Copy(demoFile, io.LimitReader(response.Body, limit+1))
	if err != nil {
		return fmt.Errorf("download pro demo: %w", err)
	}
	if written > limit {
		return fmt.Errorf("download pro demo: file is larger than the %s import limit", humanBytes(limit))
	}
	if written == 0 {
		return fmt.Errorf("download pro demo: provider returned an empty file")
	}
	if err := demoFile.Close(); err != nil {
		return fmt.Errorf("finalize pro demo: %w", err)
	}

	return parseDemoPath(w, opts, path.Base(payload.FileName), demoPath)
}

func normalizeProCatalogRow(row proCatalogUpstreamRow) (proCatalogEntry, bool) {
	if strings.TrimSpace(row.RowID) == "" || !validProviderDemoPath(row.FileName) || row.DemoBytes <= 0 {
		return proCatalogEntry{}, false
	}
	if strings.TrimSpace(row.Event) == "" || strings.TrimSpace(row.Team1) == "" || strings.TrimSpace(row.Team2) == "" {
		return proCatalogEntry{}, false
	}
	if parsed, err := url.Parse(row.MatchURL); err != nil || parsed.Scheme != "https" || !strings.EqualFold(parsed.Hostname(), "www.hltv.org") {
		row.MatchURL = ""
	}

	return proCatalogEntry{
		DemoBytes: row.DemoBytes,
		Event:     strings.TrimSpace(row.Event),
		FileName:  row.FileName,
		Format:    strings.TrimSpace(row.Format),
		MapIndex:  row.MapIndex,
		MapName:   strings.TrimSpace(row.MapName),
		MatchDate: strings.TrimSpace(row.MatchDate),
		MatchID:   strings.TrimSpace(row.MatchID),
		MatchURL:  row.MatchURL,
		Patch:     strings.TrimSpace(row.Patch),
		Rounds:    row.Rounds,
		RowID:     strings.TrimSpace(row.RowID),
		Score1:    row.Score1,
		Score2:    row.Score2,
		Stars:     row.Stars,
		Team1:     strings.TrimSpace(row.Team1),
		Team2:     strings.TrimSpace(row.Team2),
	}, true
}

func validProviderDemoPath(value string) bool {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" || strings.Contains(trimmed, "\\") || strings.Contains(trimmed, "\x00") {
		return false
	}
	cleaned := path.Clean(trimmed)
	return cleaned == trimmed && strings.HasPrefix(cleaned, "demos/") && strings.HasSuffix(strings.ToLower(cleaned), ".dem") && !strings.Contains(cleaned, "../")
}

func providerDemoURL(opts Options, fileName string) string {
	base := strings.TrimRight(strings.TrimSpace(opts.ProDemoBaseURL), "/")
	if base == "" {
		base = strings.TrimRight(defaultProDemoBaseURL, "/")
	}
	segments := strings.Split(fileName, "/")
	for index := range segments {
		segments[index] = url.PathEscape(segments[index])
	}
	return base + "/" + strings.Join(segments, "/")
}

func boundedQueryInt(raw string, fallback, minimum, maximum int) (int, error) {
	if strings.TrimSpace(raw) == "" {
		return fallback, nil
	}
	value, err := strconv.Atoi(raw)
	if err != nil || value < minimum || value > maximum {
		return 0, fmt.Errorf("must be between %d and %d", minimum, maximum)
	}
	return value, nil
}

func proCatalogURL(opts Options) string {
	if value := strings.TrimSpace(opts.ProCatalogURL); value != "" {
		return value
	}
	return defaultProCatalogURL
}

func proHTTPClient(opts Options) *http.Client {
	if opts.HTTPClient != nil {
		return opts.HTTPClient
	}
	return &http.Client{Timeout: 30 * time.Minute}
}

func maxProviderDemoBytes(opts Options) int64 {
	if opts.MaxProviderDemoBytes > 0 {
		return opts.MaxProviderDemoBytes
	}
	return defaultMaxProviderDemoSize
}

func humanBytes(value int64) string {
	const gib = int64(1 << 30)
	const mib = int64(1 << 20)
	if value >= gib {
		return fmt.Sprintf("%.1f GiB", float64(value)/float64(gib))
	}
	return fmt.Sprintf("%.0f MiB", float64(value)/float64(mib))
}
