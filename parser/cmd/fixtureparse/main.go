package main

import (
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"sort"

	"mastermind/parser/internal/demo"
)

func main() {
	demoDir := flag.String("demo-dir", filepath.Join("..", "testdata", "demos"), "Directory containing .dem files")
	outDir := flag.String("out-dir", filepath.Join("..", "testdata", "replays"), "Directory to write replay json files")
	assetsRoot := flag.String("assets-root", filepath.Join("..", "assets", "maps"), "Directory containing map assets")
	schemaPath := flag.String("schema", filepath.Join("..", "schema", "mastermind.replay.schema.json"), "Path to replay schema")
	flag.Parse()

	entries, err := os.ReadDir(*demoDir)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}

	demos := make([]string, 0, len(entries))
	for _, entry := range entries {
		if entry.IsDir() || filepath.Ext(entry.Name()) != ".dem" {
			continue
		}
		demos = append(demos, entry.Name())
	}
	sort.Strings(demos)

	if len(demos) == 0 {
		fmt.Fprintln(os.Stderr, "no .dem files found")
		os.Exit(1)
	}

	for _, fileName := range demos {
		base := fileName[:len(fileName)-len(filepath.Ext(fileName))]
		fmt.Printf("parsing %s\n", fileName)
		err := demo.Parse(demo.Options{
			DemoPath:   filepath.Join(*demoDir, fileName),
			OutputPath: filepath.Join(*outDir, base+".replay.json"),
			SchemaPath: *schemaPath,
			AssetsRoot: *assetsRoot,
		})
		if err != nil {
			fmt.Fprintf(os.Stderr, "%s: %v\n", fileName, err)
			os.Exit(1)
		}
	}
}
