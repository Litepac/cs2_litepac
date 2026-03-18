package validate

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"github.com/santhosh-tekuri/jsonschema/v6"

	"mastermind/parser/internal/replay"
)

func SchemaPath(explicit string) (string, error) {
	if explicit != "" {
		return explicit, nil
	}

	candidates := []string{
		filepath.Join("schema", "mastermind.replay.schema.json"),
		filepath.Join("..", "schema", "mastermind.replay.schema.json"),
		filepath.Join("..", "..", "schema", "mastermind.replay.schema.json"),
	}

	for _, candidate := range candidates {
		if _, err := os.Stat(candidate); err == nil {
			return candidate, nil
		}
	}

	return "", fmt.Errorf("could not locate schema/mastermind.replay.schema.json")
}

func ValidateSchema(path string, data replay.Replay) error {
	compiler := jsonschema.NewCompiler()
	compiled, err := compiler.Compile(path)
	if err != nil {
		return fmt.Errorf("compile schema: %w", err)
	}

	raw, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("marshal replay for schema validation: %w", err)
	}

	var value any
	if err := json.Unmarshal(raw, &value); err != nil {
		return fmt.Errorf("decode replay for schema validation: %w", err)
	}

	if err := compiled.Validate(value); err != nil {
		return fmt.Errorf("schema validation failed: %w", err)
	}

	return nil
}
