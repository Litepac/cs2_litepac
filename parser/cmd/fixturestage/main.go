package main

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sort"
)

type fixtureEntry struct {
	FileName string `json:"fileName"`
	Label    string `json:"label"`
}

type fixtureIndex struct {
	Files []fixtureEntry `json:"files"`
}

func main() {
	replayDir := filepath.Join("..", "testdata", "replays")
	fixtureDir := filepath.Join("..", "assets", "fixtures")

	entries, err := os.ReadDir(replayDir)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}

	if err := os.MkdirAll(fixtureDir, 0o755); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}

	fixtures := make([]fixtureEntry, 0, len(entries))
	for _, entry := range entries {
		if entry.IsDir() || filepath.Ext(entry.Name()) != ".json" {
			continue
		}

		source := filepath.Join(replayDir, entry.Name())
		target := filepath.Join(fixtureDir, entry.Name())
		if err := copyFile(source, target); err != nil {
			fmt.Fprintf(os.Stderr, "%s: %v\n", entry.Name(), err)
			os.Exit(1)
		}

		fixtures = append(fixtures, fixtureEntry{
			FileName: entry.Name(),
			Label:    entry.Name(),
		})
	}

	sort.Slice(fixtures, func(i, j int) bool {
		return fixtures[i].FileName < fixtures[j].FileName
	})

	indexPath := filepath.Join(fixtureDir, "index.json")
	raw, err := json.MarshalIndent(fixtureIndex{Files: fixtures}, "", "  ")
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}

	raw = append(raw, '\n')
	if err := os.WriteFile(indexPath, raw, 0o644); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}

	fmt.Printf("staged %d replay fixtures\n", len(fixtures))
}

func copyFile(source, target string) error {
	input, err := os.Open(source)
	if err != nil {
		return err
	}
	defer input.Close()

	output, err := os.Create(target)
	if err != nil {
		return err
	}

	if _, err := io.Copy(output, input); err != nil {
		output.Close()
		return err
	}

	return output.Close()
}
