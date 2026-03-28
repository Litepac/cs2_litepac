package validate_test

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sort"
	"testing"

	"mastermind/parser/internal/replay"
	"mastermind/parser/internal/validate"
)

func BenchmarkReplaySemanticValidation(b *testing.B) {
	raw, _ := loadBenchmarkReplayFixture(b)

	b.ReportAllocs()
	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		var data replay.Replay
		if err := json.Unmarshal(raw, &data); err != nil {
			b.Fatalf("decode fixture replay: %v", err)
		}
		if err := validate.ValidateReplay(data); err != nil {
			b.Fatalf("semantic validation: %v", err)
		}
	}
}

func BenchmarkReplaySchemaValidation(b *testing.B) {
	raw, schemaPath := loadBenchmarkReplayFixture(b)

	b.ReportAllocs()
	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		var data replay.Replay
		if err := json.Unmarshal(raw, &data); err != nil {
			b.Fatalf("decode fixture replay: %v", err)
		}
		if err := validate.ValidateSchema(schemaPath, data); err != nil {
			b.Fatalf("schema validation: %v", err)
		}
	}
}

func loadBenchmarkReplayFixture(b *testing.B) ([]byte, string) {
	b.Helper()

	repoRoot := filepath.Join("..", "..", "..")
	replayDir := filepath.Join(repoRoot, "testdata", "replays")
	schemaPath := filepath.Join(repoRoot, "schema", "mastermind.replay.schema.json")

	files, err := os.ReadDir(replayDir)
	if err != nil {
		b.Skipf("replay fixtures are not present locally: %v", err)
	}

	jsonFixtures := make([]string, 0, len(files))
	for _, entry := range files {
		if entry.IsDir() || filepath.Ext(entry.Name()) != ".json" {
			continue
		}
		jsonFixtures = append(jsonFixtures, entry.Name())
	}

	if len(jsonFixtures) == 0 {
		b.Skip("no replay fixtures found in testdata/replays")
	}

	sort.Strings(jsonFixtures)
	replayPath := filepath.Join(replayDir, jsonFixtures[0])
	raw, err := os.ReadFile(replayPath)
	if err != nil {
		b.Fatalf("read replay fixture %s: %v", replayPath, err)
	}

	if _, err := os.Stat(schemaPath); err != nil {
		b.Fatalf("schema file missing: %v", err)
	}

	return raw, schemaPath
}
