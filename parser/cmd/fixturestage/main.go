package main

import (
	"encoding/json"
	"flag"
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
	replayDir := flag.String("replay-dir", filepath.Join("..", "testdata", "replays"), "Directory containing replay json files")
	fixtureDir := flag.String("fixture-dir", "", "Directory to write static fixture files; use an explicit path such as ../public/fixtures only for static preview builds")
	flag.Parse()

	if *fixtureDir == "" {
		fmt.Fprintln(os.Stderr, "fixturestage requires -fixture-dir to avoid accidentally staging local replay JSON into public builds")
		fmt.Fprintln(os.Stderr, "example: go run .\\cmd\\fixturestage -- -fixture-dir ..\\public\\fixtures")
		os.Exit(2)
	}

	entries, err := os.ReadDir(*replayDir)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}

	if err := os.MkdirAll(*fixtureDir, 0o755); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}

	if err := removeStaleJSON(*fixtureDir); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}

	fixtures := make([]fixtureEntry, 0, len(entries))
	for _, entry := range entries {
		if entry.IsDir() || filepath.Ext(entry.Name()) != ".json" {
			continue
		}

		source := filepath.Join(*replayDir, entry.Name())
		target := filepath.Join(*fixtureDir, entry.Name())
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

	indexPath := filepath.Join(*fixtureDir, "index.json")
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

func removeStaleJSON(directory string) error {
	matches, err := filepath.Glob(filepath.Join(directory, "*.json"))
	if err != nil {
		return err
	}

	for _, match := range matches {
		if err := os.Remove(match); err != nil {
			return err
		}
	}

	return nil
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
